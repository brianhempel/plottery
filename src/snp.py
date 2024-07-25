from __future__ import annotations

import base64
import io
import json
import os
import pathlib
import re
import ast
import time

import IPython

import mypy
import mypy.nodes
import mypy.build
import mypy.main
import mypy.options
import mypy.types
import mypy.server.update

import matplotlib as mpl

import shapely

import serialize
import visitor_ast


# Suppress extra figure, speeds up responsiveness during direct manipulation
mpl.pyplot.switch_backend('module://matplotlib_inline.backend_inline') # register the display hook now rather than on creation of the first figure
mpl.pyplot.ioff() # turn off that display hook


# thanks GPT-4
class Timer:
    def __init__(self, message=""):
        self.message = message

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, *args):
        self.elapsed_time = time.time() - self.start_time
        # print(f"{self.message}: {self.elapsed_time:.2f} seconds")


def get_trivial_names():
    """Returns stuff like __class__, __doc__, etc."""
    return set(dir(object()))


# File path that the notebook code will be written to for mypy
file_path = "__temp.py"
module_name = os.path.splitext(os.path.basename(file_path))[0]


def import_lineset_in(code):
    """Returns a set of code lines that begin with `import `"""
    import_lines_regex = re.compile(r"^[^#\n]*import .*", re.MULTILINE)
    return set(import_lines_regex.findall(code))


# For caching
if "import_lineset" not in globals():
    import_lineset = set()
    fine_grained_build_manager = None
    mypy_result = None  # The FineGrainedBuildManager mutates this, apparently.
    fscache = None


def do_inference(code):
    # For caching
    global import_lineset
    global fine_grained_build_manager
    global mypy_result
    global fscache

    # Write out to a temp file
    with open(file_path, "w") as file:
        file.write(code)

    if fine_grained_build_manager is None or import_lineset != import_lineset_in(code):
        import_lineset = import_lineset_in(code)
        sources, options = mypy.main.process_options([file_path])

        options.incremental = True
        options.preserve_asts = True
        options.strict_optional = True
        options.warn_unused_configs = True
        options.fine_grained_incremental = True
        options.use_fine_grained_cache = True
        options.local_partial_types = True  # https://github.com/python/mypy/issues/4492
        options.mypy_path = ["python-type-stubs-main/stubs"]
        # options.follow_imports = "silent"
        options.follow_imports_for_stubs = True
        options.export_types = True

        fscache = mypy.fscache.FileSystemCache()  # IDK if this is needed
        mypy_result = mypy.build.build(sources, options=options, fscache=fscache)

        fine_grained_build_manager = mypy.server.update.FineGrainedBuildManager(mypy_result)

    fine_grained_build_manager.update([(module_name, file_path)], [])
    fine_grained_build_manager.flush_cache()
    fscache.flush()

    return mypy_result


html_chars_re = re.compile("[&<>\"']")

def escape_html(string):
    html_subs = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }

    return html_chars_re.sub(lambda match: html_subs[match.group(0)], string)


def json_for_attr(x):
    return escape_html(json.dumps(x))


def full_names_dict(type_node):
    names = dict()
    for superclass in type_node.direct_base_classes():
        names.update(full_names_dict(superclass))
    names.update(type_node.names)
    return names


def object_type_node(obj, type_graph):
    thing_type_node = type_graph[obj.__class__.__module__].tree

    for class_name in obj.__class__.__qualname__.split("."):  # Handle inner nested classes correctly.
        if class_name in thing_type_node.names:
            thing_type_node = thing_type_node.names[class_name].node
        else:
            thing_type_node = None
            print(
                obj.__class__.__module__,
                obj.__class__.__qualname__,
                "not found",
            )
            break

    return thing_type_node


def flatten(lists):
    return sum(lists, [])  # https://stackoverflow.com/a/952946


def remove_nones(iter):
    return [x for x in iter if x is not None]


def all_artists(artist):
    if "get_children" in dir(artist):
        return [artist] + flatten([all_artists(artist) for artist in artist.get_children()])
    else:
        return [artist]


# returns shapely.Polygon
def mpl_bbox_to_shapely(bbox):
    return shapely.box(*bbox.extents)


# returns numpy ndarray of [xmin, ymin, xmax, ymax]
def total_bounds(geometries):
    return shapely.total_bounds(shapely.GeometryCollection(geometries))


# returns shapely.Polygon
def total_bbox(geometries):
    return shapely.box(*total_bounds(geometries))


# returns list of (obj_id, shapley.Geometry)
def flatten_regions2(objid_methods_bounds_geom_children):
    obj_id, methods, bounds, geom, children = objid_methods_bounds_geom_children
    return [(obj_id, geom)] + flatten([flatten_regions2(child) for child in children])


# Return list of (descendants that should also expose this method, method name on the root artist, number of times method could be called)
def method_associations(artist):
    match artist:
        case mpl.axes.Axes():
            return [
                ([".title"], "set_title", 1),
                ([".xaxis"], "set_xticks", 1),
                ([".xaxis", ".xaxis.label"], "set_xlabel", 1),
                ([".yaxis", ".yaxis.label"], "set_ylabel", 1),
                ([], "bar", float("inf")),
                ([], "barh", float("inf")),
                ([], "plot", float("inf")),
                ([], "legend", float("inf")),
                ([], "axhline", float("inf")),
                ([], "axvline", float("inf")),
            ]
        case _:
            return []



def tuple_or_none(iterable_or_none):
    return tuple(iterable_or_none) if iterable_or_none is not None else None

# Make sure to render before calling this.
# returns (artist, list of (artist, method_name), (fig_px_bounds, axes_px_bounds, axes_unit_bounds, region_px_bounds), shapley.Geometry, children)
def regions2(artist, fig_px_axes_px_axes_unit_bounds, renderer, artist_ids_that_will_have_a_method_call):
    child_pad = 3

    # These are used for computing the scale for mouse movements.
    # bounds are (x0, y0, x1, y1)
    fig_px_bounds, axes_px_bounds, axes_unit_bounds = fig_px_axes_px_axes_unit_bounds
    region_px_bounds = artist.get_window_extent(renderer).extents

    def get_zorder(artist_or_container):
        if hasattr(artist_or_container, "zorder"):
            return artist_or_container.zorder
        else:
            return get_zorder(artist_or_container.get_children()[0])

    if "get_children" in dir(artist):
        children = artist.get_children()
        if isinstance(artist, mpl.axes.Axes):

            ax = artist
            axes_px_bounds = ax.patch.get_window_extent(renderer).extents
            x_min, x_max = ax.get_xlim()
            y_min, y_max = ax.get_ylim()

            axes_unit_bounds = (x_min, y_min, x_max, y_max)


            # For some reason, the background patch is last in the children list when it should be first so it doesn't cover everything.
            # (It has special handling in Axes.draw() so this isn't any hackier than that is.)
            children.remove(artist.patch)
            children.insert(0, artist.patch)

            # Axes get_children() flattens its container children.
            # But the provenance that the artist is the result of a call is on the container.

            # Two possible solutions.

            # One: Unflatten. This exposes the container on the canvas to select, which can overlap a lot of other objects.
            # containers = artist.containers
            # container_children = flatten([container.get_children() for container in containers])
            # children = [child for child in children if child not in container_children]  # remove items in containers
            # children += containers  # add the containers instead

            # Two: Transfer the provenance to the artists.
            for container in artist.containers:
                for child in container.get_children():
                    if not hasattr(child, "_snp_came_from_call"): # Don't overwrite if already set.
                        child._snp_came_from_call = container._snp_came_from_call

            children = sorted(children, key=get_zorder) # this is also in Axes.draw()
    else:
        children = []

    match artist:
        case mpl.axis.Tick():
            # Remove invisible tick text (i.e. the labels for the opposite axes, which is mispositioned when not actively used.)
            children = [child for child in children if child.get_visible()]

    # print(artist.__class__.__name__, len(children))

    child_regions = remove_nones([regions2(child, (fig_px_bounds, axes_px_bounds, axes_unit_bounds), renderer, artist_ids_that_will_have_a_method_call) for child in children])
    child_regions_flat = flatten([flatten_regions2(child_region) for child_region in child_regions])
    child_geoms = [geom for _, geom in child_regions_flat]

    match artist:
        case mpl.text.Text() as text:
            # print("text:", repr(text.get_text()))

            # Sometimes empty text elements are mispositioned and mess up the bounding box of their parents.
            # So only include them if we need a position for a potential call that the user might want to add
            # (e.g. set_title, set_xlabel, etc.)
            if text.get_text() == "" and id(artist) not in artist_ids_that_will_have_a_method_call:
                my_geom = None
            else:
                # based on mpl text.py contains
                # bbox = mpl.text.Text.get_window_extent(text, renderer)
                bbox = text.get_window_extent(renderer)
                my_geom = mpl_bbox_to_shapely(bbox)
        case mpl.patches.Rectangle() as rect:
            bbox = rect.get_window_extent(renderer)
            my_geom = mpl_bbox_to_shapely(bbox)
        case mpl.lines.Line2D() as line:
            # based on mpl lines.py contains
            if line._xy is None or len(line._xy) == 0:
                my_geom = None
            else:
                transformed_path = line._get_transformed_path()
                path = transformed_path.get_fully_transformed_path()
                if len(path.vertices) >= 2:
                    line_string = shapely.LineString(path.vertices)
                    my_geom = shapely.buffer(
                        line_string,
                        child_pad + line.get_linewidth(),
                        quad_segs=1,
                        cap_style="square",
                        join_style="mitre",
                    )  # expand outward
                elif len(path.vertices) == 1:
                    d = 10 + line.get_linewidth()
                    my_geom = shapely.box(
                        path.vertices[0, 0] - d,
                        path.vertices[0, 1] - d,
                        path.vertices[0, 0] + d,
                        path.vertices[0, 1] + d,
                    )
                else:
                    print("a;sdkjf;laskdj;lsaknvad")
        case mpl.axes.Axes():
            my_geom = None
        case _:
            # print("regions(): unknown artist: " + str(artist))
            my_geom = None

    if my_geom is None and len(child_geoms) == 0:
        return None
    elif my_geom is None:
        my_geom = total_bbox(child_geoms)
    else:
        my_geom = shapely.union_all([my_geom, total_bbox(child_geoms)])

    my_geom = shapely.buffer(my_geom, child_pad, quad_segs=1, cap_style="square", join_style="mitre")  # expand by 10px

    my_region = (
        artist,
        [],
        (tuple_or_none(fig_px_bounds), tuple_or_none(axes_px_bounds), tuple_or_none(axes_unit_bounds), tuple_or_none(region_px_bounds)),
        my_geom,
        child_regions
    )

    return my_region


def method_type(receiver, method_name, type_graph):
    receiver_type_node = object_type_node(receiver, type_graph)

    if receiver_type_node is not None:
        node = full_names_dict(receiver_type_node).get(method_name)
        if node is not None:
            if not isinstance(node.type, mypy.types.Overloaded):
                return node.type

    return None


def method_type_json(receiver, method_name, type_graph):
    typ = method_type(receiver, method_name, type_graph)
    return typ and callable_type_json(typ, {})


# data-func-code-and-num indicates the artist was returned from a call, so that artist on the canvas should be associated with that call in the layers panel.

# Preserve heirarchical structure so that JS mouseenter events work as intended
def region2_to_svg_g(artist_methods_bounds_geom_children, object_names):
    artist, methods, (fig_px_bounds, axes_px_bounds, axes_unit_bounds, region_px_bounds), geom, children = artist_methods_bounds_geom_children
    geom_svg = geom.svg()
    geom_svg = re.sub(r'fill="[^"]*"', 'fill="transparent"', geom_svg)  # can't be "none", otherwise no mouse events are triggered inside the region
    geom_svg = re.sub(r'stroke-width="[^"]*"', 'stroke-width="0"', geom_svg)
    child_svgs_str = "\n".join([region2_to_svg_g(child, object_names) for child in children])

    artist_names = object_names.get(id(artist), (None, {}))[1]

    perhaps_call_loc = f'data-func-code-and-num="{json_for_attr(artist._snp_came_from_call[0])}" data-pos="{json_for_attr(artist._snp_came_from_call[1])}" data-fig-px-bounds="{json_for_attr(fig_px_bounds)}" data-axes-px-bounds="{json_for_attr(axes_px_bounds)}" data-axes-unit-bounds="{json_for_attr(axes_unit_bounds)}" data-region-px-bounds="{json_for_attr(region_px_bounds)}"' if hasattr(artist, "_snp_came_from_call") else ""
    return f"""<g data-artist="{str(artist)}" data-artist-id="{id(artist)}" data-artist-names="{json_for_attr(list(artist_names))}" {perhaps_call_loc}>
    {geom_svg}
    {child_svgs_str}
    </g>"""


# Mutates out
def _object_names_deep(out, obj, name, max_depth):
    if max_depth <= 0 or callable(obj):
        return

    if isinstance(obj, list):
        for i, item in enumerate(obj):
            _object_names_deep(out, item, f"{name}[{str(i)}]", max_depth)
        if len(obj) >= 1:
            _object_names_deep(out, obj[-1], f"{name}[-1]", max_depth)
    elif isinstance(obj, mpl.artist.Artist):
        key = id(obj)
        _obj, names = out.get(key, (obj, set()))
        out[key] = (_obj, names.union({name}))

        if max_depth <= 1:
            return

        trivial_names = get_trivial_names()
        for prop_name in dir(obj):
            if prop_name not in trivial_names:
                prop = getattr(obj, prop_name)
                _object_names_deep(out, prop, f"{name}.{prop_name}", max_depth - 1)

    # Need this to get plt.subplots() to show up in the layers panel
    elif obj is mpl.pyplot:
        out[id(obj)] = (obj, set())



# Returns a dict of object to (object, set of names)
def object_names(locals, user_nameset, max_depth=4):
    out = {}
    trivial_names = get_trivial_names()

    with mpl._api.deprecation.suppress_matplotlib_deprecation_warning():
        for name, value in [(name, value) for name, value in locals.items() if name in user_nameset and name not in trivial_names]:
            _object_names_deep(out, value, f"{name}", max_depth)

    return out

# Get all the names in the AST (thanks GPT-4o)
class NameExtractor(ast.NodeVisitor):
    def __init__(self):
        self.nameset = set()

    def visit_Name(self, node):
        self.nameset.add(node.id)
        self.generic_visit(node)


def get_user_nameset(code):
    name_extractor = NameExtractor()
    name_extractor.visit(ast.parse(code))
    return name_extractor.nameset


# For when you want quick redraws during mouse manipulations.
# The frontend calls this by changing the cell code from SNP(...) to SNPFigureOnly(...) before sending it to the Python kernel.
class SNPFigureOnly:
    def __init__(
        self,
        figure,
        locals,
        cell_lineno,
        provenance_is_off_by_n_lines,
        notebook_code_through_cell
    ):
        self.figure = figure
        self.cached_png = None

    def _repr_png_(self):
        with Timer("_repr_png_"):
            if self.cached_png == None:
                buf = io.BytesIO()
                self.figure.canvas.print_figure(
                    buf,
                    format="png",
                    dpi="figure",
                )
                self.cached_png = buf.getvalue()

        return self.cached_png


class SNPFigureAndHoverRegions(SNPFigureOnly):
    def __init__(
        self,
        figure,
        locals,
        cell_lineno,
        provenance_is_off_by_n_lines,
        notebook_code_through_cell
    ):
        mpl.pyplot.close('all') # Suppress "RuntimeWarning: More than 20 figures have been opened"

        self.figure = figure
        self.cached_png = None
        self.cached_svg_hover_regions = None
        self.user_nameset = get_user_nameset(notebook_code_through_cell)

        # Make a map of object id to object name (e.g. "fig.axes")
        with Timer("object_names"):
            self.object_names = object_names(locals, self.user_nameset)

        with Timer("artist_ids_that_will_have_a_method_call"):
            self.artist_ids_that_will_have_a_method_call = set()
            for obj_id, (obj, _names) in self.object_names.items():
                for children_paths, _, _ in method_associations(obj):
                    self.artist_ids_that_will_have_a_method_call.add(obj_id)
                    for code_to_descendent in children_paths:
                        self.artist_ids_that_will_have_a_method_call.add(id(eval("obj" + code_to_descendent)))

    # Note this is the hover regions only.
    def _repr_svg_(self):
        with Timer("_repr_svg_"):
            if self.cached_svg_hover_regions == None:
                self._repr_png_()  # Ensure elements are laid out.

                fig = self.figure
                # bbox_inches = fig.get_tightbbox(fig.canvas.renderer).padded(mpl.rcParams["savefig.pad_inches"])
                # print(bbox_inches)
                # x0_px = bbox_inches.x0 * fig.get_dpi()
                # y0_px = bbox_inches.y0 * fig.get_dpi()
                # width_px = bbox_inches.width * fig.get_dpi()
                # height_px = bbox_inches.height * fig.get_dpi()

                bbox_pixels = fig.get_window_extent(fig.canvas.renderer)
                # print(bbox_pixels)
                x0_px = bbox_pixels.x0
                y0_px = bbox_pixels.y0
                width_px = bbox_pixels.width
                height_px = bbox_pixels.height

                fig_regions2 = regions2(self.figure, (bbox_pixels.extents, None, None), fig.canvas.renderer, self.artist_ids_that_will_have_a_method_call)

                svg_body = region2_to_svg_g(fig_regions2, self.object_names)

                self.cached_svg_hover_regions = f"""<svg style="margin: 0; border: solid 1px black; position: absolute; top: 0; left: 0;" transform="scale(1,-1)" width={width_px} height={height_px} viewBox="{x0_px} {y0_px} {width_px} {height_px}">
                    {svg_body}
                </svg>"""

        return self.cached_svg_hover_regions


class SNP(SNPFigureAndHoverRegions):
    def __init__(
        self,
        figure,
        locals,
        cell_lineno,
        provenance_is_off_by_n_lines,
        notebook_code_through_cell
    ):
        super().__init__(figure, locals, cell_lineno, provenance_is_off_by_n_lines, notebook_code_through_cell)

        # Perform type inference
        self.cell_lineno = cell_lineno
        self.provenance_is_off_by_n_lines = provenance_is_off_by_n_lines

        self.notebook_code_through_cell = notebook_code_through_cell
        with Timer("do_inference"):
            self.mypy_result = do_inference(notebook_code_through_cell)
        self.type_graph = self.mypy_result.graph
        self.type_tree = self.type_graph[module_name].tree
        tree = self.type_tree


        # print(ast.dump(ast.parse(notebook_code_through_cell)))

        # print(dir(ast.parse(notebook_code_through_cell).body[0]))

        # print([v[1] for k,v in self.object_names.items()])

        # Make a map of user code snippets to types, things we could use for autocompleting arguments.
        #
        # Goes down one level into dicts and lists and tuples; this requires the concrete values, not just the types.
        with Timer("user_typed_snippets"):
            # I wish there were a better way.
            # array_like_type = self.type_graph['matplotlib.axes._axes'].tree.names['Axes'].node.names['bar'].type.arg_types[1]
            # iterable_type
            self.user_typed_snippets = {}
            self.user_iterables = [] # but exclude strings
            string_type = mypy.types.Instance(self.type_graph['builtins'].tree.names['str'].node, [])
            np_arange_ret_type = self.type_graph['numpy'].tree.names['arange'].node.type.items[0].ret_type
            explicit_any_type = mypy.types.AnyType(mypy.types.TypeOfAny.explicit)
            iterable_type = mypy.types.Instance(self.type_graph['collections.abc'].tree.names['Iterable'].node, [explicit_any_type])
            dict_keys_node = self.type_graph['_collections_abc'].tree.names['dict_keys'].node # <TypeInfo _collections_abc.dict_keys>
            dict_values_node = self.type_graph['_collections_abc'].tree.names['dict_values'].node # <TypeInfo _collections_abc.dict_values>
            dict_items_node = self.type_graph['_collections_abc'].tree.names['dict_items'].node # <TypeInfo _collections_abc.dict_items>
            for name, value in locals.items():
                if name in tree.names and name in self.user_nameset and name not in get_trivial_names() and not callable(value):
                    name_type = tree.names[name].type
                    if name_type is not None:
                        self.user_typed_snippets[name] = name_type
                        is_subtype(name_type, iterable_type) and not is_subtype(name_type, string_type) and self.user_iterables.append(name)

                        if isinstance(value, dict) and isinstance(name_type, mypy.types.Instance) and name_type.type.fullname == 'builtins.dict':
                            val_type = name_type.args[1]
                            if val_type is not None:
                                for key, _ in value.items():
                                    code = f"{name}[{repr(key)}]"
                                    self.user_typed_snippets[code] = val_type
                                    is_subtype(val_type, iterable_type) and not is_subtype(val_type, string_type) and self.user_iterables.append(code)

                            # type of item.keys()
                            # I don't know why dict_keys takes two args, rather than just the type of the keys, but that's how mypy does it.
                            dot_keys_type = mypy.types.Instance(dict_keys_node, [name_type.args[0], name_type.args[1]])
                            code = f"{name}.keys()"
                            self.user_typed_snippets[code] = dot_keys_type
                            is_subtype(dot_keys_type, iterable_type) and not is_subtype(dot_keys_type, string_type) and self.user_iterables.append(code)

                            # I don't know why dict_values takes two args, rather than just the type of the values, but that's how mypy does it.
                            dot_values_type = mypy.types.Instance(dict_values_node, [name_type.args[0], name_type.args[1]])
                            code = f"{name}.values()"
                            self.user_typed_snippets[code] = dot_values_type
                            is_subtype(dot_values_type, iterable_type) and not is_subtype(dot_values_type, string_type) and self.user_iterables.append(code)

                            # I don't know why dict_values takes two args, rather than just the type of the values, but that's how mypy does it.
                            dot_items_type = mypy.types.Instance(dict_items_node, [name_type.args[0], name_type.args[1]])
                            code = f"{name}.items()"
                            self.user_typed_snippets[code] = dot_items_type
                            is_subtype(dot_items_type, iterable_type) and not is_subtype(dot_items_type, string_type) and self.user_iterables.append(code)

                        if isinstance(value, list) and isinstance(name_type, mypy.types.Instance) and name_type.type.fullname == 'builtins.list':
                            item_type = name_type.args[0]
                            if item_type is not None:
                                for i, _ in enumerate(value):
                                    code = f"{name}[{i}]"
                                    self.user_typed_snippets[code] = item_type
                                    is_subtype(item_type, iterable_type) and not is_subtype(item_type, string_type) and self.user_iterables.append(code)

                            # Add np.arange(len(...))
                            self.user_typed_snippets[f"np.arange(len({name}))"] = np_arange_ret_type

                        if isinstance(value, tuple) and isinstance(name_type, mypy.types.TupleType):
                            for i, item_type in enumerate(name_type.items):
                                if item_type is not None:
                                    code = f"{name}[{i}]"
                                    self.user_typed_snippets[code] = item_type
                                    is_subtype(item_type, iterable_type) and not is_subtype(item_type, string_type) and self.user_iterables.append(code)

                            self.user_typed_snippets[f"np.arange(len({name}))"] = np_arange_ret_type


            # print(self.user_typed_snippets)


        # Gather all the type information for function calls in the notebook
        with Timer("GatherTypedCalls"):
            self.user_call_type_info = None
            if tree is not None:
                visitor = GatherTypedCalls(self.mypy_result.types, self.user_typed_snippets)
                visitor.visit_mypy_file(tree)
                self.user_call_type_info = visitor.out

    # This is only the technical info for the front end.
    # def _repr_json_(self):
    #     return {
    #         "cell_lineno": self.cell_lineno,
    #         "provenance_is_off_by_n_lines": self.provenance_is_off_by_n_lines,
    #         # "user_call_info": self.user_call_info,
    #     }

    def _repr_html_(self):
        # ripped the below from ipympl/backend_nbagg.py
        with Timer("base64_image"):
            base64_image = base64.b64encode(self._repr_png_()).decode("utf-8")
            data_url = f"data:image/png;base64,{base64_image}"

        # data_methods = json.dumps([{"receiver_id": id(receiver), "receiver_names": list(object_names.get(id(receiver), (None, {}))[1]), "method_name": method_name, "method_type": method_type_json(receiver, method_name, type_graph)} for receiver, method_name in methods])

        methods = []
        calls = []

        with Timer("associate method calls on named objects"):
            # Find method calls on each of the named objects.
            for obj_id, (obj, names) in self.object_names.items():
                for children_paths, method_name, max_calls in method_associations(obj):
                    show_on = [obj_id]
                    for code_to_descendent in children_paths:
                        show_on.append(id(eval("obj" + code_to_descendent)))  # This can't be in a comprehension because eval() can't find "obj" when it is

                    methods.append(
                        {
                            "name": method_name,
                            "receiver": obj_id,
                            "receiver_names": list(names),
                            "show_on": show_on,
                            "type": method_type_json(obj, method_name, self.type_graph),
                            "max_calls": max_calls,
                        }
                    )

                try:
                    loc_via_func_code_and_nums = [loc_via_func_code_and_num for loc_via_func_code_and_num, position in obj._snp_method_call_locs]
                    method_call_positions = [position for loc_via_func_code_and_num, position in obj._snp_method_call_locs]
                except:
                    loc_via_func_code_and_nums = []
                    method_call_positions = []

                # print(names, loc_via_func_code_and_nums)
                # n^2!
                #
                # Correlate to the call info from the type checker, which only know about code positions, not object names or ids
                if len(method_call_positions) > 0:
                    for call_info in self.user_call_type_info:
                        call_pos_dict = call_info["call"]["pos"]
                        # Convert from loc in current_notebook.py to loc in the executed cell
                        call_pos = (
                            call_pos_dict["line"] - self.cell_lineno + self.provenance_is_off_by_n_lines + 1,
                            call_pos_dict["column"],
                            call_pos_dict["end_line"] - self.cell_lineno + self.provenance_is_off_by_n_lines + 1,
                            call_pos_dict["end_column"],
                        )

                        if call_pos in method_call_positions:
                            i = method_call_positions.index(call_pos)
                            loc_via_func_code_and_num = loc_via_func_code_and_nums[i]
                            method_name = call_info["callee"]["name"].split(" ")[0]  # "set_title of Axes" => "set_title"
                            calls.append(
                                call_info
                                | {
                                    "name": method_name,
                                    # "receiver": id(obj),
                                    "loc_via_func_code_and_num": loc_via_func_code_and_num,
                                }
                            )

        sidebar_stuff = {
            "methods": methods,
            "calls": calls,
        }
        self.methods = methods
        self.calls = calls

        # print(ast.parse(self.notebook_code_through_cell).)
        # notebook_ast = json.dumps(ast.parse(self.notebook_code_through_cell), default=lambda o: o.__dict__)
        # with Timer("notebook_ast"):
        #     ast_v = visitor_ast.MyVisitor()
        #     # print(json.dumps(ast_v.visit(ast.parse(self.notebook_code_through_cell)))
        #     notebook_ast = ast_v.visit(ast.parse(self.notebook_code_through_cell))

        notebook_code_lines = self.notebook_code_through_cell.split("\n")

        # This assumes the typed node is in the notebook.
        # The nodes do not specify which file they actually came from.
        def extract(line, column, end_line, end_column):
            if end_line is None or end_line > len(notebook_code_lines) or line < 1:
                return None
            if line == end_line:
                return notebook_code_lines[line-1][column:end_column]
            else:
                return "\n".join(
                    [notebook_code_lines[line-1][column:]] +
                    notebook_code_lines[line:end_line-1] +
                    [notebook_code_lines[end_line-1][:end_column]]
                )

        def type_node_to_json(node):
            def extra_attrs(obj):
                try:
                    unparsed = extract(obj.line, obj.column, obj.end_line, obj.end_column)
                except AttributeError:
                    unparsed = None
                return { 'unparsed': unparsed } if unparsed is not None else {}
            def no_types(obj):
                type_str = str(type(obj))
                return 'mypy.types.' not in type_str and 'mypy.nodes.MypyFile' not in type_str
            return serialize.arbitrary_to_json(node, recurse=no_types, extra_attrs=extra_attrs)

        with Timer("notebook_typed_ast"):
            notebook_typed_ast = type_node_to_json(self.type_tree.defs)

        with Timer("notebook_parseable_comments"):
            self.notebook_parseable_comments = []
            # find contiguous # comment chunks in notebook_code_through_cell
            multiline_comments = [] # list of (start_line_no, start_col, [lines])
            cur_comment = None
            for line_no, line in enumerate(notebook_code_lines):
                if not cur_comment:
                    # If the line includes #, start a new multiline_comment
                    hash_idx = line.find('#')
                    if hash_idx != -1:
                        cur_comment = (line_no + 1, hash_idx, [line[hash_idx:]])
                elif line.strip().startswith('#'):
                    cur_comment[2].append(line)
                else:
                    multiline_comments.append(cur_comment)
                    cur_comment = None
            if cur_comment:
                multiline_comments.append(cur_comment)

            # A multiline comment might have multiple expression lines, each of which
            # should be a separate layer. So, parse the comment into an expression list
            # to split the comment into sub-comments.
            for multiline_comment in multiline_comments:
                # Replace /# ?/ at the beginning of each line with "" and then join them
                comment_as_code = '\n'.join([re.sub(r'^(\s*)# ?', '\\1', line) for line in multiline_comment[2]])

                try:
                    chunks_in_comment = ast.parse(comment_as_code).body # list of expressions
                except SyntaxError:
                    chunks_in_comment = []

                for chunk_in_comment in chunks_in_comment:
                    line_no, col_offset, raw_lines = multiline_comment
                    (chunk_lineno, chunk_col, chunk_endlineno, chunk_endcol) = ast_loc(chunk_in_comment)
                    chunk_lines = raw_lines[chunk_lineno-1:chunk_endlineno]
                    self.notebook_parseable_comments.append({
                        'line':        line_no + chunk_lineno - 1,
                        'end_line':    line_no + chunk_lineno - 1 + len(chunk_lines) - 1,
                        'column':      (col_offset if chunk_lineno == 1 else chunk_col),
                        'end_column':  len(chunk_lines[-1]) + (col_offset if chunk_endlineno == 1 else 0),
                        'uncommented': "\n".join(comment_as_code.split('\n')[chunk_lineno-1:chunk_endlineno])
                    })


        # Walk all the files in the frontend folder, and append all the contents of the .css files
        with Timer("frontend_css"):
            frontend_css = "\n\n".join([path.read_text() for path in pathlib.Path("frontend").rglob("*.css")])

        with Timer("out_html"):
            out_html = f"""
                <div class="snp_outer">
                <script>{pathlib.Path("../dist/plugin.js").read_text()}</script>
                <div class="plot_and_sidebar">
                    <div class="plot_area" style="position:relative;">
                        <img src='{data_url}'> <!-- the plot -->
                        <div class="hover_regions">{self._repr_svg_()}</div>
                        <div class="stdout_stderr" style="max-width: {self.figure.get_window_extent(self.figure.canvas.renderer).width}px"></div>
                        <!-- buttons to add method calls will be added by JS below -->
                    </div>
                    <!-- sidebar added here -->
                </div>
                <!-- Not only for the styles, but also a way to run this code once the elements exist. -->
                <style onload="attach_snp(this.closest('.snp_outer'), {self.cell_lineno}, {self.provenance_is_off_by_n_lines}, {json_for_attr(self.user_call_type_info)}, {json_for_attr(sidebar_stuff)}, {json_for_attr(notebook_typed_ast)}, {json_for_attr(self.notebook_parseable_comments)}, {json_for_attr(self.user_iterables)})">
                    {frontend_css}
                </style>
                </div>
            """

        return out_html


# -------------------------------------------------------- #
#                   Provenance Tracking                    #
# -------------------------------------------------------- #

# Input:
# fig, ax = plt.subplots()
# ax.set_title("My Plot")
# xs = np.linspace(0, 2 * np.pi, 20)
# ys = np.sin(xs)
# lines = ax.plot(xs, ys)

# Output:
# (fig, ax) = tag_with_provenance(plt.subplots(), 2, 10, 2, 24)
# tag_with_provenance(ax.set_title('My Plot'), 3, 0, 3, 23)
# xs = tag_with_provenance(np.linspace(0, 2 * np.pi, 20), 4, 5, 4, 34)
# ys = tag_with_provenance(np.sin(xs), 5, 5, 5, 15)
# lines = tag_with_provenance(ax.plot(xs, ys), 6, 8, 6, 23)

# tag_with_provenance() gives the returned object an `_snp_came_from_call` attribute, which is a tuple of ((func_code, call_num), (lineno, col_offset, end_lineno, end_col_offset))

# Thanks GPT-4, this works, apparently.


class TaggedTuple(tuple):
    def __new__(cls, iterable, call_loc):
        out = tuple.__new__(cls, iterable)
        out._snp_came_from_call = call_loc
        return out


class TaggedStr(str):
    def __new__(cls, string, call_loc):
        out = str.__new__(cls, string)
        out._snp_came_from_call = call_loc
        return out


class TaggedList(list):
    def __init__(self, iterable, call_loc):
        self._snp_came_from_call = call_loc
        super().__init__(iterable)


class TaggedDict(dict):
    def __init__(self, dictionary, call_loc):
        self._snp_came_from_call = call_loc
        super().__init__(dictionary)


class TaggedInt(int):
    def __new__(cls, x, call_loc):
        out = int.__new__(cls, x)
        out._snp_came_from_call = call_loc
        return out


class TaggedFloat(float):
    def __new__(cls, x, call_loc):
        out = float.__new__(cls, x)
        out._snp_came_from_call = call_loc
        return out


def tag_with_provenance(
    ret_obj,
    receiver,
    func_code,
    call_num,
    lineno,
    col_offset,
    end_lineno,
    end_col_offset,
):
    # Two methods for referring to the same call:
    # 1. call code and number e.g. ("ax.set_title", 3) for the front end selection state, to be somewhat robust to code changes
    # 2. code location e.g.(7,0,7,23) for matching with call information from the type checker

    call_loc = (
        (func_code, call_num),
        (lineno, col_offset, end_lineno, end_col_offset),
    )

    try:
        method_call_locs = receiver._snp_method_call_locs
    except:
        method_call_locs = set()

    method_call_locs.add(call_loc)

    try:
        receiver._snp_method_call_locs = method_call_locs
    except:
        pass

    if hasattr(ret_obj, "_snp_came_from_call"):
        return ret_obj  # Don't rewrite oldest loc.

    try:
        ret_obj._snp_came_from_call = call_loc
        return ret_obj
    except:
        if isinstance(ret_obj, tuple):
            return TaggedTuple(tuple(tag_with_provenance(child, receiver, func_code, call_num, lineno, col_offset, end_lineno, end_col_offset) for child in ret_obj), call_loc)
        elif isinstance(ret_obj, str):
            return TaggedStr(ret_obj, call_loc)
        elif isinstance(ret_obj, list):
            return TaggedList([tag_with_provenance(child, receiver, func_code, call_num, lineno, col_offset, end_lineno, end_col_offset) for child in ret_obj], call_loc)
        elif isinstance(ret_obj, dict):
            return TaggedDict(ret_obj, call_loc)
        elif isinstance(ret_obj, int):
            return TaggedInt(ret_obj, call_loc)
        elif isinstance(ret_obj, float):
            return TaggedFloat(ret_obj, call_loc)
        return ret_obj


def ast_loc(node):
    return (node.lineno, node.col_offset, node.end_lineno, node.end_col_offset)

class ProvenanceTagger(ast.NodeTransformer):
    def __init__(self) -> None:
        self.call_nums = {}
        super().__init__()

    def visit_Call(self, node):
        node = self.generic_visit(node)

        # When the form is receiver.attribute(...), log that there is call on this receiver.
        match node:
            case ast.Call(func=ast.Attribute(value)):
                loc = ast_loc(node)
                func_code = ast.unparse(node.func)
                receiver = value
                call_num = self.call_nums.get(func_code, 0) + 1
                wrapped = ast.Call(
                    ast.Name("tag_with_provenance", ast.Load()),
                    [
                        node,
                        receiver,
                        ast.Constant(func_code),
                        ast.Constant(call_num),
                        ast.Constant(node.lineno),
                        ast.Constant(node.col_offset),
                        ast.Constant(node.end_lineno),
                        ast.Constant(node.end_col_offset),
                    ],
                    [],
                )
                self.call_nums[func_code] = call_num

                return wrapped
            case _:
                return node


# We need a new ProvenanceTagger each time, to reset call_nums
class RootProvenanceTagger:
    def visit(self, node):
        with Timer("ProvenanceTagger"):
            out = ProvenanceTagger().visit(node)
        # print(ast.unparse(out))
        return out


IPython.get_ipython().kernel.shell.ast_transformers = [RootProvenanceTagger()]


# -------------------------------------------------------- #
#                   Type serialization                     #
# -------------------------------------------------------- #
import mypy
import mypy.nodes
import mypy.build
import mypy.main
import mypy.options
import mypy.types
import mypy.server.update
import mypy.types
from visitor_mypy import TraverserVisitor
import mypy.subtypes
import pprint


def unparse_mypy_expr(expr: mypy.nodes.Expression):
    match expr:
        case None | mypy.nodes.EllipsisExpr():
            return None
        case mypy.nodes.IntExpr() | mypy.nodes.FloatExpr() | mypy.nodes.StrExpr():
            return repr(expr.value)
        case mypy.nodes.NameExpr():
            return expr.name
        case mypy.nodes.ListExpr():
            return f"[{', '.join([unparse_mypy_expr(e) for e in expr.items])}]"
        case _:
            return str(expr)


def add_pos_json(type_json_dict, node):
    type_json_dict["pos"] = {
        "line": node.line,
        "column": node.column,
        "end_line": node.end_line,
        "end_column": node.end_column,
    }
    return type_json_dict


def to_json_dict(node, type):
    type_json_dict = serialize_type(type)
    return add_pos_json(type_json_dict, node)


# MyPy's is_subtype accepts AnyType on both LHS and RHS, which is maddening.
# And I can't get its is_proper_subtype to reliable match things like tuples with e.g. Collection[Any] or ListLike
# So this version rejects bare AnyType as a subtype of everything (but is not recursive).
def is_subtype(subtype, type):
    subtype = mypy.types.get_proper_type(subtype)
    type = mypy.types.get_proper_type(type)

    if isinstance(subtype, mypy.types.AnyType) and not isinstance(type, mypy.types.AnyType):
        return False

    return mypy.subtypes.is_subtype(subtype, type)


# # Positional argument
# ARG_POS = 0
# # Positional, optional argument (functions only, not calls)
# ARG_OPT = 1
# # *arg argument
# ARG_STAR = 2
# # Keyword argument x=y in call, or keyword-only function arg
# ARG_NAMED = 3
# # **arg argument
# ARG_STAR2 = 4
# # In an argument list, keyword-only and also optional
# ARG_NAMED_OPT = 5

def callable_type_json(callable_type: mypy.types.CallableType, user_typed_snippets):
    type_json_dict = serialize_type(callable_type)  # <- Custom serializer

    if not isinstance(type_json_dict, dict):  # IDK why we sometimes get a string
        type_json_dict = dict()

    if hasattr(callable_type, "definition") and callable_type.definition and callable_type.definition.arguments:
        type_json_dict["default_code_by_arg_idx"] = [unparse_mypy_expr(arg.initializer) for arg in callable_type.definition.arguments]
        type_json_dict["arg_names_at_definition"] = [arg.variable.name for arg in callable_type.definition.arguments] # for positional arguments, mypy doesn't store the names in the arg_names list so we need to re-gen

    type_json_dict["type_compatible_code_snippets_by_arg_i"] = []
    for arg_type in callable_type.arg_types:
        compatible_snippets = [name for name, snippet_type in user_typed_snippets.items() if is_subtype(snippet_type, arg_type)]
        type_json_dict["type_compatible_code_snippets_by_arg_i"].append(compatible_snippets)

    return type_json_dict


class GatherTypedCalls(TraverserVisitor):
    def __init__(self, types_dict, user_typed_snippets):
        self.types_dict = types_dict
        self.user_typed_snippets = user_typed_snippets
        self.out = []

    def visit_call_expr(self, node: mypy.nodes.CallExpr) -> None:
        super().visit_call_expr(node)

        callee_type = self.types_dict.get(node.callee)

        # For overloads, assume first.
        while isinstance(callee_type, mypy.types.Overloaded):
            callee_type = callee_type.items[0]

        if isinstance(callee_type, mypy.types.CallableType):
            # loc = (node.line, node.column, node.end_line, node.end_column)
            given_args = []
            for arg, name, kind in zip(node.args, node.arg_names, node.arg_kinds):
                given_arg = to_json_dict(arg, self.types_dict.get(arg))
                given_arg["name"] = name
                # given_arg["kind"] = kind.value
                given_args.append(given_arg)

            # The callee_type here is partially applied (self is already removed from the argument list).
            # For consistency with places where where that is not the case, let us unapply it
            if callee_type.definition is not None:
                callee_type = callee_type.definition.type

            callee = callable_type_json(callee_type, self.user_typed_snippets)
            add_pos_json(callee, node.callee)

            self.out.append(
                {
                    "call": to_json_dict(node, self.types_dict.get(node)),
                    "callee": callee,
                    "given_args": given_args,
                }
            )

    # def visit_member_expr(self, node: mypy.nodes.MemberExpr) -> None:
    #     super().visit_member_expr(node)

    # def visit_name_expr(self, node: mypy.nodes.NameExpr) -> None:
    #     super().visit_name_expr(node)


class JsonDict:
    def __init__(self, dict):
        self.dict = dict

    def _repr_json_(self):
        return self.dict


# Custom serialize copied from mypy but that expands out the type alias...
# https://github.com/python/mypy/blob/16abf5cbe08c8b399381fc38220586cf2e49c2bc/mypy/types.py
def serialize_type(_type: mypy.types.Type) -> JsonDict:

    if isinstance(_type, mypy.types.Overloaded):
        return {
            ".class": "Overloaded",
            "items": [serialize_type(t) for t in _type.items],
        }

    if isinstance(_type, mypy.types.UnboundType):
        return {
            ".class": "UnboundType",
            "name": _type.name,
            "args": [serialize_type(a) for a in _type.args],
            "expr": _type.original_str_expr,
            "expr_fallback": _type.original_str_fallback,
        }

    if isinstance(_type, mypy.types.TypeVarType):
        return {
            ".class": "TypeVarType",
            "name": _type.name,
            "fullname": _type.fullname,
            "id": _type.id.raw_id,
            "namespace": _type.id.namespace,
            "values": [serialize_type(v) for v in _type.values],
            "upper_bound": serialize_type(_type.upper_bound),
            "default": serialize_type(_type.default),
            "variance": _type.variance,
        }

    if isinstance(_type, mypy.types.TypedDictType):
        return {
            ".class": "TypedDictType",
            "items": [[n, serialize_type(t)] for (n, t) in _type.items.items()],
            "required_keys": sorted(_type.required_keys),
            "fallback": serialize_type(_type.fallback),
        }

    if isinstance(_type, mypy.types.TupleType):
        return {
            ".class": "TupleType",
            "items": [serialize_type(t) for t in _type.items],
            "partial_fallback": serialize_type(_type.partial_fallback),
            "implicit": _type.implicit,
        }

    if isinstance(_type, mypy.types.LiteralType):
        return {
            ".class": "LiteralType",
            "value": _type.value,
            "fallback": serialize_type(_type.fallback),
        }

    if isinstance(_type, mypy.types.NoneType):
        return {".class": "NoneType"}

    if isinstance(_type, mypy.types.AnyType):
        return {
            ".class": "AnyType",
            "type_of_any": _type.type_of_any,
            "source_any": (serialize_type(_type.source_any.serialize) if _type.source_any is not None else None),
            "missing_import_name": _type.missing_import_name,
        }

    if isinstance(_type, mypy.types.UnionType):
        return {
            ".class": "UnionType",
            "items": [serialize_type(t) for t in _type.items],
        }

    if isinstance(_type, mypy.types.Instance):
        type_ref = _type.type.fullname
        if not _type.args and not _type.last_known_value:
            return {".class": "Instance", "type_ref": type_ref}

        data: JsonDict = {".class": "Instance"}
        data["type_ref"] = type_ref
        data["args"] = [serialize_type(arg) for arg in _type.args]
        if _type.last_known_value is not None:
            data["last_known_value"] = serialize_type(_type.last_known_value)
        return data

    if isinstance(_type, mypy.types.TypeAliasType):
        return {
            ".class": "TypeAliasType",
            "type_ref": _type.alias.fullname,
            "resolved": serialize_type(mypy.types.get_proper_type(_type)),
            "args": [serialize_type(arg) for arg in _type.args],
        }

    if isinstance(_type, mypy.types.CallableType):
        return {
            ".class": "CallableType",
            "arg_types": [serialize_type(t) for t in _type.arg_types],
            "arg_kinds": [int(x.value) for x in _type.arg_kinds],
            "arg_names": _type.arg_names,
            "ret_type": serialize_type(_type.ret_type),
            "fallback": serialize_type(_type.fallback),
            "name": _type.name,
            "variables": [serialize_type(v) for v in _type.variables],
            "is_ellipsis_args": _type.is_ellipsis_args,
            "implicit": _type.implicit,
            "bound_args": [(None if t is None else serialize_type(t)) for t in _type.bound_args],
            "def_extras": dict(_type.def_extras),
            "type_guard": (serialize_type(_type.type_guard) if _type.type_guard is not None else None),
            # "type_is": (serialize(_type.type_is) if _type.type_is is not None else None),
            "from_concatenate": _type.from_concatenate,
            "imprecise_arg_kinds": _type.imprecise_arg_kinds,
            "unpack_kwargs": _type.unpack_kwargs,
        }

    # print("Error type not implemented!", _type.__class__.__name__)

    return { ".class": _type.__class__.__name__ }
