import { refresh_hover_regions } from "../../code_sync/code_sync";
import {
  State,
} from "../../types";
import { zip, equalByJSON } from "../../utils/array";
import { place_centered_over_shape, reposition_to_avoid_overlap } from "../../utils/misc";
import { perhaps_get_drag_x_handler, perhaps_get_drag_width_handler } from "../call/call";
import { create_method_view } from "../methods/method";
import "./hover_regions.css";


export function place_add_method_buttons_on_plot(state: State) {

  const svg_overlay_el = state.hover_regions_svg();

  if (!svg_overlay_el) { return; }

  const hover_regions: Element[] = Array.from(svg_overlay_el.querySelectorAll('[data-artist-id]'));

  // Draw add method widgets on appropriate hover regions
  const placed_methods: HTMLElement[] = [];
  state.methods.forEach(method => {
    // Skip if already called
    const dont_show = method.method_info.max_calls == 1 && state.calls.some(call => call.loc_via_func_code_and_num[0] == `${method.receiver_name}.${method.method_info.name}`);
    if (dont_show) { return; }

    const show_on = method.method_info.show_on.at(-1);

    hover_regions.filter(el => parseInt(el.getAttribute("data-artist-id") || "-1") == show_on).forEach(hover_region => {
      const { el: method_el } = create_method_view(method, state);
      state.snp_outer.append(method_el); // Have to place in DOM first so it has width/height for centering
      place_centered_over_shape(hover_region, method_el, state.snp_outer);
      reposition_to_avoid_overlap(method_el, placed_methods, state.snp_outer);
      placed_methods.push(method_el);
    });
  });
}


export function attach_events_to_hover_regions(state: State) {

  const svg_overlay_el = state.hover_regions_svg();

  if (!svg_overlay_el) { return; }

  (Array.from(svg_overlay_el.querySelectorAll('[data-artist-id] > [stroke-width]')) as SVGElement[]).forEach(hover_region => {
    hover_region.dataset.origStrokeWidth = hover_region.getAttribute("stroke-width") || undefined;
    hover_region.addEventListener("mouseover", () => { hover_region.setAttribute("stroke-width", "2.0"); });
    hover_region.addEventListener("mouseout", () => { hover_region.setAttribute("stroke-width", hover_region.dataset.origStrokeWidth || "0"); });
  });


  // Attach drag handlers to artists that are the result of calls in the code
  //
  // The handling has to be routed through the layers UI elemnt because all the logic
  // for attaching the arguments to the code is buried there, including adding new args
  // and modifying current args.
  state.layers.forEach(layer => {
    // Layers in practice only have zero or one calls, but the types and code allow more.
    zip(layer.calls_with_args, layer.call_views).forEach(([call_with_args, call_view]) => {
      const call_info = call_with_args.call_info;

      const perhaps_drag_x_handler     = perhaps_get_drag_x_handler(call_view);
      const perhaps_drag_width_handler = perhaps_get_drag_width_handler(call_view);

      const hover_regions_for_call =
        (Array.from(svg_overlay_el.querySelectorAll('[data-func-code-and-num]')) as SVGElement[]).filter(hover_region => {
          return equalByJSON(JSON.parse(hover_region.dataset.funcCodeAndNum || ""), call_info.loc_via_func_code_and_num);
        });

      hover_regions_for_call.forEach(hover_region => {

        let pressed = false;
        let start_x = 0;
        let start_y = 0;

        // Separate X and Y handlers is simple but did not scale in Sketch-n-Sketch b/c
        // some Xs and Ys were dependent on each other and needed to be solved for
        // together. BUT Sketch-n-Sketch was trying to show off fancy solving, maybe
        // our use case will not need a complicated solver.
        let x_handler : ((delta: number) => void) | undefined = undefined;
        let y_handler : ((delta: number) => void) | undefined = undefined;

        let units_per_x_px = hover_region.dataset.dxPerPx ? parseFloat(hover_region.dataset.dxPerPx) : 0.0;
        let units_per_y_px = hover_region.dataset.dyPerPx ? parseFloat(hover_region.dataset.dyPerPx) : 0.0;

        const edge_w = 10;

        // Determine whether we are dragging the middle or the edge
        hover_region.addEventListener("mousemove", evt => {
          const { x, right } = hover_region.getBoundingClientRect();

          if (perhaps_drag_width_handler && (evt.clientX < x + edge_w || evt.clientX > right - edge_w)) {
            hover_region.style.cursor = "ew-resize";
            x_handler = perhaps_drag_width_handler;
          } else if (perhaps_drag_x_handler) {
            hover_region.style.cursor = "move";
            x_handler = perhaps_drag_x_handler;
          }
        });

        hover_region.addEventListener("mousedown", evt => {
          // console.log(call_with_args)
          // console.log(evt)
          // console.log(hover_region.getBoundingClientRect())
          // console.log(hover_region.getClientRects())
          pressed = true;
          state.hover_regions_container.classList.add("hidden");
          start_x = evt.clientX;
          start_y = evt.clientY;
          evt.preventDefault();
          evt.stopPropagation();
        });

        document.addEventListener("mousemove", evt => {
          if (pressed) {
            const dx = (evt.clientX - start_x) * units_per_x_px;
            const dy = (evt.clientY - start_y) * units_per_y_px;
            console.log(dx,dy);
            if (x_handler) { x_handler(dx); }
            evt.preventDefault();
            evt.stopPropagation();
          }
        });

        document.addEventListener("mouseup", _ => {
          if (pressed) {
            pressed = false;
            state.hover_regions_container.classList.remove("hidden");
            refresh_hover_regions(state);
          }
        });
      });
    });
  });
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
//   method: MethodWithArgs,
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
