import { hard_rerun, preview_figure_only } from "../code_sync/code_sync";
import { State } from "../types";
import { LineHandle } from "../utils/codemirror";
import { rate_limit, log_event } from "../utils/instrumentation";
import { current_llm_settings, get_llm_config, llm_api_key, LLMProviderSettings, PROVIDER_ORDER, PROVIDERS, prompt_llm, set_llm_provider, update_llm_provider_settings } from "../utils/llm";
import { create_el, notebook_cells } from "../utils/misc";
import { Cell, JupyterType } from "../utils/types";

// Globally exposed by our extension (nbextension_snp/main.js and snp_jupyter/snp_jupyter.js)
// so we don't duplicate the figure/axes annotation logic in this bundle.
declare const __snp_annotate_figure_axes_params: ((cell_code: string, notebook_code_through_cell: string) => string) | undefined;
(window as any).__snp_annotate_figure_axes_params ||= (window as any).__snp_annotate_figure_axes_params;

export function create_ai_panel(state: State): HTMLElement {
  const panel_el = create_el("div", "snp-ai-panel");
  const panel_heading = create_el("h2", [], panel_el);
  panel_heading.append("AI")

  // Gear button (right of the "AI" header) toggles the LLM config panel.
  const gear_btn = create_el("button", "snp-ai-config-toggle", panel_heading) as HTMLButtonElement;
  gear_btn.type = "button";
  gear_btn.title = "AI settings";
  gear_btn.innerHTML = GEAR_ICON_SVG;

  const config_panel = create_config_panel(state);
  panel_el.append(config_panel);
  // Open config by default when there's no usable key yet, so the user can add one.
  config_panel.classList.toggle("hidden", llm_api_key(state.llm_api_keys).trim().length > 0);
  gear_btn.addEventListener("click", () => config_panel.classList.toggle("hidden"));

  const prompt_wrapper = create_el("div", "snp-ai-prompt-wrapper", panel_el);

  const prompt_el = create_el("input", [], prompt_wrapper) as HTMLInputElement;
  prompt_el.placeholder = "🤖 How should I change the plot?";

  const spinner_el = create_el("div", "snp-spinner", prompt_wrapper);

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
        cm.addLineClass(line, "gutter", "snp-ai-line-changed");
        cm.addLineClass(line, "background", "snp-ai-line-changed");
      }
    });
  }

  function revert_preview() {
    preview = undefined;
    if (!original) return;
    const cm = state.cell.code_mirror as any;
    // Remove highlights first, while the recorded line numbers still describe the previewed doc.
    original.highlighted_lines.forEach(line => {
      if (line < cm.lineCount()) {
        cm.removeLineClass(line, "gutter", "snp-ai-line-changed");
        cm.removeLineClass(line, "background", "snp-ai-line-changed");
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
        // The editor previews the raw code; the annotated version is what runs in the
        // kernel and what Enter commits (same as the pre-preview flow).
        const code = annotate_code(raw_code, state);
        log_event("ai", "live preview response", { prompt: user_prompt, code });

        original ||= {
          img_src: (state.plot_area.querySelector("img") as HTMLImageElement).src,
          stdout_html: state.stdout_stderr.innerHTML,
          hover_regions_hidden: state.hover_regions_container.classList.contains("hidden"),
          cell_code: state.cell.code_mirror.getValue(),
          previewed_cell_code: state.cell.code_mirror.getValue(),
          highlighted_lines: [],
        };
        show_code_preview(raw_code);
        const this_preview = { user_prompt, code };
        preview = this_preview;
        // Kernel executions can't be aborted, so gate the image swap on this preview still
        // being the live one when the output message arrives.
        preview_figure_only(state, code, () => preview === this_preview);
      },
      () => {
        if (inflight?.xhr === xhr) { inflight = undefined; spinner_el.style.display = ''; }
        log_event("ai", "live preview error", { prompt: user_prompt });
      },
      state.llm_api_keys
    );
    inflight = { user_prompt, xhr };
  }

  prompt_el.addEventListener("input", () => {
    if (debounce_timer !== undefined) { window.clearTimeout(debounce_timer); debounce_timer = undefined; }
    if (inflight && inflight.user_prompt !== prompt_el.value) { inflight.xhr.abort(); inflight = undefined; spinner_el.style.display = ''; }
    if (preview && !preview_is_current()) revert_preview();
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

const GEAR_ICON_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

// Datalist ids must be unique document-wide, and a notebook can have an AI panel per cell.
let datalist_seq = 0;

// The LLM config panel opened by the gear icon: provider / endpoint / model / effort / API key.
// Every change is written straight to localStorage via save_llm_config, so the next prompt
// request (which reads get_llm_config fresh) picks it up. Changing the provider resets model,
// effort, and endpoint to that provider's defaults and re-renders the form.
function create_config_panel(state: State): HTMLElement {
  const el = create_el("div", "snp-ai-config");

  // Build one labeled row: <label>text</label> + control.
  function row(label_text: string, control: HTMLElement): HTMLElement {
    const r = create_el("div", "snp-ai-config-row", el);
    const label = create_el("label", [], r);
    label.append(label_text);
    r.append(control);
    return r;
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
      const datalist = create_el("datalist", [], el) as HTMLDataListElement;
      datalist.id = `snp-ai-list-${++datalist_seq}`;
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
    const { provider } = get_llm_config();
    const settings = current_llm_settings();
    const meta = PROVIDERS[provider];
    const update = (changes: Partial<LLMProviderSettings>) => update_llm_provider_settings(provider, changes);

    // Provider dropdown. Switching only changes which provider is active — each provider's
    // model/effort/endpoint/key are stored separately and come back as you left them.
    const provider_labels: { [v: string]: string } = {};
    PROVIDER_ORDER.forEach(key => { provider_labels[key] = PROVIDERS[key].label; });
    row("Provider", fixed_dropdown(PROVIDER_ORDER, provider, provider_labels, new_provider => {
      set_llm_provider(new_provider);
      render(); // the endpoint/model/effort fields all depend on the provider
    }));

    // Endpoint (providers whose URL isn't fixed: OpenAI Compatible, and Bedrock's region host)
    if (meta.custom_endpoint) {
      row("Endpoint", text_field([], settings.endpoint, meta.default_url || "https://.../v1/chat/completions",
        v => update({ endpoint: v })));
    }

    row("Model", text_field(meta.models, settings.model, "model", v => update({ model: v })));

    // Effort (hidden for providers with no reasoning_effort knob)
    if (meta.efforts.length > 0) {
      const on_effort = (v: string) => update({ effort: v });
      row("Effort", meta.custom_effort
        ? text_field(meta.efforts, settings.effort, "(default)", on_effort)
        : fixed_dropdown(meta.efforts, settings.effort, {}, on_effort));
    }

    // API key. Placeholder tells the user a server key is available (env var from snp.py).
    const server_has_key = (state.llm_api_keys[provider] || "").trim().length > 0;
    row("API Key", text_field([], settings.api_key,
      server_has_key ? `Server has ${meta.label} API key. Leave blank to use.` : `${meta.label} API key`,
      v => update({ api_key: v }), "password"));
  }

  render();
  return el;
}

export function attach_ai_line_highlight_clearing_handlers() {
  if (Jupyter) {
    if (!(window as any)['plottery notebook ai line highlight clearing attached']) {
      (window as any)['plottery notebook ai line highlight clearing attached'] = true;
      (Jupyter.notebook as any).events.on('execute.CodeCell', (_ev: any, data: any) => {
        const cm = data.cell.code_mirror;
        cm.eachLine((line: LineHandle) => {
          cm.removeLineClass(line, "gutter", "snp-ai-line-changed");
          cm.removeLineClass(line, "background", "snp-ai-line-changed");
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
  const cells = notebook_cells(state.snp_outer);
  const code_cells: Cell[] = cells.filter((cell: Cell) => cell.cell_type === "code" && is_not_magic(cell.get_text()));

  const code_cells_through_cell = code_cells.slice(
    0,
    1 + code_cells.findLastIndex(c => c.element[0] === state.cell.element[0]) // They won't be the same object in JupyterLab because notebook_cells makes a new wrapper each time it is called
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

// Inject figure/axes parameter type annotations (mirrors the manual-execution pre-pass in
// the notebook extensions) so calls inside any function the model wrote get recognized. The
// function is shared via the extension-exposed global rather than duplicated here.
function annotate_code(code: string, state: State): string {
  if (__snp_annotate_figure_axes_params) {
    const code_cells = notebook_cells(state.snp_outer).filter((cell: Cell) => cell.cell_type === "code" && is_not_magic(cell.get_text()));
    const prior_code = code_cells
      .slice(0, code_cells.findLastIndex(c => c.element[0] === state.cell.element[0]))
      .map(c => c.get_text())
      .join("\n");
    code = __snp_annotate_figure_axes_params(code, `${prior_code}\n${code}`);
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
  hard_rerun(state);

  // console.log("old_code_lines", old_code_lines);
  cm.eachLine(line => {
    // console.log("line.text", line.text);
    if(old_code_lines.includes(line.text)) {
      cm.removeLineClass(line, "gutter", "snp-ai-line-changed");
      cm.removeLineClass(line, "background", "snp-ai-line-changed");
    } else {
      cm.addLineClass(line, "gutter", "snp-ai-line-changed");
      cm.addLineClass(line, "background", "snp-ai-line-changed");
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

  function failure() {
    prompt_el.parentElement!.append("Oops there was an error.");
    prompt_el.disabled = false;
    prompt_el.focus();
    spinner_el.style.display = '';
    prompt_el.style.opacity = '';
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
      const code = annotate_code(raw_code, state);
      log_event("ai", "llm response", {prompt: user_prompt, code: code});
      apply_code_to_cell(code, state);
    },
    () => {
      log_event("ai", "llm timeout or error", {prompt: user_prompt});
      failure();
    },
    state.llm_api_keys
  )
}
