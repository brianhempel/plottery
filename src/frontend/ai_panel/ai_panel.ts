import { fetch_server_llm_keys, hard_rerun, preview_figure_only } from "../code_sync/code_sync";
import { State } from "../types";
import { LineHandle } from "../utils/codemirror";
import { rate_limit, log_event } from "../utils/instrumentation";
import { current_llm_settings, get_llm_config, llm_api_key, llm_config_constants, LLMProviderSettings, prompt_llm, set_llm_provider, update_llm_provider_settings } from "../utils/llm";
import { create_el, get_persistent_item, notebook_code_cells, set_persistent_item } from "../utils/misc";
import { Cell, JupyterType } from "../utils/types";

// Globally exposed by our extension (nbextension_plottery/main.js and plottery_jupyter/plottery_jupyter.js)
// so we don't duplicate the figure/axes annotation logic in this bundle.
declare const __plottery_annotate_figure_axes_params: ((cell_code: string, notebook_code_through_cell: string) => string) | undefined;
(window as any).__plottery_annotate_figure_axes_params ||= (window as any).__plottery_annotate_figure_axes_params;

export function create_ai_panel(state: State): HTMLElement {
  const panel_el = create_el("div", "plottery-ai-panel");
  const panel_heading = create_el("h2", [], panel_el);
  panel_heading.append("AI")

  // Provider / model / effort sit right in the header — they're the knobs worth fiddling with
  // while prompting. Only the endpoint and API key live behind the gear.
  const header_controls = create_el("div", "plottery-ai-header-controls", panel_heading);

  // Gear button (right of the header controls) toggles the LLM config panel.
  const gear_btn = create_el("span", "plottery-ai-config-toggle", panel_heading) as HTMLButtonElement;
  gear_btn.title = 'AI Settings';
  gear_btn.textContent = '⚙\uFE0E'; // ⚙︎ in text style. second char signals to be not emoji
  gear_btn.style.fontSize = '20px';
  gear_btn.style.lineHeight = '10px';
  gear_btn.style.marginTop = '-2px';

  // Whether the user has explicitly opened (true) or closed (false) the config; undefined means
  // "no opinion", so the default rule applies: show it exactly when the active provider has no
  // usable key, so the user can add one. Picking a provider clears the opinion, so switching to
  // one you have no key for pops the key field open (and switching back tucks it away again).
  let user_wants_config: boolean | undefined = undefined;
  function reconsider_config_visibility() {
    const has_key = llm_api_key(state.llm_api_keys).trim().length > 0;
    config_panel.classList.toggle("hidden", user_wants_config === undefined ? has_key : !user_wants_config);
  }

  const config_panel = create_config_ui(state, header_controls, () => {
    user_wants_config = undefined; // the new provider gets the default rule, not the old one's fate
    reconsider_config_visibility();
  });
  panel_el.append(config_panel);
  // The server keys aren't known until fetch_server_llm_keys resolves below, so this first pass
  // sees only the user's own key (state.llm_api_keys starts empty); the .then() reconsiders
  // once they land.
  reconsider_config_visibility();
  gear_btn.addEventListener("click", () => {
    user_wants_config = config_panel.classList.contains("hidden");
    reconsider_config_visibility();
  });

  // The server's keys are deliberately not baked into the saved notebook (that would leak them
  // when shared), so we pull them from the kernel here and fill in state.llm_api_keys, which
  // every prompt_llm call and the config panel read. Fired now (at render) to get a head start;
  // the box is unlikely to be used before it resolves. Everything key-dependent re-settles here.
  fetch_server_llm_keys(state).then(keys => {
    state.llm_api_keys = keys;
    config_panel.refresh(); // the API-key placeholder now reflects whether the server has one
    reconsider_config_visibility();
  });

  const prompt_wrapper = create_el("div", "plottery-ai-prompt-wrapper", panel_el);

  const prompt_el = create_el("input", [], prompt_wrapper) as HTMLInputElement;
  prompt_el.placeholder = "🤖 How should I change the plot?";

  // Submitting/accepting a prompt reruns the cell, which tears this panel down and builds a new
  // one; the flag apply_code_to_cell left behind (it outlives the rerun) says the box was where
  // the user was working, so put them back in it. Deferred a tick because the panel isn't in the
  // DOM until attach_plottery appends it.
  if (get_persistent_item(state, "ai_prompt_focus") === "true") {
    set_persistent_item(state, "ai_prompt_focus", "");
    setTimeout(() => prompt_el.focus(), 0);
  }

  const spinner_el = create_el("div", "plottery-spinner", prompt_wrapper);

  // ---- Live preview ----
  // After 222ms of typing pause, send the prompt to the LLM and preview the resulting figure
  // and code. The code is written into the cell as one minimal replaceRange over the changed
  // span (never setValue: that would destroy the marks every widget syncs through; marks
  // outside the span survive both showing and reverting the preview) with the changed lines
  // highlighted. A preview is only shown while the box's text matches the prompt that
  // produced it; any other time we restore the original figure and code. The input handler
  // reverts before the debounce timer can fire, so prompts are always built from the
  // original cell code, never from previewed code.

  let debounce_timer: number | undefined = undefined;
  let inflight: { user_prompt: string, xhr: XMLHttpRequest } | undefined = undefined;
  let preview: { user_prompt: string, code: string } | undefined = undefined;
  // A reply that wasn't code (a refusal or a question). Shown in the output area instead of
  // the code box; tracked like a preview so it survives until the prompt text changes.
  let message: { user_prompt: string } | undefined = undefined;
  // A failed preview request (bad model name, bad key, timeout), also shown in the output
  // area. Tracked separately from `message` so Enter still resubmits rather than treating it
  // as a reply to accept — the config may have been fixed since it failed.
  let error_shown: { user_prompt: string } | undefined = undefined;
  // Captured just before the first preview swaps the figure, so reverting restores the
  // original render even after several successive previews.
  let original: {
    img_src: string, stdout_html: string, hover_regions_hidden: boolean,
    cell_code: string,           // editor text before the preview was written into it
    previewed_cell_code: string, // editor text as the preview left it
    highlighted_lines: number[],
  } | undefined = undefined;
  let last_warm: { prefix: string, time: number } | undefined = undefined;

  function cancel_pending() {
    if (debounce_timer !== undefined) { window.clearTimeout(debounce_timer); debounce_timer = undefined; }
    if (inflight) { inflight.xhr.abort(); inflight = undefined; }
    spinner_el.style.display = '';
  }

  function preview_is_current(): boolean {
    return preview !== undefined && preview.user_prompt === prompt_el.value;
  }

  function message_is_current(): boolean {
    return message !== undefined && message.user_prompt === prompt_el.value;
  }

  // Write the preview code into the editor and highlight the changed lines (by content,
  // the same rule apply_code_to_cell uses).
  function show_code_preview(new_code: string) {
    const cm = state.cell.code_mirror as any;
    original!.previewed_cell_code = new_code;
    if (cm.getValue() === new_code) return;
    const old_lines = cm.getValue().split("\n");
    replace_changed_span(cm, new_code);
    new_code.split("\n").forEach((line_text, line) => {
      if (!old_lines.includes(line_text)) {
        original!.highlighted_lines.push(line);
        cm.addLineClass(line, "gutter", "plottery-ai-line-changed");
        cm.addLineClass(line, "background", "plottery-ai-line-changed");
      }
    });
  }

  // The pre-preview render/code, captured before anything is swapped (see `original`).
  function snapshot() {
    return {
      img_src: (state.plot_area.querySelector("img") as HTMLImageElement).src,
      stdout_html: state.stdout_stderr.innerHTML,
      hover_regions_hidden: state.hover_regions_container.classList.contains("hidden"),
      cell_code: state.cell.code_mirror.getValue(),
      previewed_cell_code: state.cell.code_mirror.getValue(),
      highlighted_lines: [] as number[],
    };
  }

  function revert_preview() {
    preview = undefined;
    message = undefined;
    error_shown = undefined;
    if (!original) return;
    const cm = state.cell.code_mirror as any;
    // Remove highlights first, while the recorded line numbers still describe the previewed doc.
    original.highlighted_lines.forEach(line => {
      if (line < cm.lineCount()) {
        cm.removeLineClass(line, "gutter", "plottery-ai-line-changed");
        cm.removeLineClass(line, "background", "plottery-ai-line-changed");
      }
    });
    // Restore the code with the inverse minimal replace — unless the user edited the cell
    // during the preview; never clobber their edits.
    if (cm.getValue() === original.previewed_cell_code && original.previewed_cell_code !== original.cell_code) {
      replace_changed_span(cm, original.cell_code);
    }
    (state.plot_area.querySelector("img") as HTMLImageElement).src = original.img_src;
    state.stdout_stderr.innerHTML = original.stdout_html;
    state.hover_regions_container.classList.toggle("hidden", original.hover_regions_hidden);
    original = undefined;
  }

  function request_preview() {
    const user_prompt = prompt_el.value;
    if (user_prompt.trim() === "") return;
    if (preview_is_current()) return;
    if (message_is_current()) return;
    if (inflight?.user_prompt === user_prompt) return;
    inflight?.xhr.abort();

    spinner_el.style.display = "block";
    log_event("ai", "live preview request", { prompt: user_prompt });

    const xhr = prompt_llm(
      prompt_messages_for_llm(user_prompt, state),
      reply => {
        if (inflight?.xhr === xhr) { inflight = undefined; spinner_el.style.display = ''; }
        if (prompt_el.value !== user_prompt) return; // Stale: the user kept typing.

        const raw_code = reply_to_new_cell_code(reply, state);
        if (raw_code === undefined) {
          log_event("ai", "live preview diff apply failed", { prompt: user_prompt, reply });
          return;
        }

        // A reply that isn't code (a refusal, a question) falls through reply_to_new_cell_code
        // as its own prose, which would replace the cell with English. Show it as a warning
        // instead and leave the code and figure alone.
        if (drops_show_call(state.cell.get_text(), raw_code)) {
          log_event("ai", "live preview non-code reply", { prompt: user_prompt, reply });
          original ||= snapshot();
          show_ai_message(state, reply);
          message = { user_prompt };
          return;
        }

        // The editor previews the raw code; the annotated version is what runs in the
        // kernel and what Enter commits (same as the pre-preview flow).
        const code = annotate_code(raw_code, state);
        log_event("ai", "live preview response", { prompt: user_prompt, code });

        original ||= snapshot();
        show_code_preview(raw_code);
        const this_preview = { user_prompt, code };
        preview = this_preview;
        // Kernel executions can't be aborted, so gate the image swap on this preview still
        // being the live one when the output message arrives.
        preview_figure_only(state, code, () => preview === this_preview);
      },
      error_message => {
        if (inflight?.xhr === xhr) { inflight = undefined; spinner_el.style.display = ''; }
        log_event("ai", "live preview error", { prompt: user_prompt, message: error_message });
        if (prompt_el.value !== user_prompt) return; // Stale: the user kept typing.
        // Surface it where non-code replies go — a misconfigured model/key otherwise makes
        // the panel look like it's doing nothing at all.
        original ||= snapshot();
        show_ai_error(state, error_message);
        error_shown = { user_prompt };
      },
      state.llm_api_keys
    );
    inflight = { user_prompt, xhr };
  }

  prompt_el.addEventListener("input", () => {
    if (debounce_timer !== undefined) { window.clearTimeout(debounce_timer); debounce_timer = undefined; }
    if (inflight && inflight.user_prompt !== prompt_el.value) { inflight.xhr.abort(); inflight = undefined; spinner_el.style.display = ''; }
    if ((preview && !preview_is_current()) || (message && !message_is_current()) ||
        (error_shown && error_shown.user_prompt !== prompt_el.value)) revert_preview();
    if (prompt_el.value.trim() !== "") {
      debounce_timer = window.setTimeout(() => { debounce_timer = undefined; request_preview(); }, 222);
    }
  });

  // The prompt shares a long prefix (the whole notebook code) across every keystroke's
  // request, and providers cache prompt prefixes for a few minutes, so send just the prefix
  // on focus to warm that cache. Worth 1-5s per request on OpenAI, only ~50ms on Inception
  // (Mercury's prefill is nearly free), but it costs nothing to keep for both.
  prompt_el.addEventListener("focus", () => {
    const { prefix } = prompt_prefix_for_llm(state);
    if (last_warm && last_warm.prefix === prefix && new Date().getTime() - last_warm.time < 3 * 60 * 1000) return;
    last_warm = { prefix, time: new Date().getTime() };
    log_event("ai", "warm llm cache", {});
    prompt_llm([prefix], () => {}, () => {}, state.llm_api_keys, { is_warmup: true });
  });

  prompt_el.addEventListener("keydown", ev => {
    if (ev.code === "Enter" && (prompt_el.value.trim() !== "" || ev.ctrlKey)) {
      ev.stopPropagation();
      ev.preventDefault();
      if (preview_is_current()) {
        const { user_prompt, code } = preview!;
        // The editor already shows the previewed code; highlight against the pre-preview
        // code so accepting still marks what the AI changed.
        const code_before_ai_changes = original?.cell_code;
        cancel_pending();
        preview = undefined;
        original = undefined; // hard_rerun below replaces the whole output; nothing to restore
        log_event("ai", "live preview accept", { prompt: user_prompt, code });
        apply_code_to_cell(code, state, code_before_ai_changes);
      } else if (message_is_current()) {
        // Nothing to accept: the shown reply wasn't code. Leave it up; Escape dismisses it.
        log_event("ai", "non-code reply accept attempt", { prompt: prompt_el.value });
        cancel_pending();
      } else {
        cancel_pending();
        revert_preview();
        submit_prompt(prompt_el, spinner_el, state);
      }
    } else if (ev.code === "Escape") {
      ev.stopPropagation();
      ev.preventDefault();
      log_event("ai", "live preview esc", { prompt: prompt_el.value });
      cancel_pending();
      revert_preview();
      prompt_el.value = "";
    } else {
      rate_limit("ai prompt writing", 2000, () => { log_event("ai", "prompt writing", {prompt: prompt_el.value}); });
    }
  });

  return panel_el;
}

// The LLM config controls, split across two places: provider / model / effort go inline in the
// AI header (`header_el`, always visible), while endpoint / API key go in the panel this
// returns, which the gear shows and hides.
// Every change is written straight to localStorage via save_llm_config, so the next prompt
// request (which reads get_llm_config fresh) picks it up. Changing the provider switches to
// that provider's own model/effort/endpoint/key and re-renders both halves, then calls
// on_provider_change (the caller re-decides whether the key field should be showing).
// The returned panel has a `.refresh()` that re-renders everything — used when the server keys
// arrive after first render, so the API-key placeholder reflects them.
function create_config_ui(state: State, header_el: HTMLElement, on_provider_change: () => void): HTMLElement & { refresh: () => void } {
  const el = create_el("div", "plottery-ai-config") as HTMLElement & { refresh: () => void };

  // Build one labeled row of the gear panel: <label>text</label> + control.
  function row(label_text: string, control: HTMLElement): HTMLElement {
    const r = create_el("div", "plottery-ai-config-row", el);
    const label = create_el("label", [], r);
    label.append(label_text);
    r.append(control);
    return r;
  }

  // Put a control in the header instead. No room for a label there, so the name is the tooltip.
  function header_control<T extends HTMLElement>(title: string, control: T): T {
    control.title = title;
    header_el.append(control);
    return control;
  }

  // A fixed dropdown. "" is rendered as "(default)" (i.e. don't send the param at all).
  function fixed_dropdown(values: string[], value: string, labels: { [v: string]: string }, on_change: (v: string) => void): HTMLSelectElement {
    const select = create_el("select") as HTMLSelectElement;
    values.forEach(v => {
      const opt = create_el("option", [], select) as HTMLOptionElement;
      opt.value = v;
      opt.append(labels[v] ?? (v === "" ? "(default)" : v));
    });
    select.value = value;
    select.addEventListener("change", () => on_change(select.value));
    return select;
  }

  // A text field, optionally with a dropdown of suggestions (input + datalist) for fields
  // whose suggestions can't be exhaustive: model lists go stale, and a custom endpoint may
  // take model names or effort values we don't know about.
  function text_field(suggestions: string[], value: string, placeholder: string, on_input: (v: string) => void, type = "text"): HTMLInputElement {
    const input = create_el("input") as HTMLInputElement;
    input.type = type;
    input.autocomplete = "off";
    input.placeholder = placeholder;
    input.value = value;
    if (suggestions.length > 0) {
      // Hung off the header (a `datalist` is display:none anyway, so it costs no layout there)
      // rather than the gear panel, whose `display: none` while hidden would take its options
      // with it. Only header fields have suggestions today; this keeps that from mattering.
      const datalist = create_el("datalist", [], header_el) as HTMLDataListElement;
      // Datalist ids must be unique document-wide, and a notebook can have an AI panel per
      // cell. Counter on window (not a top-level `let`, which would break bundle re-injection
      // — AGENTS.md), matching plottery_instrumentation_eventno in instrumentation.ts.
      const seq = (window as any).plottery_datalist_seq = ((window as any).plottery_datalist_seq || 0) + 1;
      datalist.id = `plottery-ai-list-${seq}`;
      suggestions.filter(s => s !== "").forEach(s => {
        const opt = create_el("option", [], datalist) as HTMLOptionElement;
        opt.value = s;
      });
      input.setAttribute("list", datalist.id);
    }
    input.addEventListener("input", () => on_input(input.value));
    return input;
  }

  function render() {
    el.innerHTML = "";
    header_el.innerHTML = "";
    const { provider } = get_llm_config();
    const settings = current_llm_settings();
    const { PROVIDERS } = llm_config_constants();
    const meta = PROVIDERS[provider];
    const update = (changes: Partial<LLMProviderSettings>) => update_llm_provider_settings(provider, changes);

    // Provider dropdown. Switching only changes which provider is active — each provider's
    // model/effort/endpoint/key are stored separately and come back as you left them.
    // Order drives the dropdown; the generic escape hatch goes last.
    const provider_order = ["openai", "anthropic", "gemini", "bedrock", "openrouter", "inception", "cerebras", "openai_compatible"];
    const provider_labels: { [v: string]: string } = {};
    provider_order.forEach(key => { provider_labels[key] = PROVIDERS[key].label; });
    header_control("Provider", fixed_dropdown(provider_order, provider, provider_labels, new_provider => {
      set_llm_provider(new_provider);
      render(); // the endpoint/model/effort fields all depend on the provider
      on_provider_change();
    })).classList.add("plottery-ai-provider-field");

    header_control("Model", text_field(meta.models, settings.model, "model", v => update({ model: v })))
      .classList.add("plottery-ai-model-field");

    // Effort (hidden for providers with no reasoning_effort knob)
    if (meta.efforts.length > 0) {
      const on_effort = (v: string) => update({ effort: v });
      header_control("Effort", meta.custom_effort
        ? text_field(meta.efforts, settings.effort, "(default)", on_effort)
        : fixed_dropdown(meta.efforts, settings.effort, {}, on_effort)).classList.add("plottery-ai-effort-field");
    }

    // Endpoint (providers whose URL isn't fixed: OpenAI Compatible, and Bedrock's region host)
    if (meta.custom_endpoint) {
      row("Endpoint", text_field([], settings.endpoint, meta.default_url || "https://.../v1/chat/completions",
        v => update({ endpoint: v })));
    }

    // API key. Placeholder tells the user a server key is available (env var from plottery.py).
    const server_has_key = (state.llm_api_keys[provider] || "").trim().length > 0;
    row("API Key", text_field([], settings.api_key,
      server_has_key ? `Server has API key. Override here.` : `${meta.label} API key`,
      v => update({ api_key: v }), "password"));
  }

  render();
  el.refresh = render;
  return el;
}

export function attach_ai_line_highlight_clearing_handlers() {
  if (Jupyter) {
    if (!(window as any)['plottery notebook ai line highlight clearing attached']) {
      (window as any)['plottery notebook ai line highlight clearing attached'] = true;
      (Jupyter.notebook as any).events.on('execute.CodeCell', (_ev: any, data: any) => {
        const cm = data.cell.code_mirror;
        cm.eachLine((line: LineHandle) => {
          cm.removeLineClass(line, "gutter", "plottery-ai-line-changed");
          cm.removeLineClass(line, "background", "plottery-ai-line-changed");
        });
      });
    }
  }
}

// some of this is is duplicated with the extension
function is_not_magic(code: string): boolean {
  return !code.startsWith("%%");
}

declare const Jupyter: JupyterType | undefined;
(window as any).Jupyter ||= (window as any).Jupter

// The part of the LLM prompt that doesn't depend on what the user typed, as a complete
// standalone message: it is sent alone on input focus to warm the provider's prompt cache
// (see the focus handler above), then again byte-identical as the first message of every
// real request, with the ask as a second message. It must be its own message — luna only
// prompt-caches whole messages, so a prefix that varies at the tail would never hit.
function prompt_prefix_for_llm(state: State): { prefix: string, last_cell_no: number } {
  const code_cells: Cell[] = notebook_code_cells(state.plottery_outer).filter((cell: Cell) => is_not_magic(cell.get_text()));

  const code_cells_through_cell = code_cells.slice(
    0,
    1 + code_cells.findLastIndex(c => c.element[0] === state.cell.element[0]) // They won't be the same object in JupyterLab because notebook_code_cells makes a new wrapper each time it is called
  );

  let notebook_code = ""
  let last_cell_no = 0

  code_cells_through_cell.forEach((cell, cell_i) => {
    last_cell_no = cell_i + 1
    notebook_code += `### Cell ${last_cell_no} ###\n`;
    notebook_code += cell.get_text();
    notebook_code += "\n";
  })

  const prefix =
`I am writing matplotlib v${state.mpl_version} code in the last cell of the following notebook:

\`\`\`
${notebook_code}
\`\`\`

I will tell you in my next message how to modify the code of Cell ${last_cell_no}.

Note: If I ask to create a function for a subplot and you need to pass in an ax argument, give that parameter a type annotation of mpl.axes._axes.Axes, but _only_ if there is a custom function for the subplot.

Note: If I ask above to add more subplots, use the following form:

\`\`\`
fig = plt.figure(...)
ax1 = fig.add_subplot(...)
ax2 = fig.add_subplot(...)
...
\`\`\`

but _only_ if I ask to add more subplots.

Reply with the changes to Cell ${last_cell_no} as one or more SEARCH/REPLACE blocks, nothing else:

<<<<<<< SEARCH
lines copied exactly from Cell ${last_cell_no}
=======
what those lines should become
>>>>>>> REPLACE

The SEARCH lines must match consecutive lines of Cell ${last_cell_no} character for character. Keep SEARCH as small as possible: just the lines that change, plus a neighboring line only if needed to locate them unambiguously. To insert code without changing any line, put the nearest existing line in SEARCH and repeat it in REPLACE along with the inserted lines. To append at the very end of the cell, use an empty SEARCH section.`;

  return { prefix, last_cell_no };
}

// [prefix message, ask message] — see prompt_prefix_for_llm for why two messages.
function prompt_messages_for_llm(user_prompt: string, state: State): string[] {
  const { prefix, last_cell_no } = prompt_prefix_for_llm(state);

  const ask =
`Modify the code of Cell ${last_cell_no} to ${user_prompt}

Reply with the changes to Cell ${last_cell_no} as one or more SEARCH/REPLACE blocks, nothing else.`;

  return [prefix, ask];
}

// Asking for SEARCH/REPLACE blocks instead of the whole cell keeps completions ~3x smaller,
// and generation time is what dominates request latency.
// The opener tolerates `<<<<<<< SEARCH`, ```SEARCH (fence glued on), or a bare SEARCH line —
// Mercury 2 drops the <<<<<<< marker in ~1/3 of replies while keeping the rest of the block
// intact. The ======= and >>>>>>> REPLACE lines are still required, so a stray "SEARCH" line
// in prose or code can't produce a false block on its own.
function parse_search_replace_blocks(reply: string): { search: string, replace: string }[] {
  const blocks: { search: string, replace: string }[] = [];
  const re = /^(?:<{4,}|`{3,})? *SEARCH *\r?\n([\s\S]*?)^={4,} *\r?\n([\s\S]*?)^>{4,} *REPLACE *$/gm;
  let m;
  while ((m = re.exec(reply)) !== null) {
    const content = (s: string) => s.replace(/\r\n/g, "\n").replace(/\n$/, "");
    blocks.push({ search: content(m[1]), replace: content(m[2]) });
  }
  return blocks;
}

// Line-anchored (a SEARCH of `x = 1` must not match inside `max = 12`), retried
// trailing-whitespace-insensitively. Returns undefined if a SEARCH section doesn't match.
function apply_search_replace_blocks(code: string, blocks: { search: string, replace: string }[]): string | undefined {
  for (const { search, replace } of blocks) {
    if (search.trim() === "") { // empty SEARCH = append at end of cell
      code = code + (code.endsWith("\n") || code === "" ? "" : "\n") + replace;
      continue;
    }
    const code_lines = code.split("\n");
    const search_lines = search.split("\n");
    const find = (cmp: (line: string) => string) => {
      for (let i = 0; i + search_lines.length <= code_lines.length; i++) {
        if (search_lines.every((sl, j) => cmp(sl) === cmp(code_lines[i + j]))) return i;
      }
      return -1;
    };
    let at = find(l => l);
    if (at === -1) at = find(l => l.trimEnd());
    if (at === -1) return undefined;
    code_lines.splice(at, search_lines.length, ...replace.split("\n"));
    code = code_lines.join("\n");
  }
  return code;
}

// Turn the LLM reply into the new cell code (unannotated). The reply should be
// SEARCH/REPLACE blocks applied against the current cell text; if the model ignored the
// format and returned whole code, use that wholesale.
// Returns undefined when the reply's SEARCH sections don't match the cell.
function reply_to_new_cell_code(reply: string, state: State): string | undefined {
  let code: string | undefined;
  const blocks = parse_search_replace_blocks(reply);
  if (blocks.length > 0) {
    code = apply_search_replace_blocks(state.cell.get_text(), blocks);
    if (code === undefined) return undefined;
  } else if (reply.match(/^```(\w*)\n([\s\S]*)\n```/m)) {
      // Extract string between first and last ```
      code = reply.match(/^```(\w*)\n([\s\S]*)\n```/m)![2];
  } else {
      code = reply;
  }
  return code.replace(/### Cell \d.*\n/, '');
}

// Did the reply lose the plt.show()/fig.show() call the cell had? Plottery only renders a cell
// that ends in .show(), so a reply without it is essentially never the edit the user asked for
// — it's the model answering in prose (a refusal, a clarifying question), which
// reply_to_new_cell_code passes through wholesale and would otherwise clobber the code.
function drops_show_call(old_code: string, new_code: string): boolean {
  return old_code.includes(".show(") && !new_code.includes(".show(");
}

// Show a non-code reply where kernel output/errors go, instead of putting it in the code box.
function show_ai_message(state: State, reply: string) {
  state.stdout_stderr.innerHTML = "";
  const msg_el = create_el("div", "plottery-ai-message", state.stdout_stderr);
  msg_el.append(`🤖 ${reply.trim()}`);
}

// Same place, for a request that failed outright. `message` is the provider's own wording
// when it gave us one (a bad model name or key is the common case, and only the provider can
// say which) — otherwise all we honestly know is that something went wrong.
function show_ai_error(state: State, message?: string) {
  state.stdout_stderr.innerHTML = "";
  const msg_el = create_el("div", ["plottery-ai-message", "plottery-ai-error"], state.stdout_stderr);
  msg_el.append(message ? `⚠️ AI request failed: ${message}` : "⚠️ Oops, the AI request failed.");
}

// Inject figure/axes parameter type annotations (mirrors the manual-execution pre-pass in
// the notebook extensions) so calls inside any function the model wrote get recognized. The
// function is shared via the extension-exposed global rather than duplicated here.
function annotate_code(code: string, state: State): string {
  if (__plottery_annotate_figure_axes_params) {
    const code_cells = notebook_code_cells(state.plottery_outer).filter((cell: Cell) => is_not_magic(cell.get_text()));
    const prior_code = code_cells
      .slice(0, code_cells.findLastIndex(c => c.element[0] === state.cell.element[0]))
      .map(c => c.get_text())
      .join("\n");
    code = __plottery_annotate_figure_axes_params(code, `${prior_code}\n${code}`);
  }
  return code;
}

// Swap the editor's content to `new_code` with one replaceRange over the minimal changed
// span (computed by common prefix/suffix), so CodeMirror marks outside the span — which
// every sidebar widget syncs through — survive.
function replace_changed_span(cm: any, new_code: string) {
  const old_code = cm.getValue();
  let p = 0;
  while (p < old_code.length && p < new_code.length && old_code[p] === new_code[p]) p++;
  let s = 0;
  while (s < old_code.length - p && s < new_code.length - p && old_code[old_code.length - 1 - s] === new_code[new_code.length - 1 - s]) s++;
  cm.replaceRange(new_code.slice(p, new_code.length - s), cm.posFromIndex(p), cm.posFromIndex(old_code.length - s));
}

// Put the (accepted) LLM code in the cell, rerun, and highlight the changed lines.
// code_before_ai_changes is what the highlights are computed against — pass it when the
// editor already shows previewed code, so accepting still highlights what the AI changed.
function apply_code_to_cell(code: string, state: State, code_before_ai_changes?: string) {
  const cm = state.cell.code_mirror;

  // Focus code cell so user can undo changes
  if (!Jupyter) { // JupyterLab
    // Set cursor before setValue so it (hopefully) doesn't race with setValue or something.
    cm.setCursor(9999, 9999, { scroll: false })
    cm.focus();
  }

  const old_code_lines = (code_before_ai_changes ?? cm.getValue()).split("\n");
  cm.setValue(code);
  // The rerun replaces the output, so the AI panel the user just hit Enter in is about to be
  // destroyed. This outlives the rerun and tells the freshly attached panel to take focus back
  // (see create_ai_panel), so the user can keep prompting without clicking into the box again.
  set_persistent_item(state, "ai_prompt_focus", "true");
  hard_rerun(state);

  // console.log("old_code_lines", old_code_lines);
  cm.eachLine(line => {
    // console.log("line.text", line.text);
    if(old_code_lines.includes(line.text)) {
      cm.removeLineClass(line, "gutter", "plottery-ai-line-changed");
      cm.removeLineClass(line, "background", "plottery-ai-line-changed");
    } else {
      cm.addLineClass(line, "gutter", "plottery-ai-line-changed");
      cm.addLineClass(line, "background", "plottery-ai-line-changed");
    }
  });

  if (Jupyter) { // Notebooks v6
    // Set cursor after setValue so the cursor is at the end of the cell
    cm.setCursor(9999, 9999, { scroll: false })
    cm.focus({ preventScroll: true });
  }
}

function submit_prompt(prompt_el: HTMLInputElement, spinner_el: HTMLElement, state: State) {
  const cm = state.cell.code_mirror;
  const user_prompt = prompt_el.value;
  prompt_el.blur();
  prompt_el.disabled = true;
  prompt_el.style.opacity = "0.5";
  spinner_el.style.display = "block";

  log_event("ai", "prompt submit", {prompt: user_prompt, code: cm.getValue()});

  function reenable_prompt() {
    prompt_el.disabled = false;
    prompt_el.focus();
    spinner_el.style.display = '';
    prompt_el.style.opacity = '';
  }

  function failure(message?: string) {
    show_ai_error(state, message);
    reenable_prompt();
  }

  prompt_llm(
    prompt_messages_for_llm(user_prompt, state),
    reply => {
      const raw_code = reply_to_new_cell_code(reply, state);
      if (raw_code === undefined) {
        log_event("ai", "diff apply failed", {prompt: user_prompt, reply});
        failure();
        return;
      }
      // Prose, not code (see drops_show_call): show it rather than replacing the cell with it.
      if (drops_show_call(cm.getValue(), raw_code)) {
        log_event("ai", "non-code reply", {prompt: user_prompt, reply});
        show_ai_message(state, reply);
        reenable_prompt();
        return;
      }
      const code = annotate_code(raw_code, state);
      log_event("ai", "llm response", {prompt: user_prompt, code: code});
      apply_code_to_cell(code, state);
    },
    message => {
      log_event("ai", "llm timeout or error", {prompt: user_prompt, message});
      failure(message);
    },
    state.llm_api_keys
  )
}
