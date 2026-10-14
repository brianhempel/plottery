import { refresh_hover_regions } from "../../code_sync/code_sync";
import { begin_undo_group, end_undo_group, undo_group_origin, UndoGroup } from "../../code_sync/undo_group";
import { click_selection_mode, is_layer_selected, select_layer, selected_layers } from "../../layer_panel/layer_panel";
import {
  CallView,
  MethodWithCode,
  State,
} from "../../types";
import { zip, equalByJSON } from "../../utils/stdlib";
import { create_el, escape_html, place_centered_over_shape, place_over_shape, reposition_to_avoid_overlap } from "../../utils/misc";
import { DragHandler1D, DragHandler2D, perhaps_get_drag_bottom_edge_handler, perhaps_get_drag_left_edge_handler, perhaps_get_drag_right_edge_handler, perhaps_get_drag_top_edge_handler, perhaps_get_drag_x_handler, perhaps_get_drag_xy_handler, perhaps_get_drag_y_handler, write_calls_and_redraw } from "../call/call";
import { add_method_call } from "../methods/method";
import "./hover_regions.css";
import { add_menu_item, add_search, create_menu_el } from "../../menus/menus";
import { log_event, rate_limit } from "../../utils/instrumentation";


export function place_add_method_buttons_on_plot(state: State) {

  const svg_overlay_el = state.hover_regions_svg();

  if (!svg_overlay_el) { return; }

  const hover_regions: Element[] = Array.from(svg_overlay_el.querySelectorAll('[data-artist-id]'));

  // Group methods by artist_id

  const methods_by_artist_id: { [artist_id: number]: MethodWithCode[] } = {};

  state.methods_with_code.forEach(method => {
    const artist_id = method.method_info.show_on.at(-1);
    if (artist_id) {
      const dont_show = state.calls.count(call => call.func_code == method.receiver_dot_name) >= method.method_info.max_calls;

      if (!dont_show) {
        methods_by_artist_id[artist_id] = methods_by_artist_id[artist_id] || [];
        methods_by_artist_id[artist_id].push(method);
      }
    } else {
      console.warn("Method without artist_id!", method);
    }
  });

  // Draw add method widgets on appropriate hover regions
  const placed_methods: HTMLElement[] = [];
  const is_empty_plot = Object.entries(methods_by_artist_id).length == 1;

  for (const [artist_id, methods] of Object.entries(methods_by_artist_id)) {

    hover_regions.filter(el => el.getAttribute("data-artist-id") == artist_id).forEach(hover_region => {
      let el: HTMLElement;
      if (methods.length == 1) {
        el = create_el("div", "plottery-method-view");
        el.innerText = methods[0].receiver_dot_name; // "ax.bar"
        el.title = methods[0].method_info.docstring_first_line || `No documenation for ${methods[0].receiver_dot_name}`;
        el.addEventListener("click", _ => {
          add_method_call(methods[0], state)
          log_event('gui', 'on-plot add method button click', {button: el.innerText, code: state.cell.code_mirror.getValue()});
        });
      } else {

        // Hmm, could probably pull this off the methods somehow
        // Would avoid the need to store the artist name in the hover region in plottery.py
        const artist_name = (hover_region.getAttribute("data-artist-name") || "unknown").replace(/\.patch$/, ''); // show 'ax.patch' as 'ax' although we want the method positioned relative to the patch

        el = create_menu_el(`<span class="plottery-methods-dropdown">${artist_name}&nbsp▾</span>`, 'plottery-method-view', undefined)

        if (methods.length >= 5) { add_search(el) }

        // Add possible method calls to the menu
        methods.forEach(method => {
          add_menu_item(
            el,
            `<span>${method.receiver_dot_name}<span class="doc">${escape_html(method.method_info.docstring_first_line)}</span></span>`,
            null, // Command
            (state => add_method_call(method, state)),
            _ => true, // Enabled?
            state
          )
          // create_el('span', 'doc', item).innerText = method.method_info.docstring_first_line;
        });
      }

      // const { el: method_el } = create_method_view(method, state);
      state.plot_area.append(el); // Have to place in DOM first so it has width/height for centering
      if (!is_empty_plot) {
        place_over_shape(hover_region, el, state.plot_area);
      } else {
        place_centered_over_shape(hover_region, el, state.plot_area);
        el.classList.add("always-show");
      }
      reposition_to_avoid_overlap(el, placed_methods, state.plot_area);
      placed_methods.push(el);
    });

  }

  // // Draw add method widgets on appropriate hover regions
  // const placed_methods: HTMLElement[] = [];
  // state.methods_with_code.forEach(method => {
  //   // Skip if already called
  //   const dont_show =  state.calls.count(call => call.func_code == method.receiver_dot_name) >= method.method_info.max_calls;
  //   if (dont_show) { return; }

  //   const show_on = method.method_info.show_on.at(-1);

  //   hover_regions.filter(el => parseInt(el.getAttribute("data-artist-id") || "-1") == show_on).forEach(hover_region => {
      // const { el: method_el } = create_method_view(method, state);
  //     state.plot_area.append(method_el); // Have to place in DOM first so it has width/height for centering
  //     place_centered_over_shape(hover_region, method_el, state.plot_area);
  //     reposition_to_avoid_overlap(method_el, placed_methods, state.plot_area);
  //     placed_methods.push(method_el);
  //   });
  // });

  // Can't hide the methods for hover until they've all been repositioned
  // (if they start hidden then the above repositioning does not work)
  placed_methods.forEach(method_el => { method_el.classList.add("placed"); });
}

export function hover_regions_for_call(call_id: string, state: State): SVGElement[] {
  const svg_overlay_el = state.hover_regions_svg();

  if (!svg_overlay_el) { return []; }

  return (Array.from(svg_overlay_el.querySelectorAll('[data-call-id]')) as SVGElement[]).filter(hover_region => {
    return hover_region.dataset.callId === call_id;
  });
}

// export function deselect_hover_regions(call_id: string, state: State) {
//   hover_regions_for_call(call_id, state).forEach(hover_region => {
//     hover_region.classList.remove("selected");
//   });
// }

export function select_hover_regions(call_id: string, state: State) {
  hover_regions_for_call(call_id, state).forEach(hover_region => {
    hover_region.classList.add("selected");
  });
}

// Set the selected state of the hover regions based on the layers panel
export function compute_selected_hover_regions(state: State) {
  const svg_overlay_el = state.hover_regions_svg();

  if (!svg_overlay_el) { return; }

  svg_overlay_el.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
  selected_layers(state).forEach(layer => {
    layer.calls_with_args.forEach(call_with_args => {
      select_hover_regions(call_with_args.call_info.call_id, state);
    });
  });
}

// (x0, y0, x1, y1). The axes bounds are null for figure-level artists (fig.suptitle, fig.text, fig.legend, ...).
export type Boundses = {
  fig_px_bounds:    [number, number, number, number];
  axes_px_bounds:   [number, number, number, number] | null;
  axes_unit_bounds: [number, number, number, number] | null;
  region_px_bounds: [number, number, number, number];
};

function hover_region_boundses(hover_region: SVGElement): Boundses {
  const fig_px_bounds    : [number, number, number, number] = hover_region.dataset.figPxBounds    ? (JSON.parse(hover_region.dataset.figPxBounds)    || [0, 0, 0, 0]) : [0, 0, 0, 0];
  const axes_px_bounds   : [number, number, number, number] | null = hover_region.dataset.axesPxBounds   ? JSON.parse(hover_region.dataset.axesPxBounds)   : null;
  const axes_unit_bounds : [number, number, number, number] | null = hover_region.dataset.axesUnitBounds ? JSON.parse(hover_region.dataset.axesUnitBounds) : null;
  const region_px_bounds : [number, number, number, number] = hover_region.dataset.regionPxBounds ? (JSON.parse(hover_region.dataset.regionPxBounds) || [0, 0, 0, 0]) : [0, 0, 0, 0];

  return { fig_px_bounds, axes_px_bounds, axes_unit_bounds, region_px_bounds };
}

// What dragging a shape does: move it, or move one of its edges.
type DragKind = "move" | "left" | "right" | "top" | "bottom";

// One call's handlers in a drag, and the bounds of its shape, for converting the pointer's
// movement into the call's own units.
type DragPart = {
  call_view: CallView;
  boundses: Boundses;
  xy?: DragHandler2D; // Preferred over the below if present.
  x?: DragHandler1D;
  y?: DragHandler1D;
  xy_offset: [number, number]; // Added to the pointer position given to xy.
};

function run_drag_part(part: DragPart, client_px_in_fig: [number, number], delta_px: [number, number], fig_bb: DOMRect) {
  const { boundses, xy, x, y, xy_offset } = part;
  if (xy) {
    xy([client_px_in_fig[0] + xy_offset[0], client_px_in_fig[1] + xy_offset[1]], delta_px, fig_bb, boundses);
  } else {
    if (x) { x(client_px_in_fig[0], delta_px[0], fig_bb, boundses); }
    if (y) { y(client_px_in_fig[1], delta_px[1], fig_bb, boundses); }
  }
}

// Dragging one of several selected shapes drags the other selected shapes along: moving each as
// far as it can be moved, or moving the same edge of each. The parts for those other calls.
function companion_drag_parts(kind: DragKind, grabbed: CallView, start_px_in_fig: [number, number], fig_bb: DOMRect, state: State): DragPart[] {
  const parts: DragPart[] = [];
  selected_layers(state).forEach(layer => {
    zip(layer.calls_with_args, layer.call_views).forEach(([call_with_args, call_view]) => {
      if (call_view === grabbed) return;
      const hover_region = hover_regions_for_call(call_with_args.call_info.call_id, state)[0];
      if (!hover_region) return; // Not on the plot, so we can't tell its scale.
      const boundses = hover_region_boundses(hover_region);

      const part: DragPart = { call_view, boundses, xy_offset: [0, 0] };
      if (kind === "move") {
        part.xy = perhaps_get_drag_xy_handler(call_view);
        if (part.xy) {
          part.xy_offset = legend_pointer_offset(boundses, start_px_in_fig, fig_bb);
        } else {
          part.x = perhaps_get_drag_x_handler(call_view);
          part.y = perhaps_get_drag_y_handler(call_view);
        }
      } else if (kind === "left") {
        part.x = perhaps_get_drag_left_edge_handler(call_view);
      } else if (kind === "right") {
        part.x = perhaps_get_drag_right_edge_handler(call_view);
      } else if (kind === "top") {
        part.y = perhaps_get_drag_top_edge_handler(call_view);
      } else if (kind === "bottom") {
        part.y = perhaps_get_drag_bottom_edge_handler(call_view);
      }
      if (part.xy || part.x || part.y) parts.push(part);
    });
  });
  return parts;
}

// A legend's drag handler puts the legend's lower left corner at the pointer, less 5% of its axes
// (see perhaps_get_drag_xy_handler). To move a legend along with the pointer from where it is,
// rather than jump it there, offset the pointer position the handler gets by this much.
function legend_pointer_offset(boundses: Boundses, start_px_in_fig: [number, number], fig_bb: DOMRect): [number, number] {
  const [fig_x0,  fig_y0,  fig_x1]           = boundses.fig_px_bounds;
  const [axes_x0, axes_y0, axes_x1, axes_y1] = boundses.axes_px_bounds ?? boundses.fig_px_bounds;
  const [region_x0, region_y0]               = boundses.region_px_bounds;
  const client_px_per_fig_px = fig_bb.width / (fig_x1 - fig_x0);
  return [
    (region_x0 - fig_x0 + 0.05 * (axes_x1 - axes_x0)) * client_px_per_fig_px - start_px_in_fig[0],
    (region_y0 - fig_y0 + 0.05 * (axes_y1 - axes_y0)) * client_px_per_fig_px - start_px_in_fig[1],
  ];
}

// Calls whose args share a variable (`w = 0.5`, then `width=w` in each) each have a handler for
// its number. Only the first may drag it, or they'd fight over it.
function drop_shared_handlers(parts: DragPart[], state: State): DragPart[] {
  const cm = state.cell.code_mirror;
  const dragged = new Set<string>();
  const unless_shared = (handler: DragHandler1D | undefined) => {
    const range = handler?.chain_link?.mark.find();
    if (!range) return handler;
    const key = `${cm.indexFromPos(range.from)}-${cm.indexFromPos(range.to)}`;
    if (dragged.has(key)) return undefined;
    dragged.add(key);
    return handler;
  };
  parts.forEach(part => {
    part.x = unless_shared(part.x);
    part.y = unless_shared(part.y);
  });
  return parts.filter(part => part.xy || part.x || part.y);
}

// Write the variables' numbers the dragged calls' handlers edit through a variable's chain link
// rather than the call (see write_calls_and_redraw). Returns whether the code changed.
function write_chain_link_numbers(parts: DragPart[], state: State): boolean {
  const cm = state.cell.code_mirror;
  let changed = false;
  parts.forEach(part => {
    [part.x, part.y].forEach(handler => {
      const link = handler?.chain_link;
      const range = link?.active ? link.mark.find() : undefined;
      if (!link || !range) return;
      const code = link.widget.to_code();
      if (code.trim() === "" || cm.getRange(range.from, range.to) === code) return;
      cm.replaceRange(code, range.from, range.to, undo_group_origin(state));
      changed = true;
    });
  });
  return changed;
}

export function attach_events_to_hover_regions(state: State) {

  // Attach drag handlers to artists that are the result of calls in the code
  //
  // The handling has to be routed through the layers UI element because all the logic
  // for attaching the arguments to the code is buried there, including adding new args
  // and modifying current args.
  state.layers_panel.layers.forEach(layer => {
    // Layers in practice only have zero or one calls, but the types and code allow more.
    zip(layer.calls_with_args, layer.call_views).forEach(([call_with_args, call_view]) => {
      const call_info = call_with_args.call_info;

      const perhaps_drag_xy_handler          = perhaps_get_drag_xy_handler(call_view);
      const perhaps_drag_x_handler           = perhaps_get_drag_x_handler(call_view);
      const perhaps_drag_y_handler           = perhaps_get_drag_y_handler(call_view);
      const perhaps_drag_left_edge_handler   = perhaps_get_drag_left_edge_handler(call_view);
      const perhaps_drag_right_edge_handler  = perhaps_get_drag_right_edge_handler(call_view);
      const perhaps_drag_top_edge_handler    = perhaps_get_drag_top_edge_handler(call_view);
      const perhaps_drag_bottom_edge_handler = perhaps_get_drag_bottom_edge_handler(call_view);

      const hover_regions = hover_regions_for_call(call_info.call_id, state);

      hover_regions.forEach(hover_region => {

        let pressed = false;
        let moved = false;
        let drag_undo_group: UndoGroup | undefined;
        let click_start: Date = new Date();
        let start_x = 0;
        let start_y = 0;
        let fig_bb: DOMRect = new DOMRect();

        let drag_kind  : DragKind | undefined = undefined;
        let xy_handler : DragHandler2D | undefined = undefined; // Preferred over the below if present.
        let x_handler  : DragHandler1D | undefined = undefined;
        let y_handler  : DragHandler1D | undefined = undefined;

        // This shape's call, then those of the other selected shapes dragged along with it.
        let drag_parts : DragPart[] = [];

        const boundses = hover_region_boundses(hover_region);

        hover_region.addEventListener("mouseover", ev => {
          hover_regions.forEach(hover_region => {
            // hover_region.querySelectorAll("[stroke-width]").forEach(el => { el.setAttribute("stroke-width", "2.0"); });
            hover_region.classList.add("hovered");
          });
          ev.stopPropagation();
          ev.preventDefault();
        });
        hover_region.addEventListener("mouseout", ev => {
          hover_regions.forEach(hover_region => {
            // hover_region.querySelectorAll("[stroke-width]").forEach(el => { el.setAttribute("stroke-width", hover_region.dataset.origStrokeWidth || "0"); });
            hover_region.classList.remove("hovered");
          });
          ev.stopPropagation();
          ev.preventDefault();
        });

        // Determine whether we are dragging the middle or the edge
        hover_region.addEventListener("mousemove", evt => {
          if (pressed) { return; }

          const { x, y, right, bottom, width, height } = hover_region.getBoundingClientRect();

          const ew_edge_w = Math.min(10, width  / 4);
          const ns_edge_w = Math.min(10, height / 4);

          // For checking edges, we already know the mouse is over the hover region so we don't have to check the outer bounds.
          if (perhaps_drag_left_edge_handler && evt.clientX < x + ew_edge_w) {
            hover_region.style.cursor = "col-resize";
            drag_kind = "left";
            x_handler = perhaps_drag_left_edge_handler;
            y_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_right_edge_handler && evt.clientX > right - ew_edge_w) {
            hover_region.style.cursor = "col-resize";
            drag_kind = "right";
            x_handler = perhaps_drag_right_edge_handler;
            y_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_top_edge_handler && evt.clientY < y + ns_edge_w) {
            hover_region.style.cursor = "row-resize";
            drag_kind = "top";
            y_handler = perhaps_drag_top_edge_handler;
            x_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_bottom_edge_handler && evt.clientY > bottom - ns_edge_w) {
            hover_region.style.cursor = "row-resize";
            drag_kind = "bottom";
            y_handler = perhaps_drag_bottom_edge_handler;
            x_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_xy_handler) {
            hover_region.style.cursor = "move";
            drag_kind = "move";
            xy_handler = perhaps_drag_xy_handler;
            x_handler = undefined;
            y_handler = undefined;
          } else if (perhaps_drag_x_handler) {
            hover_region.style.cursor = perhaps_drag_y_handler ? "move" : "ew-resize";
            drag_kind = "move";
            x_handler = perhaps_drag_x_handler;
            y_handler = perhaps_drag_y_handler;
            xy_handler = undefined;
          } else if (perhaps_drag_y_handler) {
            hover_region.style.cursor = "ns-resize";
            drag_kind = "move";
            y_handler = perhaps_drag_y_handler;
            x_handler = undefined;
            xy_handler = undefined;
          } else {
            hover_region.style.cursor = "default";
            drag_kind = undefined;
            x_handler = undefined;
            y_handler = undefined;
            xy_handler = undefined;
          }
        });

        hover_region.addEventListener("mousedown", evt => {
          // console.log(call_with_args)
          // console.log(evt)
          // console.log(hover_region.getBoundingClientRect())
          // console.log(hover_region.getClientRects())
          moved = false;
          pressed = true;
          click_start = new Date();
          start_x = evt.clientX;
          start_y = evt.clientY;
          fig_bb = state.hover_regions_svg()!.getBoundingClientRect();
          evt.stopPropagation();
          evt.preventDefault();
          // but still need to gain focus on Plottery
          // Need to focus plottery_outer, or whatever has our keyboard command handlers,
          // so that cmd-d etc work after user clicks the plot
          state.plottery_outer.focus({ preventScroll: true });
        });

        hover_region.addEventListener("click", evt => {
          // Prevent hitting the deselection handler on the hover regions container
          evt.preventDefault();
          evt.stopPropagation();
        });

        const on_document_mousemove = (evt: MouseEvent) => {
          if (pressed) {
            if (!moved) {
              const start_px_in_fig: [number, number] = [start_x - fig_bb.x, fig_bb.bottom - start_y];
              const xy_offset: [number, number] = xy_handler ? legend_pointer_offset(boundses, start_px_in_fig, fig_bb) : [0, 0];
              drag_parts = [{ call_view, boundses, xy: xy_handler, x: x_handler, y: y_handler, xy_offset }];
              // Dragging one of the selected shapes drags them all.
              if (drag_kind && is_layer_selected(layer, state)) {
                drag_parts = drop_shared_handlers([...drag_parts, ...companion_drag_parts(drag_kind, call_view, start_px_in_fig, fig_bb, state)], state);
              }
              log_event("gui", "on-plot drag start", {call: call_info.func_code, code: state.cell.code_mirror.getValue(), also_dragging: drag_parts.slice(1).map(part => part.call_view.els.name_el.textContent)});
              drag_undo_group = begin_undo_group(state); // The whole drag is one undo step
            }
            moved = true;
            const dx = evt.clientX - start_x;
            const dy = evt.clientY - start_y;
            const client_px_in_fig: [number, number] = [evt.clientX - fig_bb.x, fig_bb.bottom - evt.clientY];
            drag_parts.forEach(part => run_drag_part(part, client_px_in_fig, [dx, dy], fig_bb));
            if (drag_parts.length > 1) {
              write_calls_and_redraw(drag_parts.map(part => part.call_view), state, () => write_chain_link_numbers(drag_parts, state));
            }
            state.hover_regions_container.classList.add("hide_during_interaction");
            evt.preventDefault();
            evt.stopPropagation();
          } else if (!hover_region.isConnected) {
            // Remove self once stale after rerender
            document.removeEventListener("mousemove", on_document_mousemove); return;
          }
        };
        document.addEventListener("mousemove", on_document_mousemove);

        const on_document_mouseup = (evt: MouseEvent) => {
          if (pressed) {
            pressed = false;
            // state.hover_regions_container.classList.remove("hidden");
            state.hover_regions_container.classList.remove("hide_during_interaction");

            // // Consider it a click if the mouse didn't move
            // const dx = evt.clientX - start_x;
            // const dy = evt.clientY - start_y;
            if (!moved) {
              const mode = click_selection_mode(evt, false);
              log_event("gui", "on-plot layer click-select", {layer: layer.el.innerText, mode});
              select_layer(layer, state, call_view, mode);
            } else {
              moved = false;
              if (drag_undo_group) end_undo_group(state, drag_undo_group);
              drag_undo_group = undefined;
              refresh_hover_regions(state);
              log_event("gui", "on-plot drag end", {call: call_info.func_code, code: state.cell.code_mirror.getValue()});
            }
          } else if (!hover_region.isConnected) {
            // Remove self once stale after rerender
            document.removeEventListener("mouseup", on_document_mouseup); return;
          }
        };
        document.addEventListener("mouseup", on_document_mouseup);
      });
    });
  });

  compute_selected_hover_regions(state);
}
