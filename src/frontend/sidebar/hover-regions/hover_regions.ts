import { refresh_hover_regions } from "../../code_sync/code_sync";
import { select_layer, selected_layers } from "../../layer_panel/layer_panel";
import {
  MethodWithCode,
  State,
} from "../../types";
import { zip, equalByJSON } from "../../utils/stdlib";
import { create_el, escape_html, place_centered_over_shape, place_over_shape, reposition_to_avoid_overlap } from "../../utils/misc";
import { perhaps_get_drag_bottom_edge_handler, perhaps_get_drag_left_edge_handler, perhaps_get_drag_right_edge_handler, perhaps_get_drag_top_edge_handler, perhaps_get_drag_x_handler, perhaps_get_drag_xy_handler, perhaps_get_drag_y_handler } from "../call/call";
import { add_method_call } from "../methods/method";
import "./hover_regions.css";
import { add_menu_item, create_menu_el } from "../../menus/menus";


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
        el = create_el("div", "snp-method-view");
        el.innerText = methods[0].receiver_dot_name; // "ax.bar"
        el.title = methods[0].method_info.docstring_first_line || `No documenation for ${methods[0].receiver_dot_name}`;
        el.addEventListener("click", _ => add_method_call(methods[0], state));
      } else {

        const artist_name = (hover_region.getAttribute("data-artist-name") || "unknown").replace(/\.patch$/, ''); // show 'ax.patch' as 'ax' although we want the method positioned relative to the patch

        el = create_menu_el(`<span class="snp-methods-dropdown">${artist_name}&nbsp▾</span>`, 'snp-method-view', undefined)

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

// (x0, y0, x1, y1)
export type Boundses = {
  fig_px_bounds:    [number, number, number, number];
  axes_px_bounds:   [number, number, number, number];
  axes_unit_bounds: [number, number, number, number];
  region_px_bounds: [number, number, number, number];
};

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
        let click_start: Date = new Date();
        let start_x = 0;
        let start_y = 0;
        let fig_bb: DOMRect = new DOMRect();

        let xy_handler : ((client_px_in_fig: [number, number], delta_px: [number, number], fig_bb: DOMRect, boundses: Boundses) => void) | undefined = undefined; // Preferred over the below if present.
        let x_handler  : ((client_px_in_fig: number,           delta_px: number,           fig_bb: DOMRect, boundses: Boundses) => void) | undefined = undefined;
        let y_handler  : ((client_px_in_fig: number,           delta_px: number,           fig_bb: DOMRect, boundses: Boundses) => void) | undefined = undefined;

        let fig_px_bounds    : [number, number, number, number] = hover_region.dataset.figPxBounds    ? (JSON.parse(hover_region.dataset.figPxBounds)    || [0, 0, 0, 0]) : [0, 0, 0, 0];
        let axes_px_bounds   : [number, number, number, number] = hover_region.dataset.axesPxBounds   ? (JSON.parse(hover_region.dataset.axesPxBounds)   || [0, 0, 0, 0]) : [0, 0, 0, 0];
        let axes_unit_bounds : [number, number, number, number] = hover_region.dataset.axesUnitBounds ? (JSON.parse(hover_region.dataset.axesUnitBounds) || [0, 0, 0, 0]) : [0, 0, 0, 0];
        let region_px_bounds : [number, number, number, number] = hover_region.dataset.regionPxBounds ? (JSON.parse(hover_region.dataset.regionPxBounds) || [0, 0, 0, 0]) : [0, 0, 0, 0];

        let boundses: Boundses = { fig_px_bounds, axes_px_bounds, axes_unit_bounds, region_px_bounds };

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
            x_handler = perhaps_drag_left_edge_handler;
            y_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_right_edge_handler && evt.clientX > right - ew_edge_w) {
            hover_region.style.cursor = "col-resize";
            x_handler = perhaps_drag_right_edge_handler;
            y_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_top_edge_handler && evt.clientY < y + ns_edge_w) {
            hover_region.style.cursor = "row-resize";
            y_handler = perhaps_drag_top_edge_handler;
            x_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_bottom_edge_handler && evt.clientY > bottom - ns_edge_w) {
            hover_region.style.cursor = "row-resize";
            y_handler = perhaps_drag_bottom_edge_handler;
            x_handler = undefined;
            xy_handler = undefined;
          } else if (perhaps_drag_xy_handler) {
            hover_region.style.cursor = "move";
            xy_handler = perhaps_drag_xy_handler;
            x_handler = undefined;
            y_handler = undefined;
          } else if (perhaps_drag_x_handler) {
            hover_region.style.cursor = perhaps_drag_y_handler ? "move" : "ew-resize";
            x_handler = perhaps_drag_x_handler;
            y_handler = perhaps_drag_y_handler;
            xy_handler = undefined;
          } else if (perhaps_drag_y_handler) {
            hover_region.style.cursor = "ns-resize";
            y_handler = perhaps_drag_y_handler;
            x_handler = undefined;
            xy_handler = undefined;
          } else {
            hover_region.style.cursor = "default";
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
          pressed = true;
          click_start = new Date();
          start_x = evt.clientX;
          start_y = evt.clientY;
          fig_bb = state.hover_regions_svg()!.getBoundingClientRect();
          evt.stopPropagation();
          evt.preventDefault();
          // but still need to gain focus on SNP
          // Need to focus snp_outer, or whatever has our keyboard command handlers,
          // so that cmd-d etc work after user clicks the plot
          state.snp_outer.focus({ preventScroll: true });
        });

        hover_region.addEventListener("click", evt => {
          // Prevent hitting the deselection handler on the hover regions container
          evt.preventDefault();
          evt.stopPropagation();
        });

        document.addEventListener("mousemove", evt => {
          if (pressed) {
            const dx = evt.clientX - start_x;
            const dy = evt.clientY - start_y;
            const client_px_in_fig: [number, number] = [evt.clientX - fig_bb.x, fig_bb.bottom - evt.clientY];
            if (xy_handler) { xy_handler(client_px_in_fig, [dx, dy], fig_bb, boundses); }
            if (x_handler)  { x_handler(client_px_in_fig[0], dx, fig_bb, boundses); }
            if (y_handler)  { y_handler(client_px_in_fig[1], dy, fig_bb, boundses); }
            state.hover_regions_container.classList.add("hide_during_interaction");
            evt.preventDefault();
            evt.stopPropagation();
          }
        });

        document.addEventListener("mouseup", evt => {
          if (pressed) {
            pressed = false;
            // state.hover_regions_container.classList.remove("hidden");
            state.hover_regions_container.classList.remove("hide_during_interaction");

            // Consider it a click if the mouse didn't move
            const dx = evt.clientX - start_x;
            const dy = evt.clientY - start_y;
            if (dx === 0 && dy === 0 && new Date().getTime() - click_start.getTime() < 200) {
              select_layer(layer, state)
            }

            refresh_hover_regions(state);
          }
        });
      });
    });
  });

  compute_selected_hover_regions(state);
}



// /**
//  * Makes 'hover regions' so that hovering on an artist in the plot
//  * selects it/provides some feedback in the sidebar
//  */
// export function make_hover_regions(state: State): {
//   el: HTMLElement;
//   regions: { [artist_id: number]: HoverRegion };
// } {
//   const regions: { [artist_id: number]: HoverRegion } = {};
//   const hover_regions_el = create_el(
//     "div",
//     "snp-hover-regions",
//     state.snp_outer
//   );

//   const hoverable_els = Array.from(state.snp_outer.querySelector(".hover_regions > svg")?.querySelectorAll('[data-artist-id]') || []) as SVGGElement[];

//   const create_region = (
//     artist_id: number,
//     artist_view: ArtistView | null = null
//   ): HoverRegion => {
//     // Find SVG Group element for the artist
//     const hovered_el = hoverable_els.find(el => parseInt(el.getAttribute("data-artist-id") || "-1") == artist_id)!;

//     const h_bbox = hovered_el.getBoundingClientRect();
//     const p_bbox = hover_regions_el.getBoundingClientRect();

//     const top = h_bbox.top - p_bbox.top;
//     const left = h_bbox.left - p_bbox.left;

//     const region_el = create_el("div", "snp-hover-region", hover_regions_el);

//     region_el.style.top = `${top}px`;
//     region_el.style.left = `${left}px`;
//     region_el.style.width = `${h_bbox.width}px`;
//     region_el.style.height = `${h_bbox.height}px`;

//     return { el: region_el, calls: [], methods: [], artist: artist_view };
//   };

//   const add_hover_region_hover_effects_for = (region: HoverRegion, el: HTMLElement) => {
//     el.addEventListener("mouseover", () => region.el.classList.add("hovered"));
//     el.addEventListener("mouseout", () =>
//       region.el.classList.remove("hovered")
//     );
//   };

//   // Go through the artists
//   for (const artist_info of state.selectable_artists) {
//     const artist_view = state.sidebar?.artists[artist_info.id]!;

//     // Create the region el for that artist
//     regions[artist_info.id] = create_region(artist_info.id, artist_view);

//     // Show the element on hover of the label
//     // add_hover_region_hover_effects_for(regions[artist_info.id], artist_view.els.header_el);

//     // Calls
//     const calls = state.calls_and_methods_by_artist![artist_info.id].calls;
//     for (let i = 0; i < calls.length; i++) {
//       const call = calls[i];
//       const region_artist_id = call.call_info.show_on.at(-1)!;

//       regions[region_artist_id] =
//         regions[region_artist_id] ?? create_region(region_artist_id);

//       // Show the element on hover of the label
//       const call_view = state.sidebar?.artists[artist_info.id].calls[i]!;
//       regions[region_artist_id].calls.push({
//         view: call_view,
//         info: call.call_info,
//       });

//       // add_hover_region_hover_effects_for(regions[region_artist_id], call_view.els.header_el);
//     }

//     // Methods
//     const methods = state.calls_and_methods_by_artist![artist_info.id].methods;
//     for (let i = 0; i < methods.length; i++) {
//       const method = methods[i];
//       const region_artist_id = method.method_info.show_on.at(-1)!;

//       regions[region_artist_id] =
//         regions[region_artist_id] ?? create_region(region_artist_id);

//       // Show the element on hover of the label
//       const method_view = state.sidebar?.artists[artist_info.id].methods[i]!;
//       regions[region_artist_id].methods.push({
//         view: method_view,
//         info: method.method_info,
//       });

//       add_hover_region_hover_effects_for(regions[region_artist_id], method_view.el);

//       add_method_trigger_to_hover_region(
//         regions[region_artist_id],
//         method,
//         method_view,
//         state
//       );
//     }
//   }

//   // Clicking on region should focus on the calls and methods of it
//   for (const [_, region] of Object.entries(regions)) {
//     region.el.addEventListener("click", () => {
//       add_temporary_focus(region.el);

//       region.calls.forEach(call => {
//         focus_on_call(call.info, call.view, state);
//       });

//       region.methods.forEach(method => {
//         focus_on_method(method.info, method.view, state);
//       });

//       // if (region.artist != undefined) {
//       //   add_temporary_focus(region.artist.els.el);
//       // }
//     });
//   }

//   return { el: hover_regions_el, regions };
// }

// export function add_method_trigger_to_hover_region(
//   region: HoverRegion,
//   method: MethodWithCode,
//   method_view: MethodView,
//   state: State
// ) {
//   const trigger_el = create_el("div", "snp-trigger", region.el);
//   trigger_el.innerText = method_view.el.innerText;

//   // On method click
//   trigger_el.addEventListener("click", () => {
//     add_method_code(method_view.mark, method.code, state);
//   });
// }

// // Hover regions
// for (const region of state.view.hovered_elems) {
//   const region_names: string[] = JSON.parse(
//     region.getAttribute("data-artist-names")!
//   );
//   const region_name = get_shortest_qualified_name(region_names);

//   if (region_name == artist_name) {
//     header_el.addEventListener("mouseover", () => {
//       const path = region.children[0] as SVGPathElement;
//       path.classList.add("hovered");
//     });
//     header_el.addEventListener("mouseout", () => {
//       const path = region.children[0] as SVGPathElement;
//       path.classList.remove("hovered");
//     });

//     break;
//   }
// }
