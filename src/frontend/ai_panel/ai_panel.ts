import { hard_rerun } from "../code_sync/code_sync";
import { State } from "../types";
import { LineHandle } from "../utils/codemirror";
import { rate_limit, log_event } from "../utils/instrumentation";
import { prompt_llm } from "../utils/llm";
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

  const prompt_wrapper = create_el("div", "snp-ai-prompt-wrapper", panel_el);

  const prompt_el = create_el("input", [], prompt_wrapper) as HTMLInputElement;
  prompt_el.placeholder = "🤖 How should I change the plot?";

  const spinner_el = create_el("div", "snp-spinner", prompt_wrapper);

  prompt_el.addEventListener("keydown", ev => {
    if (ev.code === "Enter" && (prompt_el.value.trim() !== "" || ev.ctrlKey)) {
      ev.stopPropagation();
      ev.preventDefault();
      submit_prompt(prompt_el, spinner_el, state);
    } else {
      rate_limit("ai prompt writing", 2000, () => { log_event("ai", "prompt writing", {prompt: prompt_el.value}); });
    }
  });

  return panel_el;
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

function prompt_for_llm(user_prompt: string, state: State): string {
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

  const prompt =
`I am writing matplotlib v${state.mpl_version} code in the last cell of the following notebook:

\`\`\`
${notebook_code}
\`\`\`

Modify the code of Cell ${last_cell_no} to ${user_prompt}

Note: If I asked to create a function for a subplot and you need to pass in an ax argument, give that parameter a type annotation of mpl.axes._axes.Axes, but _only_ if there is a custom function for the subplot.

Note: If I asked above to add more subplots, use the following form:

\`\`\`
fig = plt.figure(...)
ax1 = fig.add_subplot(...)
ax2 = fig.add_subplot(...)
...
\`\`\`

but _only_ if I asked to add more subplots.

Return only the new code of Cell ${last_cell_no}`;

  return prompt;
}

function submit_prompt(prompt_el: HTMLInputElement, spinner_el: HTMLElement, state: State) {
  const cm = state.cell.code_mirror;
  const user_prompt = prompt_el.value;
  prompt_el.blur();
  prompt_el.disabled = true;
  prompt_el.style.opacity = "0.5";
  spinner_el.style.display = "block";

  log_event("ai", "prompt submit", {prompt: user_prompt, code: cm.getValue()});

  function success(reply: string) {
    let code: string;
    if (reply.match(/^```(\w*)\n([\s\S]*)\n```/m)) {
        // Extract string between first and last ```
        code = reply.match(/^```(\w*)\n([\s\S]*)\n```/m)![2];
    } else {
        code = reply;
    }
    code = code.replace(/### Cell \d.*\n/, '');

    // Inject figure/axes parameter type annotations (mirrors the manual-execution pre-pass in
    // the notebook extensions) so calls inside any function the model wrote get recognized. The
    // function is shared via the extension-exposed global rather than duplicated here.
    if (__snp_annotate_figure_axes_params) {
      const code_cells = notebook_cells(state.snp_outer).filter((cell: Cell) => cell.cell_type === "code" && is_not_magic(cell.get_text()));
      const prior_code = code_cells
        .slice(0, code_cells.findLastIndex(c => c.element[0] === state.cell.element[0]))
        .map(c => c.get_text())
        .join("\n");
      code = __snp_annotate_figure_axes_params(code, `${prior_code}\n${code}`);
    }

    // Focus code cell so user can undo changes
    if (!Jupyter) { // JupyterLab
      // Set cursor before setValue so it (hopefully) doesn't race with setValue or something.
      cm.setCursor(9999, 9999, { scroll: false })
      cm.focus();
    }
    log_event("ai", "llm response", {prompt: user_prompt, code: code});

    const old_code_lines = cm.getValue().split("\n");
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

  prompt_llm(
    prompt_for_llm(user_prompt, state),
    success,
    () => {
      log_event("ai", "llm timeout or error", {prompt: user_prompt});

      prompt_el.parentElement!.append("Oops there was an error.");
      prompt_el.disabled = false;
      prompt_el.focus();
      spinner_el.style.display = '';
      prompt_el.style.opacity = '';
    },
    state.llm_api_key
  )
}

