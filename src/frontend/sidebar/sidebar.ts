import {
  AppState,
  CallWithArgs,
  MethodWithArgs,
  SelectableArtist,
  SidebarView,
  SidebarViewEls,
} from "../state";
import { MarkerRange, TextMarker } from "../utils/codemirror";
import { create_el } from "../utils/misc";
import { CellMessage } from "../utils/types";
import { create_artist_view } from "./artist/artist";
import "./sidebar.css";

export function create_sidebar(
  all_calls_and_methods: {
    [key: string]: {
      calls: CallWithArgs[];
      methods: MethodWithArgs[];
    };
  },
  selectable_artists: SelectableArtist[]
): SidebarView {
  const sidebar_els = create_sidebar_view_skeleton();

  const sidebar_view: SidebarView = {
    els: sidebar_els,
    artists: {},
  };

  selectable_artists.forEach(artist => {
    const artist_view = create_artist_view(
      artist,
      sidebar_view,
      all_calls_and_methods
    );

    sidebar_view.artists[artist.id] = artist_view;
  });

  return sidebar_view;
}

export function create_sidebar_view_skeleton(): SidebarViewEls {
  // Sidebar container
  const sidebar_el = create_el("div", "snp-sidebar");

  // Create a header for the sidebar
  const header_el = create_el("div", "snp-header", sidebar_el);

  // Create a container for the artists
  const artists_el = create_el("div", "snp-artists", sidebar_el);

  return {
    el: sidebar_el,
    header_el: header_el,
    artists_el: artists_el,
  };
}

export function sync_call_code(mark: TextMarker<MarkerRange>, code: string) {
  let { from, to } = mark.find()!;
  const code_mirror = AppState.model.cell.code_mirror;

  code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find()!);
  code_mirror.setSelection(from, to);

  redraw_cell();
}

export function redraw_cell() {
  const model = AppState.model;
  const view = AppState.view_model;

  const cell = model.cell;
  const codeExecuting = cell.get_text();

  const img = view.snp_outer.querySelector("img")!;

  if (model.busy || codeExecuting == model.last_cell_code_executed) {
    return;
  }

  model.busy = true;
  model.last_cell_code_executed = codeExecuting;
  view.stdout_stderr.innerHTML = "";

  // Hacktastic way to get live feedback
  const callbacks = cell.get_callbacks();

  callbacks.iopub!.output = function (msg: CellMessage) {
    if (
      msg.header.msg_type == "execute_result" &&
      msg.content.data["image/png"]
    ) {
      // Replace background image
      // This also triggers img.onload which calls attach_snp and reattaches all of our events!
      img.src = "data:image/png;base64," + msg.content.data["image/png"];
    } else {
      if (msg.header.msg_type == "error") {
        // Display the error, but adjust line number for the lines we added to the top of the cell.
        view.stdout_stderr.innerText += msg.content.evalue!.replaceAll(
          /\b(line +)(\d+)/gi,
          (_: string, line_space: string, n_str: string) =>
            `${line_space}${
              parseInt(n_str) - model.provenance_is_off_by_n_lines
            }`
        );
      } else if (msg.header.msg_type == "stream") {
        view.stdout_stderr.innerText += msg.content.text;
      } else {
        console.log("[redraw cell]", arguments);
      }
    }

    if (codeExecuting != cell.get_text()) {
      model.busy = false;
      redraw_cell();
    } else {
      model.busy = false;

      // Replace hover regions
      // if (
      //   msg.header.msg_type === "execute_result" &&
      //   msg.content.data["image/svg+xml"] &&
      //   msg.content.data["application/json"]
      // ) {
      //   replace_hover_regions(snp_state, msg.content.data["image/svg+xml"]);
      //   const json = msg.content.data["application/json"];
      //   snp_state.cell_lineno = json.cell_lineno;
      //   snp_state.provenance_is_off_by_n_lines =
      //     json.provenance_is_off_by_n_lines;
      //   attach_events_to_hover_regions(snp_state);
      // }
      // infer_types_and_attach_widgets(snp_state);
    }
  };

  cell.kernel.execute(codeExecuting, callbacks, {
    silent: false,
    store_history: true,
    stop_on_error: true,
  });
}
