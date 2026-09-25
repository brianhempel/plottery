// Notebook extension to get information about the notebook environment to the
// Python kernel. The IPython protocol is stateful and only sends code chunks so
// it does not have a concept of "the entire notebok", but we need the prior
// notebook code for e.g. type inference. So here we send info about the notebook
// over to the Python kernel.
//
// Calls to plt.show() are replace with
//
// snp.show(globals() | locals(), cell_lineno, plt_show_lineno_in_cell, provenance_is_off_by_n_lines, notebook_code_through_cell)
//
// Consequently, notebook_code_through_cell is what we run type inference on.
// The line number info is ultimately used to correlate parsed code locations to
// cell locations in the front-end editor. provenance_is_off_by_n_lines is necessary
// if we add any code at the beginning of the cell, but we don't anymore.
//
// At the end of the cell, we change the cell return value by adding:
//
// last_snp = snp.show_ui(fig_idx=0) # Store to a variable for debugging
// last_snp
//
// This is what actually produces the SNP UI.
define(["require", "base/js/namespace", "base/js/events"], function (
  requirejs,
  Jupyter,
  events
) {
  "use strict";

  function is_not_magic(code) {
    return !code.startsWith("%%");
  }

  function get_notebook_code_through(cell) {
    const cells = Jupyter.notebook.get_cells()

    const notebook_code_before_cell =
      cells.slice(0, cells.findIndex(c => c === cell))
        .filter(c => c.cell_type === "code")
        .map(c => c.get_text())
        .filter(is_not_magic)
        .join("\n");

    const notebook_code_through_cell = `${notebook_code_before_cell}\n${cell.get_text()}`;

    const cell_lineno = notebook_code_before_cell.split("\n").length + 1;

    return [cell_lineno, notebook_code_through_cell];
  }

  // ---- Figure/axes parameter annotation pre-pass ----------------------------
  //
  // When the user passes a figure/axes/array-of-axes into one of their own
  // functions, the parameter is otherwise untyped (mypy treats it as Any), so
  // calls on it (e.g. ax.plot(...)) aren't recognized as matplotlib calls and
  // don't render in the Layers panel. We infer those parameter types from the
  // call sites and inject annotations into the user's visible code, using the
  // same deliberately-simple, regex-based style as the "what is plt called"
  // logic below. annotate_figure_axes_params() returns the (possibly rewritten)
  // cell code; it is a no-op when nothing matches.

  function regex_escape(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Split a comma-separated argument/parameter list on top-level commas only
  // (i.e. ignoring commas inside (), [], {} or string literals).
  function split_top_level(str) {
    const parts = [];
    let depth = 0, cur = "", in_str = null;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (in_str) {
        cur += c;
        if (c === in_str && str[i - 1] !== "\\") in_str = null;
      } else if (c === '"' || c === "'") {
        in_str = c; cur += c;
      } else if (c === "(" || c === "[" || c === "{") {
        depth++; cur += c;
      } else if (c === ")" || c === "]" || c === "}") {
        depth = Math.max(0, depth - 1); cur += c;
      } else if (c === "," && depth === 0) {
        parts.push(cur); cur = "";
      } else {
        cur += c;
      }
    }
    if (cur.trim() !== "" || parts.length > 0) parts.push(cur);
    return parts;
  }

  // Given the index of an opening "(", return the index of its matching ")".
  function index_of_matching_paren(code, open_idx) {
    let depth = 0, in_str = null;
    for (let i = open_idx; i < code.length; i++) {
      const c = code[i];
      if (in_str) {
        if (c === in_str && code[i - 1] !== "\\") in_str = null;
      } else if (c === '"' || c === "'") {
        in_str = c;
      } else if (c === "(") {
        depth++;
      } else if (c === ")") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  // For a regex match ending in a call's opening "(", return the text of its (possibly
  // multi-line) argument list, up to the matching ")".
  function call_args_str(code, match) {
    const open_idx = match.index + match[0].length - 1;
    const close_idx = index_of_matching_paren(code, open_idx);
    return code.slice(open_idx + 1, close_idx === -1 ? code.length : close_idx);
  }

  // Classify what plt.subplots(...) / fig.subplots(...) returns for the axes slot, matching
  // how mypy resolves the bundled matplotlib stub's overloads: a single Axes, a 1-D list of Axes,
  // or a 2-D list of lists of Axes. The stub's squeezed overloads only match a literal `1` for
  // nrows/ncols and a literal `squeeze=True`, so anything else (a variable, `n + 1`, `squeeze=b`)
  // counts as "maybe more than 1" / "maybe unsqueezed", same as mypy.
  function subplots_axes_kind(args_str) {
    let nrows_is_1 = true, ncols_is_1 = true, squeeze = true, pos_idx = 0;
    for (const part of split_top_level(args_str)) {
      const trimmed = part.trim();
      if (trimmed === "" || trimmed.startsWith("*")) continue;
      const kw = trimmed.match(/^(\w+)\s*=\s*([\s\S]+)$/);
      const [name, value] = kw ? [kw[1], kw[2].trim()] : [[ "nrows", "ncols" ][pos_idx++], trimmed];
      if (name === "nrows") nrows_is_1 = value === "1";
      else if (name === "ncols") ncols_is_1 = value === "1";
      else if (name === "squeeze") squeeze = value === "True";
    }
    if (!squeeze) return "axes_list2d";
    if (nrows_is_1 && ncols_is_1) return "axes";
    if (nrows_is_1 || ncols_is_1) return "axes_list";
    return "axes_list2d";
  }

  // Map variable name -> 'figure' | 'axes' | 'axes_list' | 'axes_list2d' for the common ways
  // of creating figures/axes with pyplot.
  function track_figure_axes_vars(notebook_code, plt) {
    const kinds = {};
    const P = regex_escape(plt);

    // fig, ax = plt.subplots(...)
    for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*,[ \\t]*(\\w+)[ \\t]*=[ \\t]*${P}\\.subplots[ \\t]*\\(`, "mg"))) {
      kinds[m[1]] = "figure";
      kinds[m[2]] = subplots_axes_kind(call_args_str(notebook_code, m));
    }
    // fig = plt.figure(...) / plt.gcf()
    for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*=[ \\t]*${P}\\.(?:figure|gcf)[ \\t]*\\(`, "mg"))) {
      kinds[m[1]] = "figure";
    }
    // ax = plt.gca() / plt.subplot(...)
    for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*=[ \\t]*${P}\\.(?:gca|subplot)[ \\t]*\\(`, "mg"))) {
      kinds[m[1]] = "axes";
    }
    // ax = fig.add_subplot(...) ; axs = fig.subplots(...)  (for already-known figure vars)
    for (const fig_var of Object.keys(kinds).filter(v => kinds[v] === "figure")) {
      const F = regex_escape(fig_var);
      for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*=[ \\t]*${F}\\.add_subplot[ \\t]*\\(`, "mg"))) {
        kinds[m[1]] = "axes";
      }
      for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*=[ \\t]*${F}\\.subplots[ \\t]*\\(`, "mg"))) {
        kinds[m[1]] = subplots_axes_kind(call_args_str(notebook_code, m));
      }
    }
    return kinds;
  }

  // Parse a parameter list into { raw, name, is_star, has_annotation }.
  function parse_params(params_str) {
    return split_top_level(params_str).map(raw => {
      const trimmed = raw.trim();
      if (trimmed === "") return null;
      const name_match = trimmed.match(/^(\*{0,2})\s*(\w+)/);
      if (!name_match) return { raw, name: null, is_star: trimmed.startsWith("*"), has_annotation: false };
      return {
        raw,
        name: name_match[2],
        is_star: name_match[1].length > 0,
        has_annotation: /^\*{0,2}\s*\w+\s*:/.test(trimmed),
      };
    }).filter(p => p !== null);
  }

  // Inject ": <annotation>" into a single (unannotated) parameter, preserving any default.
  function annotate_param_raw(raw, annotation) {
    const m = raw.match(/^(\s*)(\w+)\s*(=\s*[\s\S]+)?$/);
    if (!m) return raw;
    const default_part = m[3] ? ` = ${m[3].replace(/^=\s*/, "")}` : "";
    return `${m[1]}${m[2]}: ${annotation}${default_part}`;
  }

  // Return the (top-level-split) argument list of the first call to `name(...)`
  // that is not the function definition itself, or null if none found.
  function find_first_call_args(code, name) {
    const re = new RegExp(`\\b${regex_escape(name)}\\s*\\(`, "g");
    let m;
    while ((m = re.exec(code)) !== null) {
      if (/\bdef\s+$/.test(code.slice(0, m.index))) continue; // the definition itself
      const open_idx = m.index + m[0].length - 1;
      const close_idx = index_of_matching_paren(code, open_idx);
      if (close_idx === -1) return null;
      return split_top_level(code.slice(open_idx + 1, close_idx));
    }
    return null;
  }

  function annotate_figure_axes_params(cell_code, notebook_code_through_cell) {
    const plt_aliases = [...notebook_code_through_cell.matchAll(/^\s*import matplotlib\.pyplot as (\w+)/mg)].map(m => m[1]);
    if (plt_aliases.length === 0) return cell_code;
    const plt = plt_aliases[0];

    const var_kind = track_figure_axes_vars(notebook_code_through_cell, plt);
    if (Object.keys(var_kind).length === 0) return cell_code;

    // plt.Figure / plt.Axes resolve to the matplotlib classes (the stub re-exports them); the
    // stub types subplots() as returning lists of Axes, so arrays are annotated as list[...].
    const annotation_for = {
      figure: `${plt}.Figure`,
      axes: `${plt}.Axes`,
      axes_list: `list[${plt}.Axes]`,
      axes_list2d: `list[list[${plt}.Axes]]`,
    };

    const edits = []; // { start, end, text } over cell_code, applied last-to-first
    const def_re = /^[ \t]*def[ \t]+(\w+)[ \t]*\(/mg;
    let dm;
    while ((dm = def_re.exec(cell_code)) !== null) {
      const name = dm[1];
      const open_idx = dm.index + dm[0].length - 1;
      const close_idx = index_of_matching_paren(cell_code, open_idx);
      if (close_idx === -1) continue;

      const params = parse_params(cell_code.slice(open_idx + 1, close_idx));
      if (params.length === 0) continue;

      const call_args = find_first_call_args(notebook_code_through_cell, name);
      if (!call_args) continue;

      // Map call arguments to parameters (positional, then keyword).
      let pi = 0;
      for (const arg_raw of call_args) {
        const arg = arg_raw.trim();
        if (arg === "") continue;
        const kw = arg.match(/^(\w+)\s*=\s*([\s\S]+)$/);
        if (kw) {
          const kind = var_kind[kw[2].trim()];
          if (kind && annotation_for[kind]) {
            const p = params.find(p => p.name === kw[1] && !p.has_annotation && !p.is_star);
            if (p) p._kind = kind;
          }
        } else {
          while (pi < params.length && params[pi].is_star) pi++;
          if (pi >= params.length) break;
          const kind = var_kind[arg];
          if (kind && annotation_for[kind] && !params[pi].has_annotation) params[pi]._kind = kind;
          pi++;
        }
      }

      if (!params.some(p => p._kind)) continue;

      const new_params = params.map(p => p._kind ? annotate_param_raw(p.raw, annotation_for[p._kind]) : p.raw).join(",");
      edits.push({ start: open_idx + 1, end: close_idx, text: new_params });
    }

    if (edits.length === 0) return cell_code;
    edits.sort((a, b) => b.start - a.start);
    let result = cell_code;
    for (const e of edits) result = result.slice(0, e.start) + e.text + result.slice(e.end);
    return result;
  }

  // Expose for the bundle (the AI panel reuses this on LLM results) so the logic isn't duplicated.
  window.__snp_annotate_figure_axes_params = annotate_figure_axes_params;

  // The names plt.show might go by, given the notebook's imports. Look for
  // import matplotlib.pyplot as SOMETHING
  // from matplotlib.pyplot import show
  // from matplotlib.pyplot import *
  function plt_show_names(notebook_code_through_cell) {
    const matplotlib_show_names = [...notebook_code_through_cell.matchAll(/^\s*import matplotlib as (\w+)/mg)].map(m => `${m[1]}.pyplot.show`)
    const pyplot_show_names = [...notebook_code_through_cell.matchAll(/^\s*import matplotlib\.pyplot as (\w+)/mg)].map(m => `${m[1]}.show`)
    const just_show_names = [...notebook_code_through_cell.matchAll(/^\s*from matplotlib\.pyplot import .*(\*|\bshow\b)/mg)].map(_ => `show`)
    return ['matplotlib.pyplot.show', ...matplotlib_show_names, ...pyplot_show_names, ...just_show_names];
  }

  // Would running this cell draw a Plottery UI?
  function calls_plt_show(cell) {
    const code = cell.get_text();
    if (cell.cell_type !== "code" || !is_not_magic(code) || !code.includes('show')) return false;
    const targets = plt_show_names(get_notebook_code_through(cell)[1]);
    return targets.some(target => new RegExp(`\\b${target}\\b\\s*\\(`).test(code));
  }

  // ---- Global Plottery on/off toggle ------------------------------------------
  //
  // Off, the notebook runs as ordinary matplotlib: plt.show() isn't rewritten, the kernel stops
  // provenance tagging (snp.set_enabled), and every Plottery UI is stripped down to its plain plot
  // PNG so none of it is saved in the notebook. The setting is per browser (localStorage), shared
  // with the JupyterLab extension.

  function plottery_enabled() {
    return window.localStorage.getItem('plottery_enabled') !== 'false';
  }

  function mime_str(value) {
    return Array.isArray(value) ? value.join('') : value;
  }

  function is_plottery_output(output) {
    const html = output.data && mime_str(output.data['text/html']);
    return typeof html === 'string' && html.includes('snp_outer');
  }

  // What plain matplotlib would have shown: just the plot PNG, which the SNP output carries
  // alongside its UI HTML (and its hover-region SVG, which we must not show instead).
  function plain_plot_outputs(output) {
    if (!is_plottery_output(output)) return [output];
    const png = output.data['image/png'];
    if (!png) return [];
    const png_metadata = output.metadata && output.metadata['image/png'];
    return [{
      output_type: 'display_data',
      data: { 'image/png': png, 'text/plain': '<Figure>' },
      metadata: png_metadata ? { 'image/png': png_metadata } : {},
    }];
  }

  function strip_plottery_outputs(cell) {
    const output_area = cell.output_area;
    if (!output_area || !output_area.outputs.some(is_plottery_output)) return;
    output_area.element[0].querySelectorAll('.snp_outer').forEach(snp_outer => window.detach_snp && window.detach_snp(snp_outer));
    const outputs = output_area.outputs.flatMap(plain_plot_outputs);
    output_area.clear_output(false, true);
    output_area.fromJSON(outputs);
    Jupyter.notebook.set_dirty(true);
  }

  function strip_all_plottery_outputs() {
    Jupyter.notebook.get_cells().filter(cell => cell.cell_type === "code").forEach(strip_plottery_outputs);
  }

  // Same look as the properties panel's bool switch (sidebar/widgets/bool/bool.css), under its own
  // class: the bundle's CSS only loads with a Plottery output, and its switch is position: absolute.
  const plottery_toggle_css = `
    .snp-toolbar-switch {
      --knob-size: 14px;
      --travel: var(--knob-size);
      box-sizing: border-box;
      display: inline-block;
      vertical-align: middle;
      width: calc(var(--knob-size) + 2px + var(--travel));
      height: calc(var(--knob-size) + 2px);
      border-radius: calc(var(--knob-size) / 2 + 1px);
      line-height: var(--knob-size);
      padding: 1px;
      border: 1px solid darkgray;
      background-color: lightgray;
      transition: all 80ms;
    }
    .snp-toolbar-switch.on {
      padding-left: calc(1px + var(--travel));
      background-color: rgb(69, 231, 69);
    }
    .snp-toolbar-switch > .switch-knob {
      box-sizing: border-box;
      display: inline-block;
      vertical-align: top;
      height: calc(var(--knob-size) - 2px);
      width: calc(var(--knob-size) - 2px);
      border-radius: calc(var(--knob-size) / 2);
      background-color: whitesmoke;
      border: 1px solid darkgray;
    }
    #plottery-toggle .snp-toolbar-switch { margin-right: 5px; }
  `;

  function update_plottery_toggle_button() {
    const button = document.getElementById('plottery-toggle');
    if (!button) return;
    const enabled = plottery_enabled();
    button.querySelector('.snp-toolbar-switch').classList.toggle('on', enabled);
    button.title = enabled ? 'Plottery is on. Click to use ordinary Matplotlib.' : 'Plottery is off. Click to turn it on.';
  }

  // rerun_current_cell: redraw the selected cell with Plottery (only on this tab's own toggle,
  // not when following a toggle made in another tab).
  function apply_plottery_enabled(rerun_current_cell) {
    const enabled = plottery_enabled();
    update_plottery_toggle_button();

    const kernel = Jupyter.notebook.kernel;
    if (kernel && kernel.is_connected()) {
      kernel.execute(`snp.set_enabled(${enabled ? 'True' : 'False'})`);
    }

    if (!enabled) {
      strip_all_plottery_outputs();
    } else if (rerun_current_cell) {
      const cell = Jupyter.notebook.get_selected_cell();
      if (cell && calls_plt_show(cell)) cell.execute();
    }
  }

  function toggle_plottery() {
    window.localStorage.setItem('plottery_enabled', plottery_enabled() ? 'false' : 'true');
    apply_plottery_enabled(true);
  }

  // Thanks, GPT-4o!
  function add_new_plot_button() {
    Jupyter.toolbar.add_buttons_group([
      {
        'label'   : 'New Plot',
        'icon'    : 'fa-plus-circle', // Font Awesome icon for "add"
        'callback': function () {
          let selected_cell = Jupyter.notebook.get_selected_cell();

          const notebook_code_through_selected_cell = get_notebook_code_through(selected_cell)[1];

          let needed_import_lines = [];
          if (!notebook_code_through_selected_cell.includes('import numpy as np')) {
            needed_import_lines.push('import numpy as np');
          }
          if(!notebook_code_through_selected_cell.includes('import matplotlib as mpl')) {
            needed_import_lines.push('import matplotlib as mpl');
          }
          if (!notebook_code_through_selected_cell.includes('import matplotlib.pyplot as plt')) {
            needed_import_lines.push('import matplotlib.pyplot as plt');
          }
          if (needed_import_lines.length > 0) {
            const new_cell = selected_cell.get_text().trim() === '' && selected_cell.cell_type == 'code' ? selected_cell : Jupyter.notebook.insert_cell_below();
            new_cell.set_text(needed_import_lines.join('\n'));
            Jupyter.notebook.select(Jupyter.notebook.get_cells().indexOf(new_cell));
            selected_cell = new_cell;
            Jupyter.notebook.focus_cell();
            new_cell.execute();
          }

          const new_cell = selected_cell.get_text().trim() === '' && selected_cell.cell_type == 'code' ? selected_cell : Jupyter.notebook.insert_cell_below();
          new_cell.set_text(
`fig = plt.figure(layout='tight')
ax = fig.add_subplot(1, 1, 1)


plt.show()`
            );
          Jupyter.notebook.select(Jupyter.notebook.get_cells().indexOf(new_cell));
          selected_cell = new_cell;
          Jupyter.notebook.focus_cell();
          const in_demo_mode = window.sessionStorage.getItem('plottery_demo_mode') === 'true';
          if (!in_demo_mode) {
            new_cell.execute();
          }
        }
      },
      {
        'label'   : 'Plottery',
        'id'      : 'plottery-toggle',
        'callback': toggle_plottery
      }
    ])

    // Swap the button's icon for the switch.
    const style = document.createElement('style');
    style.textContent = plottery_toggle_css;
    document.head.appendChild(style);
    const switch_el = document.createElement('span');
    switch_el.className = 'snp-toolbar-switch';
    switch_el.innerHTML = '<span class="switch-knob"></span>';
    document.querySelector('#plottery-toggle i').replaceWith(switch_el);
    update_plottery_toggle_button();
  }

  function load_extension() {
    // Inject css, unused for now
    // const link = document.createElement("link");
    // link.type = "text/css";
    // link.rel = "stylesheet";
    // link.href = requirejs.toUrl("./style.css");
    // document.getElementsByTagName("head")[0].appendChild(link);

    console.log("Setting up SNP...");

    // import snp when kernel (re)starts
    Jupyter.notebook.events.on('kernel_ready.Kernel', function(ev, { kernel }) {
      console.log("Kernel ready, importing snp");
      // Also on a page reload, which reconnects to a kernel that may be in the other on/off state.
      kernel.execute(`import snp\nsnp.set_enabled(${plottery_enabled() ? 'True' : 'False'})`)
    })

    const orig_cell_execute = IPython.CodeCell.prototype.execute;

    // We need to know which cell is executing to grab the code before
    let cell_executing = undefined;
    IPython.CodeCell.prototype.execute = function (stop_on_error) {
      cell_executing = this;

      // Annotate figure/axes parameters ONLY on a real manual execution. This override is the
      // user's Shift+Enter / Run path; GUI redraws and hard_rerun go through kernel.execute
      // directly (bypassing this), so drags/toggles/reorders never trigger the rewrite.
      try {
        const code = this.get_text();
        if (plottery_enabled() && is_not_magic(code) && code.includes('show')) {
          const notebook_code_through_cell = get_notebook_code_through(this)[1];
          const annotated = annotate_figure_axes_params(code, notebook_code_through_cell);
          if (annotated !== code) this.set_text(annotated);
        }
      } catch (e) {
        console.error('snp: figure/axes annotation pre-pass failed', e);
      }

      const out = orig_cell_execute.call(this, stop_on_error);
      cell_executing = undefined;
      return out;
    }

    // Replace plt.show() with snp.show()
    Jupyter.notebook.events.on(
      "execution_request.Kernel",
      function (ev, { kernel, content }) {
        if (!plottery_enabled()) {
          delete content['cell'] // otherwise, the whole cell memory graph gets serialized!
          return;
        }

        const cell_code = content.code;

        if (is_not_magic(cell_code) && cell_code.includes('show')) {
          // console.log('content', content);
          const cell = content.cell || cell_executing; // content.cell if SNP called kernel.execute directly, cell_executing from above if user manually ran the cell
          delete content['cell'] // otherwise, the whole cell memory graph gets serialized!
          const [cell_lineno, notebook_code_through_cell] = get_notebook_code_through(cell);

          const targets = plt_show_names(notebook_code_through_cell);

          // console.log('cell_lineno', cell_lineno);
          // console.log('notebook_code_through_cell', notebook_code_through_cell);
          // console.log('targets', targets);

          const provenance_is_off_by_n_lines = 0; // Change this if you need to prefix the cell with extra code (we used to but don't now)

          let cell_code_show_replaced = cell_code;
          for (const target of targets) {
            const regex = new RegExp(`\\b${target}\\b\\s*\\(`, 'g');
            cell_code_show_replaced =
              cell_code_show_replaced.replaceAll(regex, function (_match, index) {
                const plt_show_lineno_in_cell = cell_code_show_replaced.substr(0, index).split('\n').length; // 1-indexed
                const notebook_code_as_python_str = JSON.stringify(notebook_code_through_cell);
                return `snp.show(globals() | locals(), ${cell_lineno}, ${plt_show_lineno_in_cell}, ${provenance_is_off_by_n_lines}, ${notebook_code_as_python_str},`;;
              });
          }

          // Only replace code if the cell is somehow using plt.show()
          if (cell_code_show_replaced.includes('snp.show(')) {
              // Sometimes the front end explicitly adds snp.show_ui(snp_class=FigureOnly) etc to
              // do a quick render, then we don't need to add another show_ui
              if (content.doesnt_need_snp_show_ui) {
                content.code = cell_code_show_replaced;
              } else {
                const fig_idx = cell.output_area.element[0].dataset.fig_idx || '0'; // Recall which fig is selected in the UI by querying the front-end's persistent_dataset
                content.code =
`${cell_code_show_replaced}
last_snp = snp.show_ui(fig_idx=${fig_idx}) # Store to a variable for debugging
last_snp`;
              }
          }

          console.log("Code sent to kernel:");
          console.log(content.code);
        }
      }
    );

    // Plottery off: keep its UIs out of the saved notebook, including any opened from an older save.
    Jupyter.notebook.events.on('before_save.Notebook', function () {
      if (!plottery_enabled()) strip_all_plottery_outputs();
    });
    function on_notebook_loaded() {
      add_new_plot_button(); // and the Plottery on/off toggle
      if (!plottery_enabled()) strip_all_plottery_outputs();
    }
    Jupyter.notebook._fully_loaded ? on_notebook_loaded() : events.on("notebook_loaded.Notebook", on_notebook_loaded);

    // Follow a toggle made in another tab.
    window.addEventListener('storage', function (ev) {
      if (ev.key === 'plottery_enabled') apply_plottery_enabled(false);
    });
  }

  return {
    load_ipython_extension: load_extension,
  };
});
