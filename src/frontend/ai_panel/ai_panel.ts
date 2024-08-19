import { hard_rerun } from "../code_sync/code_sync";
import { State } from "../types";
import { DocOrEditor } from "../utils/codemirror";
import { prompt_llm } from "../utils/llm";
import { create_el } from "../utils/misc";
import { Cell } from "../utils/types";

export function create_ai_panel(state: State): HTMLElement {
  const panel_el = create_el("div", "snp-ai-panel");
  const panel_heading = create_el("h2", [], panel_el);
  panel_heading.append("AI")

  const prompt_wrapper = create_el("div", "snp-ai-prompt-wrapper", panel_el);

  const prompt_el = create_el("input", [], prompt_wrapper) as HTMLInputElement;
  prompt_el.placeholder = "🤖 How should I change the plot?";

  const spinner_el = create_el("div", "snp-spinner", prompt_wrapper);

  prompt_el.addEventListener("keydown", ev => {
    if (ev.code === "Enter") {
      ev.stopPropagation();
      ev.preventDefault();
      submit_prompt(prompt_el, spinner_el, state);
    }
  });



  return panel_el;
}

// some of this is is duplicated with the extension
function is_not_magic(code: string): boolean {
  return !code.startsWith("%%");
}

function prompt_for_llm(user_prompt: string, cm: DocOrEditor): string {
  const cell_code = cm.getValue();
  const code_cells: Cell[] = Jupyter.notebook.get_cells().filter((cell: Cell) => cell.cell_type === "code" && is_not_magic(cell.get_text()));

  const code_cells_through_cell = code_cells.slice(
    0,
    1 + code_cells.findLastIndex(cell => cell.get_text() === cell_code)
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
`I am writing matplotlib code in the last cell of the following notebook:

\`\`\`
${notebook_code}
\`\`\`

Modify the code of Cell ${last_cell_no} to ${user_prompt}

Notes: If you need to add more subplots, use the following form:

\`\`\`
fig = plt.figure(...)
ax1 = fig.add_subplot(...)
ax2 = fig.add_subplot(...)
...
\`\`\`

but only if you need to add more subplots.

Return only the new code of Cell ${last_cell_no}. The code should conlude as before with
snp = SNP(fig, locals(), cell_lineno, provenance_is_off_by_n_lines, notebook_code_through_cell)
snp`;

  return prompt;
}

function submit_prompt(prompt_el: HTMLInputElement, spinner_el: HTMLElement, state: State) {
  const user_prompt = prompt_el.value;
  prompt_el.blur();
  prompt_el.disabled = true;
  prompt_el.style.opacity = "0.5";
  spinner_el.style.display = "block";

  const cm = state.cell.code_mirror;

  function success(reply: string) {
    let code: string;
    if (reply.match(/^```(\w*)\n([\s\S]*)\n```/m)) {
        // Extract string between first and last ```
        code = reply.match(/^```(\w*)\n([\s\S]*)\n```/m)![2];
    } else {
        code = reply;
    }
    code = code.replace(/### Cell \d.*\n/, '');

    cm.setValue(code);
    hard_rerun(state);
    cm.setCursor(9999, 9999, { scroll: false })
    cm.focus({ preventScroll: true }); // Focus so the user can undo
  }

  prompt_llm(
    prompt_for_llm(user_prompt, cm),
    success,
    () => {
      prompt_el.parentElement!.append("Oops there was an error.");
      prompt_el.disabled = false;
      prompt_el.focus();
      spinner_el.style.display = '';
      prompt_el.style.opacity = '';
    },
    state.llm_api_key
  )
}