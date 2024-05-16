import {
  ArtistView,
  DynamicCallInfo,
  CallView,
  CallWithArgs,
  MethodInfo,
  MethodView,
  MethodWithArgs,
  PersistantArtist,
  PersistantCall,
  SelectableArtist,
  SidebarView,
  State,
  StaticCallTypeInfo,
} from "../types";
import { MarkerRange, TextMarker } from "../utils/codemirror";
import {
  create_el,
  find_call_that_satisfies,
  get_shortest_qualified_name,
} from "../utils/misc";
import { CellMessage } from "../utils/types";
import { create_artist_view } from "./artist/artist";
import {
  is_collapsable_collapsed,
  open_collapsable,
} from "./collapsable/collapsable";
import "./sidebar.css";

export function create_sidebar(
  all_calls_and_methods: {
    [key: string]: {
      calls: CallWithArgs<DynamicCallInfo | StaticCallTypeInfo>[];
      methods: MethodWithArgs[];
    };
  },
  selectable_artists: SelectableArtist[],
  state: State
): SidebarView {

  const sidebar_el = create_el("div", "snp-sidebar");

  const sidebar_view: SidebarView = {
    el:         sidebar_el,
    artists_el: create_el("div", "snp-artists", sidebar_el),
    artists: {},
  };

  selectable_artists.forEach(artist => {
    const artist_view = create_artist_view(
      artist,
      sidebar_view,
      all_calls_and_methods[artist.id],
      state
    );

    sidebar_view.artists[artist.id] = artist_view;
  });

  return sidebar_view;
}


export function find_artist_from_method(
  target_method_info: MethodInfo,
  state: State
): { info: SelectableArtist; view: ArtistView } | null {
  for (const artist_info of state.selectable_artists) {
    const artist_view = state.sidebar!.artists[artist_info.id];

    // Each method
    const methods = state.all_calls_and_methods![artist_info.id].methods;
    const includes = methods
      .map(m => m.method_info)
      .includes(target_method_info);

    if (includes) {
      return { info: artist_info, view: artist_view };
    }
  }

  return null;
}

export function find_artist_from_call(
  target_call_info: DynamicCallInfo,
  state: State
): { info: SelectableArtist; view: ArtistView } | null {
  for (const artist_info of state.selectable_artists) {
    const artist_view = state.sidebar!.artists[artist_info.id];

    // Each call
    const calls = state.all_calls_and_methods![artist_info.id].calls;
    const includes = calls.map(c => c.call_info).includes(target_call_info);

    if (includes) {
      return { info: artist_info, view: artist_view };
    }
  }

  return null;
}

export function open_collapsable_artist(
  target_artist: { info: SelectableArtist; view: ArtistView },
  state: State
) {
  let curr_view: ArtistView = target_artist.view;
  let curr_info: SelectableArtist = target_artist.info;

  while (true) {
    // Open it
    open_collapsable(curr_view.els.el);

    // Navigage up to its parent if it has one
    if (curr_info.parent_id == null) break;

    const id = curr_info.parent_id;
    curr_info = state.selectable_artists.find(artist => artist.id == id)!;
    curr_view = state.sidebar!.artists[id];
  }
}

export function focus_on_call(
  target_call_info: DynamicCallInfo,
  target_call_view: CallView,
  state: State
) {
  const target_artist = find_artist_from_call(target_call_info, state);

  if (target_artist == null) {
    console.warn("[Focus on call] No artist found for call.");
    return;
  }

  // Open the artist
  open_collapsable_artist(target_artist, state);

  add_temporary_focus(target_call_view.els.el);
}

export function focus_on_method(
  target_method_info: MethodInfo,
  target_method_view: MethodView,
  state: State
) {
  const target_artist = find_artist_from_method(target_method_info, state);

  if (target_artist == null) {
    console.warn("[Focus on call] No artist found for call.");
    return;
  }

  // Open the artist
  open_collapsable_artist(target_artist, state);

  add_temporary_focus(target_method_view.el);
}

export function focus_on_call_from_code(
  target_code_and_loc: string,
  state: State
) {
  const target_call = find_call_that_satisfies((call_info, _) => {
    const code_and_loc = get_code_and_loc_for_call(call_info);
    return target_code_and_loc == code_and_loc;
  }, state);

  if (target_call != null) {
    focus_on_call(target_call.info, target_call.view, state);
  }
}

export function add_temporary_focus(el: HTMLElement) {
  // Add focus on call view
  el.classList.add("snp-focused");

  // Unfocus on clicking anywhere else
  const unfocus = () => {
    el.classList.remove("snp-focused");
    document.removeEventListener("mousedown", unfocus);
  };

  document.addEventListener("mousedown", unfocus);
}

export function add_method_code(
  mark: TextMarker<MarkerRange>,
  code: string,
  state: State
) {
  let { from, to } = mark.find()!;
  state.cell.code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find()!);
  const prefix = code.split("(")[0];
  const loc = to.line + state.provenance_is_off_by_n_lines + 1;
  (window as any)["snp_focused_call"] = `${prefix}${loc}`;

  hard_rerun(state);
}

export function get_code_and_loc_for_call(call: DynamicCallInfo) {
  return `${call.loc_via_func_code_and_num[0]}${call.call.pos.line}`;
}

export function catalog_open_artists(state: State) {
  const sidebar = state.sidebar!;
  const all_calls_and_methods = state.all_calls_and_methods!;

  const persistent_artists: { [name: string]: PersistantArtist } = {};
  const persistent_calls: { [name: string]: PersistantCall } = {};

  for (const artist_info of state.selectable_artists) {
    const name = get_shortest_qualified_name(artist_info.names);
    const artist_view = sidebar.artists[artist_info.id];

    persistent_artists[name] = {
      collapsed: is_collapsable_collapsed(artist_view.els.el),
    };

    const calls = all_calls_and_methods[artist_info.id].calls;

    for (let i = 0; i < artist_view.calls.length; i++) {
      const call_view = artist_view.calls[i];
      const call = calls[i];
      const code_and_loc = get_code_and_loc_for_call(call.call_info);

      persistent_calls[code_and_loc] = {
        collapsed: is_collapsable_collapsed(call_view.els.el),
        elided: false,
      };
    }
  }

  // ...Store them in window
  (window as any)["snp_persistent_artists"] = persistent_artists;
  (window as any)["snp_persistent_calls"] = persistent_calls;
}

export function hard_rerun(state: State) {
  state.busy = false;
  state.cell.code_mirror.getAllMarks().forEach(mark => mark.clear());

  catalog_open_artists(state);
  state.cell.execute();
}

export function sync_call_code(
  mark: TextMarker<MarkerRange>,
  code: string,
  state: State
) {
  let { from, to } = mark.find()!;

  const code_mirror = state.cell.code_mirror;

  code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find()!);
  code_mirror.setSelection(from, to);

  redraw_cell(state);
}

export function redraw_cell(state: State) {
  const cell = state.cell;
  const codeExecuting = cell.get_text();

  const img = state.snp_outer.querySelector("img")!;

  if (state.busy || codeExecuting == state.last_cell_code_executed) {
    return;
  }

  state.busy = true;
  state.last_cell_code_executed = codeExecuting;
  state.stdout_stderr.innerHTML = "";

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
        state.stdout_stderr.innerText += msg.content.evalue!.replaceAll(
          /\b(line +)(\d+)/gi,
          (_: string, line_space: string, n_str: string) =>
            `${line_space}${
              parseInt(n_str) - state.provenance_is_off_by_n_lines
            }`
        );
      } else if (msg.header.msg_type == "stream") {
        state.stdout_stderr.innerText += msg.content.text;
      } else {
        console.warn("[redraw cell]", arguments);
      }
    }

    if (codeExecuting != cell.get_text()) {
      state.busy = false;
      redraw_cell(state);
    } else {
      state.busy = false;

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
