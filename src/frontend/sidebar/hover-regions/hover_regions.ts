import {
  ArtistView,
  HoverRegion,
  MethodView,
  MethodWithArgs,
  SNPState,
} from "../../state";
import { create_el } from "../../utils/misc";
import {
  add_method_code,
  add_temporary_focus,
  focus_on_call,
  focus_on_method,
} from "../sidebar";
import "./hover_regions.css";

export function make_hover_regions(state: SNPState): {
  el: HTMLElement;
  regions: { [artist_id: number]: HoverRegion };
} {
  const regions: { [artist_id: number]: HoverRegion } = {};
  const hover_regions_el = create_el(
    "div",
    "snp-hover-regions",
    state.view.snp_outer
  );

  const create_region = (
    artist_id: number,
    artist_view?: ArtistView
  ): HoverRegion => {
    // Find SVG Group element for the artist
    const hovered_el = find_svg_hovered_elem(
      state.view.hovered_elems,
      artist_id
    )!;

    const h_bbox = hovered_el.getBoundingClientRect();
    const p_bbox = hover_regions_el.getBoundingClientRect();

    const top = h_bbox.top - p_bbox.top;
    const left = h_bbox.left - p_bbox.left;

    const region_el = create_el("div", "snp-hover-region", hover_regions_el);

    region_el.style.top = `${top}px`;
    region_el.style.left = `${left}px`;
    region_el.style.width = `${h_bbox.width}px`;
    region_el.style.height = `${h_bbox.height}px`;

    return { el: region_el, calls: [], methods: [], artist: artist_view };
  };

  const attach_hover_region = (region: HoverRegion, el: HTMLElement) => {
    el.addEventListener("mouseover", () => region.el.classList.add("hovered"));
    el.addEventListener("mouseout", () =>
      region.el.classList.remove("hovered")
    );
  };

  // Go through the artists
  for (const artist_info of state.model.selectable_artists) {
    const artist_view = state.view.sidebar?.artists[artist_info.id]!;

    // Create the region el for that artist
    regions[artist_info.id] = create_region(artist_info.id, artist_view);

    // Show the element on hover of the label
    attach_hover_region(regions[artist_info.id], artist_view.els.header_el);

    // Calls
    const calls = state.model.all_calls_and_methods![artist_info.id].calls;
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const region_artist_id = call.call_info.show_on.at(-1)!;

      regions[region_artist_id] =
        regions[region_artist_id] ?? create_region(region_artist_id);

      // Show the element on hover of the label
      const call_view = state.view.sidebar?.artists[artist_info.id].calls[i]!;
      regions[region_artist_id].calls.push({
        view: call_view,
        info: call.call_info,
      });

      attach_hover_region(regions[region_artist_id], call_view.els.header_el);
    }

    // Methods
    const methods = state.model.all_calls_and_methods![artist_info.id].methods;
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      const region_artist_id = method.method_info.show_on.at(-1)!;

      regions[region_artist_id] =
        regions[region_artist_id] ?? create_region(region_artist_id);

      // Show the element on hover of the label
      const method_view =
        state.view.sidebar?.artists[artist_info.id].methods[i]!;
      regions[region_artist_id].methods.push({
        view: method_view,
        info: method.method_info,
      });

      attach_hover_region(regions[region_artist_id], method_view.el);

      add_method_trigger_to_hover_region(
        regions[region_artist_id],
        method,
        method_view,
        state
      );
    }
  }

  // Clicking on region should focus on the calls and methods of it
  for (const [_, region] of Object.entries(regions)) {
    region.el.addEventListener("click", () => {
      if ((window as any)["enable_focus_from_plot"] != true) {
        return;
      }

      add_temporary_focus(region.el);

      region.calls.forEach(call => {
        focus_on_call(call.info, call.view, state);
      });

      region.methods.forEach(method => {
        focus_on_method(method.info, method.view, state);
      });

      if (region.artist != undefined) {
        add_temporary_focus(region.artist.els.el);
      }
    });
  }

  return { el: hover_regions_el, regions };
}

function find_svg_hovered_elem(
  hovered_elems: SVGGElement[],
  artist_id: number
) {
  for (const el of hovered_elems) {
    const el_id = parseInt(el.getAttribute("data-artist-id")!);
    if (el_id == artist_id) {
      return el;
    }
  }

  console.error("No svg hover elem found", hovered_elems, artist_id);
}

export function add_method_trigger_to_hover_region(
  region: HoverRegion,
  method: MethodWithArgs,
  method_view: MethodView,
  state: SNPState
) {
  const trigger_el = create_el("div", "snp-trigger", region.el);
  trigger_el.innerText = method_view.el.innerText;

  // On method click
  trigger_el.addEventListener("click", () => {
    add_method_code(method_view.mark, method.code, state);
  });
}

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
