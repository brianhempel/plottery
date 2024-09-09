from __future__ import annotations

import base64
import io
import json
import os
import sys
import pathlib
import re
import ast
import time
import keyword
from typing import Dict, List, Tuple

import IPython

import IPython.display
import mypy
import mypy.nodes
import mypy.build
import mypy.main
import mypy.options
import mypy.types
import mypy.server.update

import matplotlib as mpl
import matplotlib.pyplot as plt

import numpy as np

import shapely

# if 'snp_src_directory' not in globals():
#     snp_src_directory = os.getcwd()

snp_src_directory = os.path.dirname(os.path.abspath(__file__))
# print('snp_src_directory', snp_src_directory)

# sys.path.append(snp_src_directory)

import serialize
# import visitor_ast



# Suppress extra figure, speeds up responsiveness during direct manipulation
plt.switch_backend('module://matplotlib_inline.backend_inline') # register the display hook now rather than on creation of the first figure
plt.ioff() # turn off that display hook


def get_index_or_default(lst, i, default):
    try:
        return lst[i]
    except IndexError:
        return default

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
notebook_as_code_file_path = "__plottery_mypy_temp.py"
notebook_as_code_module_name = os.path.splitext(os.path.basename(notebook_as_code_file_path))[0]


import_lines_regex = re.compile(r"^[^#\n]*import .*", re.MULTILINE)
def import_lineset_in(code):
    """Returns a set of code lines that begin with `import `"""
    return set(import_lines_regex.findall(code))


# For caching
if "import_lineset" not in globals():
    import_lineset = set()
    mypy_fine_grained_build_manager = None
    mypy_result = None  # The FineGrainedBuildManager mutates this, apparently.
    mypy_fscache = None

def do_mypy_inference(code):
    # For caching
    global import_lineset
    global mypy_fine_grained_build_manager
    global mypy_result
    global mypy_fscache

    # Write out to a temp file
    with open(notebook_as_code_file_path, "w") as file:
        file.write(code)

    if mypy_fine_grained_build_manager is None or import_lineset != import_lineset_in(code):
        import_lineset = import_lineset_in(code)
        sources, options = mypy.main.process_options([notebook_as_code_file_path])

        options.incremental = True
        options.preserve_asts = True
        options.strict_optional = True
        options.warn_unused_configs = True
        options.fine_grained_incremental = True
        options.use_fine_grained_cache = True
        options.local_partial_types = True  # https://github.com/python/mypy/issues/4492
        options.mypy_path = [f"{snp_src_directory}/python-type-stubs-main/stubs"]
        # options.follow_imports = "silent"
        options.follow_imports_for_stubs = True
        options.export_types = True
        options.check_untyped_defs = True # Otherwise the bodies of user functions will not get inferred.
        options.ignore_errors = True

        mypy_fscache = mypy.fscache.FileSystemCache()  # IDK if this is needed
        mypy_result = mypy.build.build(sources, options=options, fscache=mypy_fscache)

        mypy_fine_grained_build_manager = mypy.server.update.FineGrainedBuildManager(mypy_result)

    mypy_fine_grained_build_manager.update([(notebook_as_code_module_name, notebook_as_code_file_path)], [])
    mypy_fine_grained_build_manager.flush_cache()
    mypy_fscache.flush()

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
    try:
        thing_type_node = type_graph[obj.__class__.__module__].tree
    except KeyError:
        # print(
        #     obj.__class__.__module__,
        #     obj.__class__.__qualname__,
        #     "not found",
        # )
        return None

    for class_name in obj.__class__.__qualname__.split("."):  # Handle inner nested classes correctly.
        if class_name in thing_type_node.names:
            thing_type_node = thing_type_node.names[class_name].node
        else:
            thing_type_node = None
            # print(
            #     obj.__class__.__module__,
            #     obj.__class__.__qualname__,
            #     "not found",
            # )
            break

    return thing_type_node


def flatten(lists):
    return sum(lists, [])  # https://stackoverflow.com/a/952946


def remove_nones(iter):
    return [x for x in iter if x is not None]


# def all_artists(artist):
#     if "get_children" in dir(artist):
#         return [artist] + flatten([all_artists(artist) for artist in artist.get_children()])
#     else:
#         return [artist]


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
                    if not hasattr(child, "_snp_came_from_call_id") and hasattr(container, "_snp_came_from_call_id"): # Don't overwrite if already set.
                        child._snp_came_from_call_id = container._snp_came_from_call_id

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
        case mpl.collections.PathCollection() as path_collection: # the thing created by a scatter plot
            # path_collection._offsets is the locations of the scatterplot points
            # path_collection._paths[0] is the shape of individual points
            # path_collection._sizes is the sizes of the points
            # path_collection.contains() will have the code to make sense of all of the above
            my_geom = None
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
            if isinstance(node.type, mypy.types.Overloaded):
                # First overload is our default signature for the method.
                return node.type.items[0]
            else:
                return node.type

    return None


def method_type_json(receiver, method_name, type_graph):
    typ = method_type(receiver, method_name, type_graph)
    return typ and serialize_type(typ, {})


# data-call-id indicates the artist was returned from a call, so that artist on the canvas should be associated with that call in the layers panel.

# Preserve heirarchical structure so that JS mouseenter events work as intended
def region2_to_svg_g(artist_methods_bounds_geom_children, artist_names):
    artist, methods, (fig_px_bounds, axes_px_bounds, axes_unit_bounds, region_px_bounds), geom, children = artist_methods_bounds_geom_children
    geom_svg = geom.svg()
    geom_svg = re.sub(r'fill="[^"]*"', 'fill="transparent"', geom_svg)  # can't be "none", otherwise no mouse events are triggered inside the region
    geom_svg = re.sub(r'stroke-width="[^"]*"', 'stroke-width="0"', geom_svg)
    child_svgs_str = "\n".join([region2_to_svg_g(child, artist_names) for child in children])

    name = shortest_qualified_name(artist_names.get(id(artist), (None, {}))[1])

    perhaps_name = f'data-artist-name="{name}"' if name is not None else ""
    perhaps_call_loc = f'data-call-id="{escape_html(artist._snp_came_from_call_id)}" data-fig-px-bounds="{json_for_attr(fig_px_bounds)}" data-axes-px-bounds="{json_for_attr(axes_px_bounds)}" data-axes-unit-bounds="{json_for_attr(axes_unit_bounds)}" data-region-px-bounds="{json_for_attr(region_px_bounds)}"' if hasattr(artist, "_snp_came_from_call_id") else ""
    return f"""<g data-artist="{str(artist)}" data-artist-id="{id(artist)}" {perhaps_name} {perhaps_call_loc}>
    {geom_svg}
    {child_svgs_str}
    </g>"""


def shortest_qualified_name(names):
    return min(names, key=lambda name: (name.count("."), len(name))) if len(names) > 0 else None

# Mutates out
def _artist_names_deep(out, obj, name, max_depth):
    if max_depth <= 0 or callable(obj):
        return

    if isinstance(obj, list) or (isinstance(obj, np.ndarray) and len(obj) <= 10):
        for i, item in enumerate(obj):
            _artist_names_deep(out, item, f"{name}[{str(i)}]", max_depth)
        if len(obj) >= 1:
            _artist_names_deep(out, obj[-1], f"{name}[-1]", max_depth)
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
                _artist_names_deep(out, prop, f"{name}.{prop_name}", max_depth - 1)

    # # Need this to get plt.subplots() to show up in the layers panel
    # elif obj is plt:
    #     out[id(obj)] = (obj, set())


# Returns a dict of object to (object, set of names)
#
# Used to find receivers for possible new method calls, which are all currently
# hard-coded in method_associations()
def artist_names(locals, user_nameset, max_depth=4):
    out = {}
    trivial_names = get_trivial_names()

    with mpl._api.deprecation.suppress_matplotlib_deprecation_warning():
        for name, value in [(name, value) for name, value in locals.items() if name in user_nameset and name not in trivial_names]:
            _artist_names_deep(out, value, f"{name}", max_depth)

    return out


# Use this to help generate the method_associations below
def methods_for(a, default_child_to_show_methods_on=''):
    def squish(string):
        return re.sub(r'\s+', ' ', string)

    for name in dir(a):
        if name.startswith('_'):
            continue
        doc = (getattr(a, name).__doc__ or '').strip().split('\n\n')[0]
        print(f"([{repr(default_child_to_show_methods_on)}], {repr(name)}, float('inf'), {repr(squish(doc))}),")

# snp.methods_for(ax, '.patch')
axes_method_associations = [
    # (['.patch'], 'ArtistList', float('inf'), 'A sublist of Axes children based on their type.'),
    (['.patch'], 'acorr', float('inf'), 'Plot the autocorrelation of *x*.'),
    # (['.patch'], 'add_artist', float('inf'), 'Add an `.Artist` to the Axes; return the artist.'),
    # (['.patch'], 'add_callback', float('inf'), 'Add a callback function that will be called whenever one of the'),
    # (['.patch'], 'add_child_axes', float('inf'), "Add an `.AxesBase` to the Axes' children; return the child Axes."),
    # (['.patch'], 'add_collection', float('inf'), 'Add a `.Collection` to the Axes; return the collection.'),
    # (['.patch'], 'add_container', float('inf'), "Add a `.Container` to the Axes' containers; return the container."),
    # (['.patch'], 'add_image', float('inf'), 'Add an `.AxesImage` to the Axes; return the image.'),
    # (['.patch'], 'add_line', float('inf'), 'Add a `.Line2D` to the Axes; return the line.'),
    # (['.patch'], 'add_patch', float('inf'), 'Add a `.Patch` to the Axes; return the patch.'),
    # (['.patch'], 'add_table', float('inf'), 'Add a `.Table` to the Axes; return the table.'),
    (['.patch'], 'angle_spectrum', float('inf'), 'Plot the angle spectrum.'),
    (['.patch'], 'annotate', float('inf'), 'Annotate the point *xy* with text *text*.'),
    # (['.patch'], 'apply_aspect', float('inf'), 'Adjust the Axes for a specified data aspect ratio.'),
    (['.patch'], 'arrow', float('inf'), 'Add an arrow to the Axes.'),
    # (['.patch'], 'artists', float('inf'), 'A sublist of Axes children based on their type.'),
    # (['.patch'], 'autoscale', float('inf'), 'Autoscale the axis view to the data (toggle).'),
    # (['.patch'], 'autoscale_view', float('inf'), 'Autoscale the view limits using the data limits.'),
    # (['.patch'], 'axes', float('inf'), 'An Axes object encapsulates all the elements of an individual (sub-)plot in'),
    (['.patch'], 'axhline', float('inf'), 'Add a horizontal line across the Axes.'),
    (['.patch'], 'axhspan', float('inf'), 'Add a horizontal span (rectangle) across the Axes.'),
    (['.patch'], 'axis', float('inf'), 'Convenience method to get or set some axis properties.'),
    # (['.patch'], 'axison', float('inf'), 'bool(x) -> bool'),
    (['.patch'], 'axline', float('inf'), 'Add an infinitely long straight line.'),
    (['.patch'], 'axvline', float('inf'), 'Add a vertical line across the Axes.'),
    (['.patch'], 'axvspan', float('inf'), 'Add a vertical span (rectangle) across the Axes.'),
    (['.patch'], 'bar', float('inf'), 'Make a bar plot.'),
    (['.patch'], 'bar_label', float('inf'), 'Label a bar plot.'),
    (['.patch'], 'barbs', float('inf'), 'Plot a 2D field of barbs.'),
    (['.patch'], 'barh', float('inf'), 'Make a horizontal bar plot.'),
    # (['.patch'], 'bbox', float('inf'), 'A `Bbox` that is automatically transformed by a given'),
    (['.patch'], 'boxplot', float('inf'), 'Draw a box and whisker plot.'),
    (['.patch'], 'broken_barh', float('inf'), 'Plot a horizontal sequence of rectangles.'),
    # (['.patch'], 'bxp', float('inf'), 'Drawing function for box and whisker plots.'),
    # (['.patch'], 'callbacks', float('inf'), 'Handle registering, processing, blocking, and disconnecting'),
    # (['.patch'], 'can_pan', float('inf'), 'Return whether this Axes supports any pan/zoom button functionality.'),
    # (['.patch'], 'can_zoom', float('inf'), 'Return whether this Axes supports the zoom box button functionality.'),
    # (['.patch'], 'child_axes', float('inf'), 'Built-in mutable sequence.'),
    # (['.patch'], 'cla', float('inf'), 'Clear the Axes.'),
    (['.patch'], 'clabel', float('inf'), 'Label a contour plot.'),
    # (['.patch'], 'clear', float('inf'), 'Clear the Axes.'),
    # (['.patch'], 'clipbox', float('inf'), ''),
    (['.patch'], 'cohere', float('inf'), 'Plot the coherence between *x* and *y*.'),
    # (['.patch'], 'collections', float('inf'), 'A sublist of Axes children based on their type.'),
    # (['.patch'], 'containers', float('inf'), 'Built-in mutable sequence.'),
    # (['.patch'], 'contains', float('inf'), ''),
    # (['.patch'], 'contains_point', float('inf'), 'Return whether *point* (pair of pixel coordinates) is inside the Axes'),
    (['.patch'], 'contour', float('inf'), 'Plot contour lines.'),
    (['.patch'], 'contourf', float('inf'), 'Plot filled contours.'),
    # (['.patch'], 'convert_xunits', float('inf'), 'Convert *x* using the unit type of the xaxis.'),
    # (['.patch'], 'convert_yunits', float('inf'), 'Convert *y* using the unit type of the yaxis.'),
    (['.patch'], 'csd', float('inf'), 'Plot the cross-spectral density.'),
    # (['.patch'], 'dataLim', float('inf'), 'A mutable bounding box.'),
    # (['.patch'], 'drag_pan', float('inf'), 'Called when the mouse moves during a pan operation.'),
    # (['.patch'], 'draw', float('inf'), ''),
    # (['.patch'], 'draw_artist', float('inf'), 'Efficiently redraw a single artist.'),
    (['.patch'], 'ecdf', float('inf'), 'Compute and plot the empirical cumulative distribution function of *x*.'),
    # (['.patch'], 'end_pan', float('inf'), 'Called when a pan operation completes (when the mouse button is up.)'),
    (['.patch'], 'errorbar', float('inf'), 'Plot y versus x as lines and/or markers with attached errorbars.'),
    (['.patch'], 'eventplot', float('inf'), 'Plot identical parallel lines at the given positions.'),
    # (['.patch'], 'figure', float('inf'), 'The top level container for all the plot elements.'),
    (['.patch'], 'fill', float('inf'), 'Plot filled polygons.'),
    (['.patch'], 'fill_between', float('inf'), 'Fill the area between two horizontal curves.'),
    (['.patch'], 'fill_betweenx', float('inf'), 'Fill the area between two vertical curves.'),
    # (['.patch'], 'findobj', float('inf'), 'Find artist objects.'),
    # (['.patch'], 'fmt_xdata', float('inf'), ''),
    # (['.patch'], 'fmt_ydata', float('inf'), ''),
    # (['.patch'], 'format_coord', float('inf'), 'Return a format string formatting the *x*, *y* coordinates.'),
    # (['.patch'], 'format_cursor_data', float('inf'), 'Return a string representation of *data*.'),
    # (['.patch'], 'format_xdata', float('inf'), 'Return *x* formatted as an x-value.'),
    # (['.patch'], 'format_ydata', float('inf'), 'Return *y* formatted as a y-value.'),
    # (['.patch'], 'get_adjustable', float('inf'), "Return whether the Axes will adjust its physical dimension ('box') or"),
    # (['.patch'], 'get_agg_filter', float('inf'), 'Return filter function to be used for agg filter.'),
    # (['.patch'], 'get_alpha', float('inf'), 'Return the alpha value used for blending - not supported on all'),
    # (['.patch'], 'get_anchor', float('inf'), 'Get the anchor location.'),
    # (['.patch'], 'get_animated', float('inf'), 'Return whether the artist is animated.'),
    # (['.patch'], 'get_aspect', float('inf'), 'Return the aspect ratio of the axes scaling.'),
    # (['.patch'], 'get_autoscale_on', float('inf'), 'Return True if each axis is autoscaled, False otherwise.'),
    # (['.patch'], 'get_autoscalex_on', float('inf'), 'Return whether the xaxis is autoscaled.'),
    # (['.patch'], 'get_autoscaley_on', float('inf'), 'Return whether the yaxis is autoscaled.'),
    # (['.patch'], 'get_axes_locator', float('inf'), 'Return the axes_locator.'),
    # (['.patch'], 'get_axisbelow', float('inf'), 'Get whether axis ticks and gridlines are above or below most artists.'),
    # (['.patch'], 'get_box_aspect', float('inf'), 'Return the Axes box aspect, i.e. the ratio of height to width.'),
    # (['.patch'], 'get_children', float('inf'), ''),
    # (['.patch'], 'get_clip_box', float('inf'), 'Return the clipbox.'),
    # (['.patch'], 'get_clip_on', float('inf'), 'Return whether the artist uses clipping.'),
    # (['.patch'], 'get_clip_path', float('inf'), 'Return the clip path.'),
    # (['.patch'], 'get_cursor_data', float('inf'), 'Return the cursor data for a given event.'),
    # (['.patch'], 'get_data_ratio', float('inf'), 'Return the aspect ratio of the scaled data.'),
    # (['.patch'], 'get_default_bbox_extra_artists', float('inf'), 'Return a default list of artists that are used for the bounding box'),
    # (['.patch'], 'get_facecolor', float('inf'), 'Get the facecolor of the Axes.'),
    # (['.patch'], 'get_fc', float('inf'), 'Alias for `get_facecolor`.'),
    # (['.patch'], 'get_figure', float('inf'), 'Return the `.Figure` instance the artist belongs to.'),
    # (['.patch'], 'get_frame_on', float('inf'), 'Get whether the Axes rectangle patch is drawn.'),
    # (['.patch'], 'get_gid', float('inf'), 'Return the group id.'),
    # (['.patch'], 'get_gridspec', float('inf'), 'Return the `.GridSpec` associated with the subplot, or None.'),
    # (['.patch'], 'get_images', float('inf'), 'Return a list of `.AxesImage`\\s contained by the Axes.'),
    # (['.patch'], 'get_in_layout', float('inf'), 'Return boolean flag, ``True`` if artist is included in layout'),
    # (['.patch'], 'get_label', float('inf'), 'Return the label used for this artist in the legend.'),
    # (['.patch'], 'get_legend', float('inf'), 'Return the `.Legend` instance, or None if no legend is defined.'),
    # (['.patch'], 'get_legend_handles_labels', float('inf'), 'Return handles and labels for legend'),
    # (['.patch'], 'get_lines', float('inf'), 'Return a list of lines contained by the Axes.'),
    # (['.patch'], 'get_mouseover', float('inf'), 'Return whether this artist is queried for custom context information'),
    # (['.patch'], 'get_navigate', float('inf'), 'Get whether the Axes responds to navigation commands.'),
    # (['.patch'], 'get_navigate_mode', float('inf'), "Get the navigation toolbar button status: 'PAN', 'ZOOM', or None."),
    # (['.patch'], 'get_path_effects', float('inf'), ''),
    # (['.patch'], 'get_picker', float('inf'), 'Return the picking behavior of the artist.'),
    # (['.patch'], 'get_position', float('inf'), 'Return the position of the Axes within the figure as a `.Bbox`.'),
    # (['.patch'], 'get_rasterization_zorder', float('inf'), 'Return the zorder value below which artists will be rasterized.'),
    # (['.patch'], 'get_rasterized', float('inf'), 'Return whether the artist is to be rasterized.'),
    # (['.patch'], 'get_shared_x_axes', float('inf'), 'Return an immutable view on the shared x-axes Grouper.'),
    # (['.patch'], 'get_shared_y_axes', float('inf'), 'Return an immutable view on the shared y-axes Grouper.'),
    # (['.patch'], 'get_sketch_params', float('inf'), 'Return the sketch parameters for the artist.'),
    # (['.patch'], 'get_snap', float('inf'), 'Return the snap setting.'),
    # (['.patch'], 'get_subplotspec', float('inf'), 'Return the `.SubplotSpec` associated with the subplot, or None.'),
    # (['.patch'], 'get_tightbbox', float('inf'), 'Return the tight bounding box of the Axes, including axis and their'),
    # (['.patch'], 'get_title', float('inf'), 'Get an Axes title.'),
    # (['.patch'], 'get_transform', float('inf'), 'Return the `.Transform` instance used by this artist.'),
    # (['.patch'], 'get_transformed_clip_path_and_affine', float('inf'), 'Return the clip path with the non-affine part of its'),
    # (['.patch'], 'get_url', float('inf'), 'Return the url.'),
    # (['.patch'], 'get_visible', float('inf'), 'Return the visibility.'),
    # (['.patch'], 'get_window_extent', float('inf'), 'Return the Axes bounding box in display space.'),
    # (['.patch'], 'get_xaxis', float('inf'), '[*Discouraged*] Return the XAxis instance.'),
    # (['.patch'], 'get_xaxis_text1_transform', float('inf'), 'Returns'),
    # (['.patch'], 'get_xaxis_text2_transform', float('inf'), 'Returns'),
    # (['.patch'], 'get_xaxis_transform', float('inf'), 'Get the transformation used for drawing x-axis labels, ticks'),
    # (['.patch'], 'get_xbound', float('inf'), 'Return the lower and upper x-axis bounds, in increasing order.'),
    # (['.patch'], 'get_xgridlines', float('inf'), "Return the xaxis' grid lines as a list of `.Line2D`\\s."),
    # (['.patch'], 'get_xlabel', float('inf'), 'Get the xlabel text string.'),
    # (['.patch'], 'get_xlim', float('inf'), 'Return the x-axis view limits.'),
    # (['.patch'], 'get_xmajorticklabels', float('inf'), "Return the xaxis' major tick labels, as a list of `~.text.Text`."),
    # (['.patch'], 'get_xminorticklabels', float('inf'), "Return the xaxis' minor tick labels, as a list of `~.text.Text`."),
    # (['.patch'], 'get_xscale', float('inf'), "Return the xaxis' scale (as a str)."),
    # (['.patch'], 'get_xticklabels', float('inf'), "Get the xaxis' tick labels."),
    # (['.patch'], 'get_xticklines', float('inf'), "Return the xaxis' tick lines as a list of `.Line2D`\\s."),
    # (['.patch'], 'get_xticks', float('inf'), "Return the xaxis' tick locations in data coordinates."),
    # (['.patch'], 'get_yaxis', float('inf'), '[*Discouraged*] Return the YAxis instance.'),
    # (['.patch'], 'get_yaxis_text1_transform', float('inf'), 'Returns'),
    # (['.patch'], 'get_yaxis_text2_transform', float('inf'), 'Returns'),
    # (['.patch'], 'get_yaxis_transform', float('inf'), 'Get the transformation used for drawing y-axis labels, ticks'),
    # (['.patch'], 'get_ybound', float('inf'), 'Return the lower and upper y-axis bounds, in increasing order.'),
    # (['.patch'], 'get_ygridlines', float('inf'), "Return the yaxis' grid lines as a list of `.Line2D`\\s."),
    # (['.patch'], 'get_ylabel', float('inf'), 'Get the ylabel text string.'),
    # (['.patch'], 'get_ylim', float('inf'), 'Return the y-axis view limits.'),
    # (['.patch'], 'get_ymajorticklabels', float('inf'), "Return the yaxis' major tick labels, as a list of `~.text.Text`."),
    # (['.patch'], 'get_yminorticklabels', float('inf'), "Return the yaxis' minor tick labels, as a list of `~.text.Text`."),
    # (['.patch'], 'get_yscale', float('inf'), "Return the yaxis' scale (as a str)."),
    # (['.patch'], 'get_yticklabels', float('inf'), "Get the yaxis' tick labels."),
    # (['.patch'], 'get_yticklines', float('inf'), "Return the yaxis' tick lines as a list of `.Line2D`\\s."),
    # (['.patch'], 'get_yticks', float('inf'), "Return the yaxis' tick locations in data coordinates."),
    # (['.patch'], 'get_zorder', float('inf'), "Return the artist's zorder."),
    (['.patch'], 'grid', 1, 'Configure the grid lines.'),
    # (['.patch'], 'has_data', float('inf'), 'Return whether any artists have been added to the Axes.'),
    # (['.patch'], 'have_units', float('inf'), 'Return whether units are set on any axis.'),
    (['.patch'], 'hexbin', float('inf'), 'Make a 2D hexagonal binning plot of points *x*, *y*.'),
    (['.patch'], 'hist', float('inf'), 'Compute and plot a histogram.'),
    (['.patch'], 'hist2d', float('inf'), 'Make a 2D histogram plot.'),
    (['.patch'], 'hlines', float('inf'), 'Plot horizontal lines at each *y* from *xmin* to *xmax*.'),
    # (['.patch'], 'ignore_existing_data_limits', float('inf'), 'bool(x) -> bool'),
    # (['.patch'], 'images', float('inf'), 'A sublist of Axes children based on their type.'),
    (['.patch'], 'imshow', float('inf'), 'Display data as an image, i.e., on a 2D regular raster.'),
    # (['.patch'], 'in_axes', float('inf'), 'Return whether the given event (in display coords) is in the Axes.'),
    (['.patch'], 'indicate_inset', float('inf'), 'Add an inset indicator to the Axes. This is a rectangle on the plot at the position indicated by *bounds* that optionally has lines that connect the rectangle to an inset Axes (`.Axes.inset_axes`).'),
    (['.patch'], 'indicate_inset_zoom', float('inf'), 'Add an inset indicator rectangle to the Axes based on the axis limits for an *inset_ax* and draw connectors between *inset_ax* and the rectangle.'),
    # (['.patch'], 'inset_axes', float('inf'), 'Add a child inset Axes to this existing Axes.'),
    (['.xaxis'], 'invert_xaxis', float('inf'), 'Invert the x-axis.'),
    (['.yaxis'], 'invert_yaxis', float('inf'), 'Invert the y-axis.'),
    # (['.patch'], 'is_transform_set', float('inf'), 'Return whether the Artist has an explicitly set transform.'),
    # (['.patch'], 'label_outer', float('inf'), 'Only show "outer" labels and tick labels.'),
    (['.patch'], 'legend', float('inf'), 'Place a legend on the Axes.'),
    # (['.patch'], 'legend_', float('inf'), 'Place a legend on the figure/axes.'),
    # (['.patch'], 'lines', float('inf'), 'A sublist of Axes children based on their type.'),
    # (['.patch'], 'locator_params', float('inf'), 'Control behavior of major tick locators.'),
    (['.patch'], 'loglog', float('inf'), 'Make a plot with log scaling on both the x- and y-axis.'),
    (['.patch'], 'magnitude_spectrum', float('inf'), 'Plot the magnitude spectrum.'),
    # (['.patch'], 'margins', float('inf'), 'Set or retrieve autoscaling margins.'),
    (['.patch'], 'matshow', float('inf'), 'Plot the values of a 2D matrix or array as color-coded image.'),
    # (['.patch'], 'minorticks_off', float('inf'), 'Remove minor ticks from the Axes.'),
    # (['.patch'], 'minorticks_on', float('inf'), 'Display minor ticks on the Axes.'),
    # (['.patch'], 'mouseover', float('inf'), 'bool(x) -> bool'),
    # (['.patch'], 'name', float('inf'), "str(object='') -> str"),
    # (['.patch'], 'patch', float('inf'), 'A rectangle defined via an anchor point *xy* and its *width* and *height*.'),
    # (['.patch'], 'patches', float('inf'), 'A sublist of Axes children based on their type.'),
    # (['.patch'], 'pchanged', float('inf'), 'Call all of the registered callbacks.'),
    (['.patch'], 'pcolor', float('inf'), 'Create a pseudocolor plot with a non-regular rectangular grid.'),
    (['.patch'], 'pcolorfast', float('inf'), 'Create a pseudocolor plot with a non-regular rectangular grid.'),
    (['.patch'], 'pcolormesh', float('inf'), 'Create a pseudocolor plot with a non-regular rectangular grid.'),
    (['.patch'], 'phase_spectrum', float('inf'), 'Plot the phase spectrum.'),
    # (['.patch'], 'pick', float('inf'), 'Process a pick event.'),
    # (['.patch'], 'pickable', float('inf'), 'Return whether the artist is pickable.'),
    (['.patch'], 'pie', float('inf'), 'Plot a pie chart.'),
    (['.patch'], 'plot', float('inf'), 'Plot y versus x as lines and/or markers.'),
    (['.patch'], 'plot_date', float('inf'), '[*Discouraged*] Plot coercing the axis to treat floats as dates.'),
    # (['.patch'], 'properties', float('inf'), 'Return a dictionary of all the properties of the artist.'),
    (['.patch'], 'psd', float('inf'), 'Plot the power spectral density.'),
    (['.patch'], 'quiver', float('inf'), 'Plot a 2D field of arrows.'),
    (['.patch'], 'quiverkey', float('inf'), 'Add a key to a quiver plot.'),
    # (['.patch'], 'redraw_in_frame', float('inf'), 'Efficiently redraw Axes data, but not axis ticks, labels, etc.'),
    # (['.patch'], 'relim', float('inf'), 'Recompute the data limits based on current artists.'),
    # (['.patch'], 'remove', float('inf'), 'Remove the artist from the figure if possible.'),
    # (['.patch'], 'remove_callback', float('inf'), 'Remove a callback based on its observer id.'),
    # (['.patch'], 'reset_position', float('inf'), 'Reset the active position to the original position.'),
    (['.patch'], 'scatter', float('inf'), 'A scatter plot of *y* vs. *x* with varying marker size and/or color.'),
    (['.patch'], 'secondary_xaxis', 1, 'Add a second x-axis to this `~.axes.Axes`.'),
    (['.patch'], 'secondary_yaxis', 1, 'Add a second y-axis to this `~.axes.Axes`.'),
    (['.patch'], 'semilogx', float('inf'), 'Make a plot with log scaling on the x-axis.'),
    (['.patch'], 'semilogy', float('inf'), 'Make a plot with log scaling on the y-axis.'),
    # (['.patch'], 'set', 1, 'Set multiple properties at once.'),
    # (['.patch'], 'set_adjustable', 1, 'Set how the Axes adjusts to achieve the required aspect ratio.'),
    # (['.patch'], 'set_agg_filter', 1, 'Set the agg filter.'),
    # (['.patch'], 'set_alpha', 1, 'Set the alpha value used for blending - not supported on all backends.'),
    # (['.patch'], 'set_anchor', 1, 'Define the anchor location.'),
    # (['.patch'], 'set_animated', 1, 'Set whether the artist is intended to be used in an animation.'),
    # (['.patch'], 'set_aspect', 1, 'Set the aspect ratio of the axes scaling, i.e. y/x-scale.'),
    # (['.patch'], 'set_autoscale_on', 1, 'Set whether autoscaling is applied to each axis on the next draw or'),
    # (['.patch'], 'set_autoscalex_on', 1, 'Set whether the xaxis is autoscaled when drawing or by'),
    # (['.patch'], 'set_autoscaley_on', 1, 'Set whether the yaxis is autoscaled when drawing or by'),
    # (['.patch'], 'set_axes_locator', 1, 'Set the Axes locator.'),
    # (['.patch'], 'set_axis_off', 1, 'Hide all visual components of the x- and y-axis.'),
    # (['.patch'], 'set_axis_on', 1, 'Do not hide all visual components of the x- and y-axis.'),
    # (['.patch'], 'set_axisbelow', 1, 'Set whether axis ticks and gridlines are above or below most artists.'),
    # (['.patch'], 'set_box_aspect', 1, 'Set the Axes box aspect, i.e. the ratio of height to width.'),
    # (['.patch'], 'set_clip_box', 1, "Set the artist's clip `.Bbox`."),
    # (['.patch'], 'set_clip_on', 1, 'Set whether the artist uses clipping.'),
    # (['.patch'], 'set_clip_path', 1, "Set the artist's clip path."),
    # (['.patch'], 'set_facecolor', 1, 'Set the facecolor of the Axes.'),
    # (['.patch'], 'set_fc', 1, 'Alias for `set_facecolor`.'),
    # (['.patch'], 'set_figure', 1, ''),
    # (['.patch'], 'set_frame_on', 1, 'Set whether the Axes rectangle patch is drawn.'),
    # (['.patch'], 'set_gid', 1, 'Set the (group) id for the artist.'),
    # (['.patch'], 'set_in_layout', 1, 'Set if artist is to be included in layout calculations,'),
    # (['.patch'], 'set_label', 1, 'Set a label that will be displayed in the legend.'),
    # (['.patch'], 'set_mouseover', 1, 'Set whether this artist is queried for custom context information when'),
    # (['.patch'], 'set_navigate', 1, 'Set whether the Axes responds to navigation toolbar commands.'),
    # (['.patch'], 'set_navigate_mode', 1, 'Set the navigation toolbar button status.'),
    # (['.patch'], 'set_path_effects', 1, 'Set the path effects.'),
    # (['.patch'], 'set_picker', 1, 'Define the picking behavior of the artist.'),
    # (['.patch'], 'set_position', 1, 'Set the Axes position.'),
    # (['.patch'], 'set_prop_cycle', 1, 'Set the property cycle of the Axes.'),
    # (['.patch'], 'set_rasterization_zorder', 1, 'Set the zorder threshold for rasterization for vector graphics output.'),
    # (['.patch'], 'set_rasterized', 1, 'Force rasterized (bitmap) drawing for vector graphics output.'),
    # (['.patch'], 'set_sketch_params', 1, 'Set the sketch parameters.'),
    # (['.patch'], 'set_snap', 1, 'Set the snapping behavior.'),
    # (['.patch'], 'set_subplotspec', 1, 'Set the `.SubplotSpec`. associated with the subplot.'),
    (['.title'], 'set_title', 1, 'Set a title for the Axes.'),
    # (['.patch'], 'set_transform', 1, 'Set the artist transform.'),
    # (['.patch'], 'set_url', 1, 'Set the url for the artist.'),
    # (['.patch'], 'set_visible', 1, "Set the artist's visibility."),
    # (['.patch'], 'set_xbound', 1, 'Set the lower and upper numerical bounds of the x-axis.'),
    (['.xaxis.label'], 'set_xlabel', 1, 'Set the label for the x-axis.'),
    (['.xaxis'], 'set_xlim', 1, 'Set the x-axis view limits.'),
    # (['.patch'], 'set_xmargin', 1, 'Set padding of X data limits prior to autoscaling.'),
    # (['.patch'], 'set_xscale', 1, "Set the xaxis' scale."),
    (['.xaxis'], 'set_xticklabels', 1, "[*Discouraged*] Set the xaxis' tick labels with list of string labels."),
    (['.xaxis'], 'set_xticks', 1, "Set the xaxis' tick locations and optionally tick labels."),
    # (['.patch'], 'set_ybound', 1, 'Set the lower and upper numerical bounds of the y-axis.'),
    (['.yaxis.label'], 'set_ylabel', 1, 'Set the label for the y-axis.'),
    (['.yaxis'], 'set_ylim', 1, 'Set the y-axis view limits.'),
    # (['.patch'], 'set_ymargin', 1, 'Set padding of Y data limits prior to autoscaling.'),
    # (['.patch'], 'set_yscale', 1, "Set the yaxis' scale."),
    (['.yaxis'], 'set_yticklabels', 1, "[*Discouraged*] Set the yaxis' tick labels with list of string labels."),
    (['.yaxis'], 'set_yticks', 1, "Set the yaxis' tick locations and optionally tick labels."),
    # (['.patch'], 'set_zorder', 1, 'Set the zorder for the artist.  Artists with lower zorder'),
    (['.xaxis'], 'sharex', 1, 'Share the x-axis with *other*.'),
    (['.yaxis'], 'sharey', 1, 'Share the y-axis with *other*.'),
    (['.patch'], 'specgram', float('inf'), 'Plot a spectrogram.'),
    (['.patch'], 'spines', float('inf'), 'The container of all `.Spine`\\s in an Axes.'),
    (['.patch'], 'spy', float('inf'), 'Plot the sparsity pattern of a 2D array.'),
    (['.patch'], 'stackplot', float('inf'), 'Draw a stacked area plot.'),
    (['.patch'], 'stairs', float('inf'), 'A stepwise constant function as a line with bounding edges or a filled plot.'),
    # (['.patch'], 'stale', float('inf'), 'bool(x) -> bool'),
    # (['.patch'], 'stale_callback', float('inf'), ''),
    # (['.patch'], 'start_pan', float('inf'), 'Called when a pan operation has started.'),
    (['.patch'], 'stem', float('inf'), 'Create a stem plot.'),
    (['.patch'], 'step', float('inf'), 'Make a step plot.'),
    # (['.patch'], 'sticky_edges', float('inf'), '_XYPair(x, y)'),
    (['.patch'], 'streamplot', float('inf'), 'Draw streamlines of a vector flow.'),
    (['.patch'], 'table', float('inf'), 'Add a table to an `~.axes.Axes`.'),
    # (['.patch'], 'tables', float('inf'), 'A sublist of Axes children based on their type.'),
    (['.patch'], 'text', float('inf'), 'Add text to the Axes.'),
    # (['.patch'], 'texts', float('inf'), 'A sublist of Axes children based on their type.'),
    (['.patch'], 'tick_params', 1, 'Change the appearance of ticks, tick labels, and gridlines.'),
    # (['.patch'], 'ticklabel_format', float('inf'), 'Configure the `.ScalarFormatter` used by default for linear Axes.'),
    # (['.patch'], 'title', float('inf'), 'Handle storing and drawing of text in window or data coordinates.'),
    # (['.patch'], 'titleOffsetTrans', float('inf'), 'A transformation that translates by *xt* and *yt*, after *xt* and *yt*'),
    # (['.patch'], 'transAxes', float('inf'), '`BboxTransformTo` is a transformation that linearly transforms points from'),
    # (['.patch'], 'transData', float('inf'), 'A composite transform formed by applying transform *a* then'),
    # (['.patch'], 'transLimits', float('inf'), '`BboxTransformFrom` linearly transforms points from a given `Bbox` to the'),
    # (['.patch'], 'transScale', float('inf'), 'A helper class that holds a single child transform and acts'),
    (['.patch'], 'tricontour', float('inf'), 'Draw contour lines on an unstructured triangular grid.'),
    (['.patch'], 'tricontourf', float('inf'), 'Draw contour regions on an unstructured triangular grid.'),
    (['.patch'], 'tripcolor', float('inf'), 'Create a pseudocolor plot of an unstructured triangular grid.'),
    (['.patch'], 'triplot', float('inf'), 'Draw an unstructured triangular grid as lines and/or markers.'),
    (['.patch'], 'twinx', float('inf'), 'Create a twin Axes sharing the xaxis.'),
    (['.patch'], 'twiny', float('inf'), 'Create a twin Axes sharing the yaxis.'),
    # (['.patch'], 'update', float('inf'), "Update this artist's properties from the dict *props*."),
    # (['.patch'], 'update_datalim', float('inf'), 'Extend the `~.Axes.dataLim` Bbox to include the given points.'),
    # (['.patch'], 'update_from', float('inf'), 'Copy properties from *other* to *self*.'),
    # (['.patch'], 'use_sticky_edges', float('inf'), 'bool(x) -> bool'),
    # (['.patch'], 'viewLim', float('inf'), 'A mutable bounding box.'),
    # (['.patch'], 'violin', float('inf'), 'Drawing function for violin plots.'),
    (['.patch'], 'violinplot', float('inf'), 'Make a violin plot.'),
    (['.patch'], 'vlines', float('inf'), 'Plot vertical lines at each *x* from *ymin* to *ymax*.'),
    # (['.patch'], 'xaxis', float('inf'), ''),
    (['.xaxis'], 'xaxis_date', 1, 'Set up axis ticks and labels to treat data along the xaxis as dates.'),
    # (['.patch'], 'xaxis_inverted', float('inf'), 'Return whether the xaxis is oriented in the "inverse" direction.'),
    (['.patch'], 'xcorr', float('inf'), 'Plot the cross correlation between *x* and *y*.'),
    # (['.patch'], 'yaxis', float('inf'), ''),
    (['.yaxis'], 'yaxis_date', 1, 'Set up axis ticks and labels to treat data along the yaxis as dates.'),
    # (['.patch'], 'yaxis_inverted', float('inf'), 'Return whether the yaxis is oriented in the "inverse" direction.'),
    # (['.patch'], 'zorder', float('inf'), 'int([x]) -> integer'),

    # (['.title'], 'set_title', 1),
    # (['.xaxis'], 'set_xticks', 1),
    # (['.xaxis'], 'set_xlabel', 1),
    # (['.yaxis'], 'set_yticks', 1),
    # (['.yaxis'], 'set_ylabel', 1),
    # (['.yaxis.majorTicks[0].label1'], 'set_ylim', 1),
    # (['.yaxis.majorTicks[0].label2'], 'set_ylim', 1),
    # (['.yaxis._update_ticks()[-1].label1'], 'set_ylim', 1), # For some reason, majorTicks may include ticks outside the axis limits; _update_ticks() doesn't
    # (['.yaxis._update_ticks()[-1].label2'], 'set_ylim', 1), # For some reason, majorTicks may include ticks outside the axis limits; _update_ticks() doesn't
    # ([''], 'bar', float('inf')),
    # ([''], 'barh', float('inf')),
    # ([''], 'plot', float('inf')),
    # ([''], 'legend', 1),
    # ([''], 'axhline', float('inf')),
    # ([''], 'axvline', float('inf')),
    # ([''], 'bar_label', float('inf')),
]

# snp.methods_for(fig)
fig_method_associations = [
    # ([''], 'add_artist', float('inf'), 'Add an `.Artist` to the figure.'),
    # ([''], 'add_axes', float('inf'), 'Add an `~.axes.Axes` to the figure.'),
    # ([''], 'add_axobserver', float('inf'), 'Whenever the Axes state change, ``func(self)`` will be called.'),
    # ([''], 'add_callback', float('inf'), "Add a callback function that will be called whenever one of the `.Artist`'s properties changes."),
    # ([''], 'add_gridspec', float('inf'), 'Low-level API for creating a `.GridSpec` that has this figure as a parent.'),
    # ([''], 'add_subfigure', float('inf'), 'Add a `.SubFigure` to the figure as part of a subplot arrangement.'),
    ([''], 'add_subplot', float('inf'), 'Add an `~.axes.Axes` to the figure as part of a subplot arrangement.'),
    ([''], 'align_labels', 1, 'Align the xlabels and ylabels of subplots with the same subplots row or column (respectively) if label alignment is being done automatically (i.e. the label position is not manually set).'),
    ([''], 'align_titles', 1, 'Align the titles of subplots in the same subplot row if title alignment is being done automatically (i.e. the title position is not manually set).'),
    ([''], 'align_xlabels', 1, 'Align the xlabels of subplots in the same subplot row if label alignment is being done automatically (i.e. the label position is not manually set).'),
    ([''], 'align_ylabels', 1, 'Align the ylabels of subplots in the same subplot column if label alignment is being done automatically (i.e. the label position is not manually set).'),
    # ([''], 'artists', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'autofmt_xdate', float('inf'), 'Date ticklabels often overlap, so it is useful to rotate them and right align them. Also, a common use case is a number of subplots with shared x-axis where the x-axis is date data. The ticklabels are often long, and it helps to rotate them on the bottom subplot and turn them off on other subplots, as well as turn off xlabels.'),
    # ([''], 'axes', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'bbox', float('inf'), 'A `Bbox` that is automatically transformed by a given transform. When either the child bounding box or transform changes, the bounds of this bbox will update accordingly.'),
    # ([''], 'bbox_inches', float('inf'), 'A mutable bounding box.'),
    # ([''], 'canvas', float('inf'), ''),
    # ([''], 'clear', float('inf'), ''),
    # ([''], 'clf', float('inf'), '[*Discouraged*] Alias for the `clear()` method.'),
    # ([''], 'clipbox', float('inf'), ''),
    # ([''], 'colorbar', float('inf'), 'Add a colorbar to a plot.'),
    # ([''], 'contains', float('inf'), 'Test whether the mouse event occurred on the figure.'),
    # ([''], 'convert_xunits', float('inf'), 'Convert *x* using the unit type of the xaxis.'),
    # ([''], 'convert_yunits', float('inf'), 'Convert *y* using the unit type of the yaxis.'),
    # ([''], 'delaxes', float('inf'), 'Remove the `~.axes.Axes` *ax* from the figure; update the current Axes.'),
    # ([''], 'dpi', float('inf'), 'Convert a string or number to a floating point number, if possible.'),
    # ([''], 'dpi_scale_trans', float('inf'), 'A mutable 2D affine transformation.'),
    # ([''], 'draw', float('inf'), ''),
    # ([''], 'draw_artist', float('inf'), 'Draw `.Artist` *a* only.'),
    # ([''], 'draw_without_rendering', float('inf'), 'Draw the figure with no output. Useful to get the final size of artists that require a draw before their size is known (e.g. text).'),
    # ([''], 'figbbox', float('inf'), 'A `Bbox` that is automatically transformed by a given transform. When either the child bounding box or transform changes, the bounds of this bbox will update accordingly.'),
    # ([''], 'figimage', float('inf'), 'Add a non-resampled image to the figure.'),
    # ([''], 'figure', float('inf'), 'The top level container for all the plot elements.'),
    # ([''], 'findobj', float('inf'), 'Find artist objects.'),
    # ([''], 'format_cursor_data', float('inf'), 'Return a string representation of *data*.'),
    # ([''], 'frameon', float('inf'), 'bool(x) -> bool'),
    # ([''], 'gca', float('inf'), 'Get the current Axes.'),
    # ([''], 'get_agg_filter', float('inf'), 'Return filter function to be used for agg filter.'),
    # ([''], 'get_alpha', float('inf'), 'Return the alpha value used for blending - not supported on all backends.'),
    # ([''], 'get_animated', float('inf'), 'Return whether the artist is animated.'),
    # ([''], 'get_axes', float('inf'), 'List of Axes in the Figure. You can access and modify the Axes in the Figure through this list.'),
    # ([''], 'get_children', float('inf'), 'Get a list of artists contained in the figure.'),
    # ([''], 'get_clip_box', float('inf'), 'Return the clipbox.'),
    # ([''], 'get_clip_on', float('inf'), 'Return whether the artist uses clipping.'),
    # ([''], 'get_clip_path', float('inf'), 'Return the clip path.'),
    # ([''], 'get_constrained_layout', float('inf'), 'Return whether constrained layout is being used.'),
    # ([''], 'get_constrained_layout_pads', float('inf'), '[*Deprecated*] Get padding for ``constrained_layout``.'),
    # ([''], 'get_cursor_data', float('inf'), 'Return the cursor data for a given event.'),
    # ([''], 'get_default_bbox_extra_artists', float('inf'), 'Return a list of Artists typically used in `.Figure.get_tightbbox`.'),
    # ([''], 'get_dpi', float('inf'), 'Return the resolution in dots per inch as a float.'),
    # ([''], 'get_edgecolor', float('inf'), 'Get the edge color of the Figure rectangle.'),
    # ([''], 'get_facecolor', float('inf'), 'Get the face color of the Figure rectangle.'),
    # ([''], 'get_figheight', float('inf'), 'Return the figure height in inches.'),
    # ([''], 'get_figure', float('inf'), 'Return the `.Figure` instance the artist belongs to.'),
    # ([''], 'get_figwidth', float('inf'), 'Return the figure width in inches.'),
    # ([''], 'get_frameon', float('inf'), "Return the figure's background patch visibility, i.e. whether the figure background will be drawn. Equivalent to ``Figure.patch.get_visible()``."),
    # ([''], 'get_gid', float('inf'), 'Return the group id.'),
    # ([''], 'get_in_layout', float('inf'), 'Return boolean flag, ``True`` if artist is included in layout calculations.'),
    # ([''], 'get_label', float('inf'), 'Return the label used for this artist in the legend.'),
    # ([''], 'get_layout_engine', float('inf'), ''),
    # ([''], 'get_linewidth', float('inf'), 'Get the line width of the Figure rectangle.'),
    # ([''], 'get_mouseover', float('inf'), 'Return whether this artist is queried for custom context information when the mouse cursor moves over it.'),
    # ([''], 'get_path_effects', float('inf'), ''),
    # ([''], 'get_picker', float('inf'), 'Return the picking behavior of the artist.'),
    # ([''], 'get_rasterized', float('inf'), 'Return whether the artist is to be rasterized.'),
    # ([''], 'get_size_inches', float('inf'), 'Return the current size of the figure in inches.'),
    # ([''], 'get_sketch_params', float('inf'), 'Return the sketch parameters for the artist.'),
    # ([''], 'get_snap', float('inf'), 'Return the snap setting.'),
    # ([''], 'get_suptitle', float('inf'), 'Return the suptitle as string or an empty string if not set.'),
    # ([''], 'get_supxlabel', float('inf'), 'Return the supxlabel as string or an empty string if not set.'),
    # ([''], 'get_supylabel', float('inf'), 'Return the supylabel as string or an empty string if not set.'),
    # ([''], 'get_tight_layout', float('inf'), 'Return whether `.Figure.tight_layout` is called when drawing.'),
    # ([''], 'get_tightbbox', float('inf'), 'Return a (tight) bounding box of the figure *in inches*.'),
    # ([''], 'get_transform', float('inf'), 'Return the `.Transform` instance used by this artist.'),
    # ([''], 'get_transformed_clip_path_and_affine', float('inf'), 'Return the clip path with the non-affine part of its transformation applied, and the remaining affine part of its transformation.'),
    # ([''], 'get_url', float('inf'), 'Return the url.'),
    # ([''], 'get_visible', float('inf'), 'Return the visibility.'),
    # ([''], 'get_window_extent', float('inf'), ''),
    # ([''], 'get_zorder', float('inf'), "Return the artist's zorder."),
    # ([''], 'ginput', float('inf'), 'Blocking call to interact with a figure.'),
    # ([''], 'have_units', float('inf'), 'Return whether units are set on any axis.'),
    # ([''], 'images', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'is_transform_set', float('inf'), 'Return whether the Artist has an explicitly set transform.'),
    ([''], 'legend', 1, 'Place a legend on the figure.'),
    # ([''], 'legends', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'lines', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'mouseover', float('inf'), 'bool(x) -> bool'),
    # ([''], 'number', float('inf'), 'int([x]) -> integer int(x, base=10) -> integer'),
    # ([''], 'patch', float('inf'), 'A rectangle defined via an anchor point *xy* and its *width* and *height*.'),
    # ([''], 'patches', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'pchanged', float('inf'), 'Call all of the registered callbacks.'),
    # ([''], 'pick', float('inf'), ''),
    # ([''], 'pickable', float('inf'), 'Return whether the artist is pickable.'),
    # ([''], 'properties', float('inf'), 'Return a dictionary of all the properties of the artist.'),
    # ([''], 'remove', float('inf'), 'Remove the artist from the figure if possible.'),
    # ([''], 'remove_callback', float('inf'), 'Remove a callback based on its observer id.'),
    # ([''], 'savefig', float('inf'), 'Save the current figure as an image or vector graphic to a file.'),
    # ([''], 'sca', float('inf'), 'Set the current Axes to be *a* and return *a*.'),
    # ([''], 'set', float('inf'), 'Set multiple properties at once.'),
    # ([''], 'set_agg_filter', float('inf'), 'Set the agg filter.'),
    # ([''], 'set_alpha', float('inf'), 'Set the alpha value used for blending - not supported on all backends.'),
    # ([''], 'set_animated', float('inf'), 'Set whether the artist is intended to be used in an animation.'),
    # ([''], 'set_canvas', float('inf'), 'Set the canvas that contains the figure'),
    # ([''], 'set_clip_box', float('inf'), "Set the artist's clip `.Bbox`."),
    # ([''], 'set_clip_on', float('inf'), 'Set whether the artist uses clipping.'),
    # ([''], 'set_clip_path', float('inf'), "Set the artist's clip path."),
    # ([''], 'set_constrained_layout', float('inf'), '[*Deprecated*] Set whether ``constrained_layout`` is used upon drawing.'),
    # ([''], 'set_constrained_layout_pads', float('inf'), '[*Deprecated*] Set padding for ``constrained_layout``.'),
    ([''], 'set_dpi', 1, 'Set the resolution of the figure in dots-per-inch.'),
    ([''], 'set_edgecolor', 1, 'Set the edge color of the Figure rectangle.'),
    ([''], 'set_facecolor', 1, 'Set the face color of the Figure rectangle.'),
    ([''], 'set_figheight', 1, 'Set the height of the figure in inches.'),
    # ([''], 'set_figure', float('inf'), 'Set the `.Figure` instance the artist belongs to.'),
    ([''], 'set_figwidth', 1, 'Set the width of the figure in inches.'),
    ([''], 'set_frameon', 1, "Set the figure's background patch visibility, i.e. whether the figure background will be drawn. Equivalent to ``Figure.patch.set_visible()``."),
    # ([''], 'set_gid', float('inf'), 'Set the (group) id for the artist.'),
    # ([''], 'set_in_layout', float('inf'), "Set if artist is to be included in layout calculations, E.g. :ref:`constrainedlayout_guide`, `.Figure.tight_layout()`, and ``fig.savefig(fname, bbox_inches='tight')``."),
    # ([''], 'set_label', float('inf'), 'Set a label that will be displayed in the legend.'),
    # ([''], 'set_layout_engine', float('inf'), 'Set the layout engine for this figure.'),
    ([''], 'set_linewidth', 1, 'Set the line width of the Figure rectangle.'),
    # ([''], 'set_mouseover', float('inf'), 'Set whether this artist is queried for custom context information when the mouse cursor moves over it.'),
    # ([''], 'set_path_effects', float('inf'), 'Set the path effects.'),
    # ([''], 'set_picker', float('inf'), 'Define the picking behavior of the artist.'),
    # ([''], 'set_rasterized', float('inf'), 'Force rasterized (bitmap) drawing for vector graphics output.'),
    ([''], 'set_size_inches', 1, 'Set the figure size in inches.'),
    # ([''], 'set_sketch_params', float('inf'), 'Set the sketch parameters.'),
    # ([''], 'set_snap', float('inf'), 'Set the snapping behavior.'),
    # ([''], 'set_tight_layout', float('inf'), '[*Deprecated*] Set whether and how `.Figure.tight_layout` is called when drawing.'),
    # ([''], 'set_transform', float('inf'), 'Set the artist transform.'),
    # ([''], 'set_url', float('inf'), 'Set the url for the artist.'),
    # ([''], 'set_visible', float('inf'), "Set the artist's visibility."),
    # ([''], 'set_zorder', float('inf'), 'Set the zorder for the artist. Artists with lower zorder values are drawn first.'),
    # ([''], 'show', float('inf'), 'If using a GUI backend with pyplot, display the figure window.'),
    # ([''], 'stale', float('inf'), 'bool(x) -> bool'),
    # ([''], 'stale_callback', float('inf'), ''),
    # ([''], 'sticky_edges', float('inf'), '_XYPair(x, y)'),
    # ([''], 'subfigs', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'subfigures', float('inf'), 'Add a set of subfigures to this figure or subfigure.'),
    # ([''], 'subplot_mosaic', float('inf'), 'Build a layout of Axes based on ASCII art or nested lists.'),
    # ([''], 'subplotpars', float('inf'), 'Parameters defining the positioning of a subplots grid in a figure.'),
    ([''], 'subplots', 1, 'Add a set of subplots to this figure.'),
    # ([''], 'subplots_adjust', float('inf'), 'Adjust the subplot layout parameters.'),
    # ([''], 'suppressComposite', float('inf'), ''),
    ([''], 'suptitle', 1, 'Add a centered suptitle to the figure.'),
    ([''], 'supxlabel', 1, 'Add a centered supxlabel to the figure.'),
    ([''], 'supylabel', 1, 'Add a centered supylabel to the figure.'),
    ([''], 'text', float('inf'), 'Add text to figure.'),
    # ([''], 'texts', float('inf'), 'Built-in mutable sequence.'),
    # ([''], 'tight_layout', float('inf'), 'Adjust the padding between and around subplots.'),
    # ([''], 'transFigure', float('inf'), '`BboxTransformTo` is a transformation that linearly transforms points from the unit bounding box to a given `Bbox`.'),
    # ([''], 'transSubfigure', float('inf'), '`BboxTransformTo` is a transformation that linearly transforms points from the unit bounding box to a given `Bbox`.'),
    # ([''], 'update', float('inf'), "Update this artist's properties from the dict *props*."),
    # ([''], 'update_from', float('inf'), 'Copy properties from *other* to *self*.'),
    # ([''], 'waitforbuttonpress', float('inf'), 'Blocking call to interact with the figure.'),
    # ([''], 'zorder', float('inf'), 'int([x]) -> integer int(x, base=10) -> integer'),
]

# snp.methods_for(ax.spines.top)
# spine_method_associations = [
# ]



# Return list of (artists that should expose this method, method name on the root artist, number of times method could be called, first line of method docs)
def method_associations(artist):
    match artist:
        case mpl.figure.Figure():
            return fig_method_associations
        case mpl.axes.Axes():
            return axes_method_associations
        # case mpl.spines.Spine():
        #     return spine_method_associations
        case _:
            return []


# Get all the names in the AST (thanks GPT-4o)
class NameExtractor(ast.NodeVisitor):
    def __init__(self):
        self.nameset = set()

    def visit_Name(self, node):
        self.nameset.add(node.id)
        self.generic_visit(node)

    def visit_arg(self, node):
        self.nameset.add(node.arg)


def get_user_nameset(code):
    name_extractor = NameExtractor()
    name_extractor.visit(ast.parse(code))
    return name_extractor.nameset


# For when you want quick redraws during mouse manipulations.
# The frontend calls this by explicitly adding snp.show_ui(snp_class=SNPFigureOnly) to the cell code.
class SNPFigureOnly:
    def __init__(
        self,
        figure,
        locals,
        cell_lineno,
        plt_show_lineno_in_cell,
        provenance_is_off_by_n_lines,
        notebook_code_through_cell,
        fig_idx,
        fig_names,
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


# When there's a free moment during manipulation, re-gen the hover regions too.
# The frontend calls this by explicitly adding snp.show_ui(snp_class=SNPFigureAndHoverRegions) to the cell code.
class SNPFigureAndHoverRegions(SNPFigureOnly):
    def __init__(
        self,
        figure,
        locals,
        cell_lineno,
        plt_show_lineno_in_cell,
        provenance_is_off_by_n_lines,
        notebook_code_through_cell,
        fig_idx,
        fig_names,
    ):
        plt.close('all') # Suppress "RuntimeWarning: More than 20 figures have been opened"

        self.figure = figure
        self.cached_png = None
        self.cached_svg_hover_regions = None
        self.user_nameset = get_user_nameset(notebook_code_through_cell)

        # Make a map of object id to object name (e.g. "fig.axes")
        with Timer("artist_names"):
            self.artist_names = artist_names(locals, self.user_nameset)

        with Timer("artist_ids_that_will_have_a_method_call"):
            self.artist_ids_that_will_have_a_method_call = set()
            for artist_id, (artist, _names) in self.artist_names.items():
                for children_paths, _, _, _doc in method_associations(artist):
                    for code_to_descendent in children_paths:
                        self.artist_ids_that_will_have_a_method_call.add(id(eval("artist" + code_to_descendent)))

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

                svg_body = region2_to_svg_g(fig_regions2, self.artist_names)

                self.cached_svg_hover_regions = f"""<svg width={width_px} height={height_px} viewBox="{x0_px} {y0_px} {width_px} {height_px}">
                    {svg_body}
                </svg>"""

        return self.cached_svg_hover_regions


root_item_name = re.compile(r'^\w*')
def try_to_add_docstring_to_call(locals, call):
    func_code = call['func_code'] or ''
    split_idx = root_item_name.match(func_code).end()
    root_name = func_code[:split_idx]
    rest      = func_code[split_idx:]
    item = locals.get(root_name)
    if item is None:
        docstring = None
    else:
        try:
            docstring = eval('item' + rest).__doc__
        except:
            docstring = None
    call['docstring'] = docstring


keywordset = set(keyword.kwlist)

class SNP(SNPFigureAndHoverRegions):
    def __init__(
        self,
        figure,
        locals,
        cell_lineno,
        plt_show_lineno_in_cell,
        provenance_is_off_by_n_lines,
        notebook_code_through_cell,
        fig_idx,
        fig_names
    ):
        super().__init__(figure, locals, cell_lineno, plt_show_lineno_in_cell, provenance_is_off_by_n_lines, notebook_code_through_cell, fig_idx, fig_names)

        self.avoid_names = self.user_nameset | locals.keys() | keywordset

        # Perform type inference
        self.cell_lineno = cell_lineno
        self.plt_show_lineno_in_cell = plt_show_lineno_in_cell
        self.provenance_is_off_by_n_lines = provenance_is_off_by_n_lines

        # self.notebook_code_through_cell = notebook_code_through_cell
        self.notebook_code_lines        = notebook_code_through_cell.split("\n")
        with Timer("do_mypy_inference"):
            self.mypy_result = do_mypy_inference(notebook_code_through_cell)
        self.type_graph = self.mypy_result.graph
        self.type_tree = self.type_graph[notebook_as_code_module_name].tree
        tree = self.type_tree

        self.fig_idx   = fig_idx
        self.fig_names = fig_names

        # print(ast.dump(ast.parse(notebook_code_through_cell)))

        # print(dir(ast.parse(notebook_code_through_cell).body[0]))

        # print([v[1] for k,v in self.artist_names.items()])

        # Make a map of user code snippets to types, things we could use for autocompleting arguments.
        #
        # Goes down one level into dicts and lists and tuples; this requires the concrete values, not just the types.
        with Timer("user_typed_snippets"):
            # I wish there were a better way.
            # array_like_type = self.type_graph['matplotlib.axes._axes'].tree.names['Axes'].node.names['bar'].type.arg_types[1]
            # iterable_type
            self.user_typed_snippets = {}
            self.user_iterables = [] # but exclude strings
            builtins_names = self.type_graph['builtins'].tree.names
            string_type = mypy.types.Instance(builtins_names['str'].node, [])
            np_arange_ret_type = self.type_graph['numpy'].tree.names['arange'].node.type.items[0].ret_type
            explicit_any_type = mypy.types.AnyType(mypy.types.TypeOfAny.explicit)
            iterable_type = mypy.types.Instance(self.type_graph['collections.abc'].tree.names['Iterable'].node, [explicit_any_type])
            dict_keys_node = self.type_graph['_collections_abc'].tree.names['dict_keys'].node # <TypeInfo _collections_abc.dict_keys>
            dict_values_node = self.type_graph['_collections_abc'].tree.names['dict_values'].node # <TypeInfo _collections_abc.dict_values>
            dict_items_node = self.type_graph['_collections_abc'].tree.names['dict_items'].node # <TypeInfo _collections_abc.dict_items>
            for name, value in locals.items():
                if name in self.user_nameset and name not in get_trivial_names() and not callable(value):
                    name_type = None
                    if name in tree.names:
                        name_type = tree.names[name].type
                    else:
                        # tree.names only has top-level values
                        #
                        # So if we are in a funciton, let's try to convert the Python value into its type
                        #
                        # This only really works for bools, ints, floats, and strings. Lists and dicts need type arguments for full support below.
                        type_name = type(value).__name__
                        if type_name in builtins_names:
                            # print(name, type_name)
                            name_type = mypy.types.Instance(builtins_names[type_name].node, [])

                    if name_type is not None:
                        self.user_typed_snippets[name] = name_type
                        (is_subtype(name_type, iterable_type) and not is_subtype(name_type, string_type) or (isinstance(value, np.ndarray) and value.ndim == 1) or isinstance(value, list)) and self.user_iterables.append(name) # include dynamic checks too because grrrr

                        if isinstance(value, dict) and isinstance(name_type, mypy.types.Instance) and name_type.type.fullname == 'builtins.dict':
                            val_type = get_index_or_default(name_type.args, 1, None)
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
                            item_type = get_index_or_default(name_type.args, 0, None)
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
            if tree is not None:
                visitor = GatherTypedCalls(self.notebook_code_lines, self.mypy_result.types, self.user_typed_snippets)
                visitor.visit_mypy_file(tree)
                self.calls = visitor.out
                for call in self.calls:
                    try_to_add_docstring_to_call(locals, call)
            else:
                self.calls = []

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

        self.methods = []

        with Timer("associate method calls on named artists"):
            # Find method calls on each of the named artists.
            for artist_id, (artist, names) in self.artist_names.items():
                for children_paths, method_name, max_calls, docstring_first_line in method_associations(artist):
                    show_on = []
                    for code_to_descendent in children_paths:
                        show_on.append(id(eval("artist" + code_to_descendent)))  # This can't be in a comprehension because eval() can't find "artist" when it is

                    type_json = method_type_json(artist, method_name, self.type_graph)

                    type_json is not None and self.methods.append(
                        {
                            "name": method_name,
                            "docstring_first_line": docstring_first_line,
                            "receiver": artist_id,
                            "receiver_name": shortest_qualified_name(names),
                            "show_on": show_on,
                            "type": type_json,
                            "max_calls": max_calls,
                        }
                    )


        # print(ast.parse(self.notebook_code_through_cell).)
        # notebook_ast = json.dumps(ast.parse(self.notebook_code_through_cell), default=lambda o: o.__dict__)
        # with Timer("notebook_ast"):
        #     ast_v = visitor_ast.MyVisitor()
        #     # print(json.dumps(ast_v.visit(ast.parse(self.notebook_code_through_cell)))
        #     notebook_ast = ast_v.visit(ast.parse(self.notebook_code_through_cell))

        def type_node_to_json(node):
            def extra_attrs(obj):
                try:
                    unparsed = code_at_range(self.notebook_code_lines, obj.line, obj.column, obj.end_line, obj.end_column)
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
            for line_no, line in enumerate(self.notebook_code_lines):
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
                    # ignore if it's a lone single name, that means it's probably not code
                    if isinstance(chunk_in_comment, ast.Expr) and isinstance(chunk_in_comment.value, ast.Name):
                        continue

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
            frontend_css = "\n\n".join([path.read_text() for path in pathlib.Path(f"{snp_src_directory}/frontend").rglob("*.css")])

        with Timer("out_html"):
            llm_api_key = os.getenv('OPENAI_API_KEY', '')

            out_html = f"""
                <div class="snp_outer">
                <script>{pathlib.Path(f"{snp_src_directory}/../dist/plugin.js").read_text()}</script>
                <div class="plot_and_sidebar">
                    <div class="snp-sidebar"></div>
                    <div class="plot_area" style="position:relative;">
                        <img src='{data_url}'> <!-- the plot -->
                        <div class="hover_regions">{self._repr_svg_()}</div>
                        <div class="stdout_stderr"></div>
                        <!-- buttons to add method calls will be added by JS below -->
                    </div>
                    <!-- properties panel added here -->
                </div>
                <!-- Not only for the styles, but also a way to run this code once the elements exist. -->
                <style onload="attach_snp(this.closest('.snp_outer'), {self.cell_lineno}, {self.plt_show_lineno_in_cell}, {self.provenance_is_off_by_n_lines}, {json_for_attr(self.methods)}, {json_for_attr(self.calls)}, {json_for_attr(notebook_typed_ast)}, {json_for_attr(self.notebook_parseable_comments)}, {json_for_attr(self.user_iterables)}, {json_for_attr(list(self.avoid_names))}, {json_for_attr(llm_api_key)}, {self.fig_idx}, {json_for_attr(self.fig_names)})">
                    {frontend_css}
                </style>
                </div>
            """

        return out_html


cell_figs = []

# The notebook extension replaces plt.show() with this snp.show() instead.
#
# Unlike plt.show(), this will only show the most recent fig if multiple figs were created since
# the last show(). Showing only the last makes more sense because show() is the anchor point for
# adding new code.
#
# Like plt.show, you can call this multiple times.
#
# The notebook extension replaces the cell return with snp.show_ui(), which renders the SNP UI which includes a picker to select which fig to show.
def show(locals, cell_lineno, plt_show_lineno_in_cell, provenance_is_off_by_n_lines, notebook_code_through_cell, **we_ignore_plt_show_kwargs):
    fig_managers = mpl._pylab_helpers.Gcf.get_all_fig_managers()

    if len(fig_managers) > 0:
        fig = fig_managers[-1].canvas.figure
        cell_figs.append((fig, locals, cell_lineno, plt_show_lineno_in_cell, provenance_is_off_by_n_lines, notebook_code_through_cell))

    return None


def show_ui(fig_idx=0, snp_class=SNP):
    global cell_figs
    if len(cell_figs) == 0:
        print("No figures to show. Be sure plt.show() is called within the cell.")
        return None
    else:
        if fig_idx < 0:
            fig_idx = len(cell_figs) + fig_idx

        fig_idx = np.clip(fig_idx, 0, len(cell_figs) - 1)

        fig, locals, cell_lineno, plt_show_lineno_in_cell, provenance_is_off_by_n_lines, notebook_code_through_cell = cell_figs[fig_idx]

        # What should we name the figs in the UI?
        fig_names = []
        for figg, _, _, _, _, _ in cell_figs: # figg bc don't want to clobber fig above
            # Join the fig title and all the axes titles
            fig_name = ' '.join([title for title in ([figg.get_suptitle()] + [axes.get_title() for axes in figg.get_axes()]) if title != ''])
            fig_names.append(fig_name)

        cell_figs = []
        return snp_class(fig, locals, cell_lineno, plt_show_lineno_in_cell, provenance_is_off_by_n_lines, notebook_code_through_cell, fig_idx, fig_names)


# -------------------------------------------------------- #
#                   Provenance Tracking                    #
# -------------------------------------------------------- #

# Tag the matplotlib output artists etc. with the call that created them.

# Then when we generate the hover regions, we can associate the regions with the appropriate user code.

# Input:
# fig, ax = plt.subplots()
# ax.set_title("My Plot")
# xs = np.linspace(0, 2 * np.pi, 20)
# ys = np.sin(xs)
# lines = ax.plot(xs, ys)

# Output:
# fig, ax = snp.tag_with_provenance(plt.subplots(), 'plt.subplots #1')
# snp.tag_with_provenance(ax.set_title('My Plot'), 'ax.set_title #1')
# xs = snp.tag_with_provenance(np.linspace(0, 2 * np.pi, 20), 'np.linspace #1')
# ys = snp.tag_with_provenance(np.sin(xs), 'np.sin #1')
# lines = snp.tag_with_provenance(ax.plot(xs, ys), 'ax.plot #1')

# snp.tag_with_provenance() gives the returned object an `_snp_came_from_call_id` attribute, which references calls by code and occurance number in the code, e.g. "ax.bar #1"


# "ax.bar #1"
def make_call_id(func_code, call_num):
    return f"{func_code} #{call_num}"


# Thanks GPT-4, this works, apparently.
class TaggedTuple(tuple):
    def __new__(cls, iterable, call_id):
        out = tuple.__new__(cls, iterable)
        out._snp_came_from_call_id = call_id
        return out


class TaggedStr(str):
    def __new__(cls, string, call_id):
        out = str.__new__(cls, string)
        out._snp_came_from_call_id = call_id
        return out


class TaggedList(list):
    def __init__(self, iterable, call_id):
        self._snp_came_from_call_id = call_id
        super().__init__(iterable)


class TaggedDict(dict):
    def __init__(self, dictionary, call_id):
        self._snp_came_from_call_id = call_id
        super().__init__(dictionary)


class TaggedInt(int):
    def __new__(cls, x, call_id):
        out = int.__new__(cls, x)
        out._snp_came_from_call_id = call_id
        return out


class TaggedFloat(float):
    def __new__(cls, x, call_id):
        out = float.__new__(cls, x)
        out._snp_came_from_call_id = call_id
        return out


def tag_with_provenance(
    ret_obj,
    # receiver,
    call_id,
    # lineno,
    # col_offset,
    # end_lineno,
    # end_col_offset,
):
    # Two methods for referring to the same call:
    # 1. call code and number e.g. ("ax.set_title", 3) for the front end selection state, to be somewhat robust to code changes
    # 2. code location e.g.(7,0,7,23) for matching with call information from the type checker

    # call_loc = (
    #     (func_code, call_num),
    #     (lineno, col_offset, end_lineno, end_col_offset),
    # )

    # try:
    #     method_call_locs = receiver._snp_method_call_locs
    # except:
    #     method_call_locs = set()

    # method_call_locs.add(call_loc)

    # try:
    #     receiver._snp_method_call_locs = method_call_locs
    # except:
    #     pass

    if hasattr(ret_obj, "_snp_came_from_call_id"):
        return ret_obj  # Don't rewrite oldest loc.

    try:
        ret_obj._snp_came_from_call_id = call_id
        return ret_obj
    except:
        if isinstance(ret_obj, tuple):
            return TaggedTuple(tuple(tag_with_provenance(child, call_id) for child in ret_obj), call_id)
        elif isinstance(ret_obj, str):
            return TaggedStr(ret_obj, call_id)
        elif isinstance(ret_obj, list):
            return TaggedList([tag_with_provenance(child, call_id) for child in ret_obj], call_id)
        elif isinstance(ret_obj, dict):
            return TaggedDict(ret_obj, call_id)
        elif isinstance(ret_obj, int):
            return TaggedInt(ret_obj, call_id)
        elif isinstance(ret_obj, float):
            return TaggedFloat(ret_obj, call_id)
        return ret_obj


# This assumes the typed node is in the notebook.
# The nodes do not specify which file they actually came from.
def code_at_range(notebook_code_lines, line, column, end_line, end_column):
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


def ast_loc(node):
    return (node.lineno, node.col_offset, node.end_lineno, node.end_col_offset)

class ProvenanceTagger(ast.NodeTransformer):
    def __init__(self) -> None:
        self.call_nums = {} # I checked and the traversal order is the same as for GatherTypedCalls
        super().__init__()

    def visit_Call(self, node):
        node = self.generic_visit(node)

        # When the form is receiver.attribute(...), log that there is call on this receiver.
        match node:
            case ast.Call(func=ast.Attribute(value)):
                func_code = ast.unparse(node.func)
                # receiver = value
                call_num = self.call_nums.get(func_code, 0) + 1
                self.call_nums[func_code] = call_num
                call_id = make_call_id(func_code, call_num) # "ax.bar #1"
                wrapped = ast.Call(
                    ast.Attribute(ast.Name('snp', ast.Load()), 'tag_with_provenance', ast.Load()), # snp.tag_with_provenance
                    [
                        node,
                        # receiver,
                        ast.Constant(call_id),
                        # ast.Constant(node.lineno),
                        # ast.Constant(node.col_offset),
                        # ast.Constant(node.end_lineno),
                        # ast.Constant(node.end_col_offset),
                    ],
                    [],
                )

                # print(call_num, ast.unparse(node))

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
        case mypy.nodes.TupleExpr():
            perhaps_trailing_comma = "," if len(expr.items) == 1 else ""
            return f"({', '.join([unparse_mypy_expr(e) for e in expr.items])}{perhaps_trailing_comma})"
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


def type_json_with_node_loc(node, type, user_typed_snippets):
    type_json_dict = serialize_type(type, user_typed_snippets)
    return add_pos_json(type_json_dict, node)


# MyPy's is_subtype accepts AnyType on both LHS and RHS, which is maddening.
# And I can't get its is_proper_subtype to reliably match things like tuples with e.g. Collection[Any] or ListLike
# So this version rejects bare AnyType as a subtype of everything (but is not recursive).
def is_subtype(subtype, type):
    subtype = mypy.types.get_proper_type(subtype)
    type = mypy.types.get_proper_type(type)

    if isinstance(subtype, mypy.types.AnyType) and not isinstance(type, mypy.types.AnyType):
        return False

    return mypy.subtypes.is_subtype(subtype, type)



class GatherTypedCalls(TraverserVisitor):
    def __init__(self, notebook_code_lines, types_dict, user_typed_snippets):
        self.call_nums = {} # I checked and the traversal order is the same as for ast.NodeTransformer
        self.notebook_code_lines = notebook_code_lines
        self.types_dict = types_dict
        self.user_typed_snippets = user_typed_snippets
        self.out = []
        global call_typed_nodes # for debugging
        call_typed_nodes = []

    def visit_call_expr(self, node: mypy.nodes.CallExpr) -> None:
        super().visit_call_expr(node)

        func_code = code_at_range(self.notebook_code_lines, node.callee.line, node.callee.column, node.callee.end_line, node.callee.end_column)
        call_num = self.call_nums.get(func_code, 0) + 1
        self.call_nums[func_code] = call_num

        # print(call_num, code_at_range(self.notebook_code_lines, node.line, node.column, node.end_line, node.end_column))

        callee_type = self.types_dict.get(node.callee)
        call_typed_nodes.append(node)
        # print(node, " has type ", callee_type)

        # For overloads, assume first.
        while isinstance(callee_type, mypy.types.Overloaded):
            callee_type = callee_type.items[0]

        # print(func_code, callee_type)

        if isinstance(callee_type, mypy.types.CallableType):
            given_args = []
            for arg, name in zip(node.args, node.arg_names):
                given_arg = type_json_with_node_loc(arg, self.types_dict.get(arg), self.user_typed_snippets)
                given_arg["name"] = name
                given_args.append(given_arg)

            # The callee_type here is partially applied (self is already removed from the argument list).
            # For consistency with places where where that is not the case, let us unapply it
            if callee_type.definition is not None and callee_type.definition.type is not None:
                callee_type = callee_type.definition.type

            # callee = callable_type_json(callee_type, self.user_typed_snippets)
            # add_pos_json(callee, node.callee)

            self.out.append(
                {
                    "call": type_json_with_node_loc(node, self.types_dict.get(node), self.user_typed_snippets),
                    "callee": type_json_with_node_loc(node.callee, callee_type, self.user_typed_snippets),
                    "given_args": given_args,
                    "func_code": func_code, # e.g. "ax.bar" or "len"
                    "call_id": make_call_id(func_code, call_num), # "ax.bar #1"
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
def serialize_type(_type: mypy.types.Type, user_typed_snippets: Dict[str, mypy.types.Type]) -> JsonDict:

    if isinstance(_type, mypy.types.Overloaded):
        return {
            ".class": "Overloaded",
            "items": [serialize_type(t, user_typed_snippets) for t in _type.items],
        }

    if isinstance(_type, mypy.types.UnboundType):
        return {
            ".class": "UnboundType",
            "name": _type.name,
            "args": [serialize_type(a, user_typed_snippets) for a in _type.args],
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
            "values": [serialize_type(v, user_typed_snippets) for v in _type.values],
            "upper_bound": serialize_type(_type.upper_bound, user_typed_snippets),
            "default": serialize_type(_type.default, user_typed_snippets),
            "variance": _type.variance,
        }

    if isinstance(_type, mypy.types.TypedDictType):
        type_compatible_code_snippets_by_i = []
        for _, item_type in _type.items.items():
            compatible_snippets = [name for name, snippet_type in user_typed_snippets.items() if is_subtype(snippet_type, item_type)]
            type_compatible_code_snippets_by_i.append(compatible_snippets)

        # dict from key name to default code
        default_codes_by_name = {stmt.lvalues[0].name: unparse_mypy_expr(stmt.rvalue) for stmt in _type.fallback.type.defn.defs.body if isinstance(stmt, mypy.nodes.AssignmentStmt) and not isinstance(stmt.rvalue, mypy.nodes.TempNode) and len(stmt.lvalues) == 1}

        return {
            ".class": "TypedDictType",
            "items": [[n, serialize_type(t, user_typed_snippets)] for (n, t) in _type.items.items()],
            "type_compatible_code_snippets_by_i": type_compatible_code_snippets_by_i,
            "required_keys": sorted(_type.required_keys),
            "fallback": serialize_type(_type.fallback, user_typed_snippets),
            "default_codes_by_name": default_codes_by_name,
        }

    if isinstance(_type, mypy.types.TupleType):
        return {
            ".class": "TupleType",
            "items": [serialize_type(t, user_typed_snippets) for t in _type.items],
            "partial_fallback": serialize_type(_type.partial_fallback, user_typed_snippets),
            "implicit": _type.implicit,
        }

    if isinstance(_type, mypy.types.LiteralType):
        return {
            ".class": "LiteralType",
            "value": _type.value,
            "value_unparsed": repr(_type.value),
            "fallback": serialize_type(_type.fallback, user_typed_snippets),
        }

    if isinstance(_type, mypy.types.NoneType):
        return {".class": "NoneType"}

    if isinstance(_type, mypy.types.AnyType):
        return {
            ".class": "AnyType",
            "type_of_any": _type.type_of_any,
            "source_any": (serialize_type(_type.source_any.serialize, user_typed_snippets) if _type.source_any is not None else None),
            "missing_import_name": _type.missing_import_name,
        }

    if isinstance(_type, mypy.types.UnionType):
        return {
            ".class": "UnionType",
            "items": [serialize_type(t, user_typed_snippets) for t in _type.items],
        }

    if isinstance(_type, mypy.types.Instance):
        type_ref = _type.type.fullname
        if not _type.args and not _type.last_known_value:
            return {".class": "Instance", "type_ref": type_ref}

        data: JsonDict = {".class": "Instance"}
        data["type_ref"] = type_ref
        data["args"] = [serialize_type(arg, user_typed_snippets) for arg in _type.args]
        if _type.last_known_value is not None:
            data["last_known_value"] = serialize_type(_type.last_known_value, user_typed_snippets)
        return data

    if isinstance(_type, mypy.types.TypeAliasType):
        return {
            ".class": "TypeAliasType",
            "type_ref": _type.alias.fullname,
            "resolved": serialize_type(mypy.types.get_proper_type(_type), user_typed_snippets),
            "args": [serialize_type(arg, user_typed_snippets) for arg in _type.args],
        }

    if isinstance(_type, mypy.types.CallableType):

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

        default_code_by_arg_idx = None
        arg_names_at_definition = None
        type_compatible_code_snippets_by_arg_i = []

        definition_fullname = _type.definition.fullname if hasattr(_type, "definition") and _type.definition else None

        if hasattr(_type, "definition") and _type.definition and _type.definition.arguments:
            default_code_by_arg_idx = [unparse_mypy_expr(arg.initializer) for arg in _type.definition.arguments]
            arg_names_at_definition = [arg.variable.name for arg in _type.definition.arguments] # for positional arguments, mypy doesn't store the names in the arg_names list so we need to re-gen

        for arg_type in _type.arg_types:
            compatible_snippets = [name for name, snippet_type in user_typed_snippets.items() if is_subtype(snippet_type, arg_type)]
            type_compatible_code_snippets_by_arg_i.append(compatible_snippets)

        return {
            ".class": "CallableType",
            "arg_types": [serialize_type(t, user_typed_snippets) for t in _type.arg_types],
            "arg_kinds": [int(x.value) for x in _type.arg_kinds],
            "arg_names": _type.arg_names,
            "default_code_by_arg_idx": default_code_by_arg_idx,
            "arg_names_at_definition": arg_names_at_definition,
            "type_compatible_code_snippets_by_arg_i": type_compatible_code_snippets_by_arg_i,
            "ret_type": serialize_type(_type.ret_type, user_typed_snippets),
            "fallback": serialize_type(_type.fallback, user_typed_snippets),
            "name": _type.name,
            "definition_fullname": definition_fullname,
            "variables": [serialize_type(v, user_typed_snippets) for v in _type.variables],
            "is_ellipsis_args": _type.is_ellipsis_args,
            "implicit": _type.implicit,
            "bound_args": [(None if t is None else serialize_type(t, user_typed_snippets)) for t in _type.bound_args],
            "def_extras": dict(_type.def_extras),
            "type_guard": (serialize_type(_type.type_guard, user_typed_snippets) if _type.type_guard is not None else None),
            # "type_is": (serialize(_type.type_is) if _type.type_is is not None else None),
            "from_concatenate": _type.from_concatenate,
            "imprecise_arg_kinds": _type.imprecise_arg_kinds,
            "unpack_kwargs": _type.unpack_kwargs,
        }

    # print("Error type not implemented!", _type.__class__.__name__)

    return { ".class": _type.__class__.__name__ }

