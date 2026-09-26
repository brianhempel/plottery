"use strict";

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
  NotebookPanel,
  NotebookActions
} from '@jupyterlab/notebook';

import { CodeCell } from '@jupyterlab/cells';

import { ToolbarButton } from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';

// Need to expose these globally because we can't otherwise easily access them
import {StateField, StateEffect} from "@codemirror/state"
import {EditorView, Decoration} from "@codemirror/view"


const plugin = {
  id: 'plottery_jupyter',
  autoStart: true,
  requires: [INotebookTracker],
  activate: function(app, tracker) {

    function is_not_magic(code) {
      return !code.startsWith("%%");
    }

    function notebook_cells(notebook) {
      return notebook.cellsArray;
    }

    function cell_type(cell) {
      return cell.model.sharedModel.cell_type;
    }

    function cell_code(cell) {
      return cell.model.sharedModel.source;
    }

    function get_persistent_item(cell, key) {
      console.log("get_persistent_item cell", cell)
      return sessionStorage.getItem(`cell-${cell.model.sharedModel.id}-plottery-${key}`);
    }

    function get_notebook_code_through(notebook, cell) {
      const cells = notebook_cells(notebook);

      const notebook_code_before_cell =
        cells.slice(0, cells.findIndex(c => c === cell))
          .filter(c => cell_type(c) === "code")
          .map(cell_code)
          .filter(is_not_magic)
          .join("\n");

      const notebook_code_through_cell = `${notebook_code_before_cell}\n${cell_code(cell)}`;

      const cell_lineno = notebook_code_before_cell.split("\n").length + 1;

      return [cell_lineno, notebook_code_through_cell];
    }

    // ---- Figure/axes parameter annotation pre-pass --------------------------
    // See nbextension_plottery/main.js for the rationale. Mirrored here for JupyterLab.

    function regex_escape(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

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

    function track_figure_axes_vars(notebook_code, plt) {
      const kinds = {};
      const P = regex_escape(plt);
      for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*,[ \\t]*(\\w+)[ \\t]*=[ \\t]*${P}\\.subplots[ \\t]*\\(`, "mg"))) {
        kinds[m[1]] = "figure";
        kinds[m[2]] = subplots_axes_kind(call_args_str(notebook_code, m));
      }
      for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*=[ \\t]*${P}\\.(?:figure|gcf)[ \\t]*\\(`, "mg"))) {
        kinds[m[1]] = "figure";
      }
      for (const m of notebook_code.matchAll(new RegExp(`^[ \\t]*(\\w+)[ \\t]*=[ \\t]*${P}\\.(?:gca|subplot)[ \\t]*\\(`, "mg"))) {
        kinds[m[1]] = "axes";
      }
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

    function annotate_param_raw(raw, annotation) {
      const m = raw.match(/^(\s*)(\w+)\s*(=\s*[\s\S]+)?$/);
      if (!m) return raw;
      const default_part = m[3] ? ` = ${m[3].replace(/^=\s*/, "")}` : "";
      return `${m[1]}${m[2]}: ${annotation}${default_part}`;
    }

    function find_first_call_args(code, name) {
      const re = new RegExp(`\\b${regex_escape(name)}\\s*\\(`, "g");
      let m;
      while ((m = re.exec(code)) !== null) {
        if (/\bdef\s+$/.test(code.slice(0, m.index))) continue;
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

      const annotation_for = {
        figure: `${plt}.Figure`,
        axes: `${plt}.Axes`,
        axes_list: `list[${plt}.Axes]`,
        axes_list2d: `list[list[${plt}.Axes]]`,
      };

      const edits = [];
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
    function calls_plt_show(notebook, cell) {
      const code = cell_code(cell);
      if (cell_type(cell) !== "code" || !is_not_magic(code) || !code.includes('show')) return false;
      const targets = plt_show_names(get_notebook_code_through(notebook, cell)[1]);
      return targets.some(target => new RegExp(`\\b${target}\\b\\s*\\(`).test(code));
    }

    // ---- Global Plottery on/off toggle ----------------------------------------
    // See nbextension_plottery/main.js for the rationale. Mirrored here for JupyterLab.

    function plottery_enabled() {
      return window.localStorage.getItem('plottery_enabled') !== 'false';
    }

    function mime_str(value) {
      return Array.isArray(value) ? value.join('') : value;
    }

    function is_plottery_output(output) {
      const html = output.data && mime_str(output.data['text/html']);
      return typeof html === 'string' && html.includes('plottery_outer');
    }

    // What plain matplotlib would have shown: just the plot PNG, which the Plottery output carries
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
      if (cell_type(cell) !== "code") return;
      const outputs = cell.model.outputs;
      const output_jsons = Array.from({ length: outputs.length }, (_, i) => outputs.get(i).toJSON());
      if (!output_jsons.some(is_plottery_output)) return;
      cell.node.querySelectorAll('.plottery_outer').forEach(plottery_outer => window.detach_plottery?.(plottery_outer));
      outputs.clear();
      output_jsons.flatMap(plain_plot_outputs).forEach(output => outputs.add(output));
    }

    function strip_all_plottery_outputs(panel) {
      notebook_cells(panel.content).forEach(strip_plottery_outputs);
    }

    function without_plottery_outputs(notebook_json) {
      return {
        ...notebook_json,
        cells: notebook_json.cells.map(cell =>
          cell.cell_type === "code" && cell.outputs?.some(is_plottery_output)
            ? { ...cell, outputs: cell.outputs.flatMap(plain_plot_outputs) }
            : cell
        ),
      };
    }

    // Keep Plottery UIs out of the saved notebook, even while Plottery is on: each one inlines the
    // whole frontend bundle plus MBs of type info, and can't come back to life from a save anyway.
    // Every save (manual, autosave, Save As) funnels through contents.save with an already-serialized
    // copy of the notebook, so filtering that copy leaves the live UIs on the page untouched.
    // The saved notebook keeps each plot's PNG; re-running the cell brings the UI back.
    const contents = app.serviceManager.contents;
    const original_contents_save = contents.save.bind(contents);
    contents.save = (path, options) => {
      if (options?.type === 'notebook' && options.content?.cells) {
        options = { ...options, content: without_plottery_outputs(options.content) };
      }
      return original_contents_save(path, options);
    };

    function set_kernel_plottery_enabled(kernel) {
      kernel?.requestExecute({ code: `plottery.set_enabled(${plottery_enabled() ? 'True' : 'False'})`, silent: true, store_history: false });
    }

    // rerun_current_cell: redraw the active cell with Plottery (only on this tab's own toggle,
    // not when following a toggle made in another tab).
    function apply_plottery_enabled(rerun_current_cell) {
      update_plottery_toggles();
      tracker.forEach(panel => {
        set_kernel_plottery_enabled(panel.sessionContext.session?.kernel);
        if (!plottery_enabled()) strip_all_plottery_outputs(panel);
      });

      const panel = tracker.currentWidget;
      const cell = panel?.content.activeCell;
      if (plottery_enabled() && rerun_current_cell && cell && calls_plt_show(panel.content, cell)) {
        NotebookActions.runCells(panel.content, [cell], panel.sessionContext);
      }
    }

    // Will mutate content.code (and the visible cell, to inject the annotations)
    function perhaps_rewrite(content, metadata, cell, notebook) {
      let cell_code = content.code || '';

      if (plottery_enabled() && is_not_magic(cell_code) && cell_code.includes('show')) {
        // console.log('content', content);
        let [cell_lineno, notebook_code_through_cell] = get_notebook_code_through(notebook, cell);

        // Pre-pass: inject figure/axes parameter type annotations into the user's visible cell
        // so calls inside their functions get recognized by type inference. Skip quick redraws
        // (on-plot drags / direct manipulation), which set doesnt_need_plottery_show_ui. (JupyterLab
        // has no manual-only execution hook, so hard_rerun-based GUI actions still pass through;
        // those are idempotent no-ops once annotated. LLM results are annotated in ai_panel.)
        if (cell && !metadata.doesnt_need_plottery_show_ui) {
          const current = cell.model.sharedModel.source;
          const annotated = annotate_figure_axes_params(current, notebook_code_through_cell);
          if (annotated !== current) {
            cell.model.sharedModel.setSource(annotated);
            [cell_lineno, notebook_code_through_cell] = get_notebook_code_through(notebook, cell);
            cell_code = annotated;
          }
        }

        // console.log('cell_lineno', cell_lineno);
        // console.log('notebook_code_through_cell', notebook_code_through_cell);

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
              return `plottery.show(globals() | locals(), ${cell_lineno}, ${plt_show_lineno_in_cell}, ${provenance_is_off_by_n_lines}, ${notebook_code_as_python_str},`;;
            });
        }

        // Only replace code if the cell is somehow using plt.show()
        if (cell_code_show_replaced.includes('plottery.show(')) {
          // Sometimes the front end explicitly adds plottery.show_ui(plottery_class=FigureOnly) etc to
          // do a quick render, then we don't need to add another show_ui
          if (metadata.doesnt_need_plottery_show_ui) {
            // console.log('metadata.doesnt_need_plottery_show_ui', metadata.doesnt_need_plottery_show_ui);
            content.code = cell_code_show_replaced;
          } else {
            const fig_idx = get_persistent_item(cell, 'fig_idx') || '0'; // Recall which fig is selected in the UI by querying the front-end's state.persistent_dataset
            content.code =
`${cell_code_show_replaced}
last_plottery = plottery.show_ui(fig_idx=${fig_idx}) # Store to a variable for debugging
last_plottery`;
          }
        }
      }
    }


    console.log('Activating plottery_jupyter');
    console.log('app', app);
    console.log('tracker', tracker);
    window.app = app; // debugging
    window.tracker = tracker; // debugging

    console.log('__JupyterCodeCellModule', CodeCell);
    window.__JupyterCodeCellModule = CodeCell; // actually we need this
    console.log('__JupyterNotebookActionsModule', NotebookActions);
    window.__JupyterNotebookActionsModule = NotebookActions; // actually we need this

    console.log('__CM6StateField', StateField);
    window.__CM6StateField = StateField;
    console.log('__CM6StateEffect', StateEffect);
    window.__CM6StateEffect = StateEffect;
    console.log('__CM6EditorView', EditorView);
    window.__CM6EditorView = EditorView;
    console.log('__CM6Decoration', Decoration);
    window.__CM6Decoration = Decoration;

    // Expose for the bundle (the AI panel reuses this on LLM results) so the logic isn't duplicated.
    window.__plottery_annotate_figure_axes_params = annotate_figure_axes_params;

    const { commands } = app;
    const new_plot_command = 'plottery:new-plot';
    const toggle_plottery_command = 'plottery:toggle';

    commands.addCommand(toggle_plottery_command, {
      label: 'Toggle Plottery',
      execute: () => {
        window.localStorage.setItem('plottery_enabled', plottery_enabled() ? 'false' : 'true');
        apply_plottery_enabled(true);
      }
    });

    // Same look as the properties panel's bool switch (sidebar/widgets/bool/bool.css), under its own
    // class: the bundle's CSS only loads with a Plottery output, and its switch is position: absolute.
    const plottery_toggle_style = document.createElement('style');
    plottery_toggle_style.textContent = `
      .plottery-toolbar-switch {
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
      .plottery-toolbar-switch.on {
        padding-left: calc(1px + var(--travel));
        background-color: rgb(69, 231, 69);
      }
      .plottery-toolbar-switch > .switch-knob {
        box-sizing: border-box;
        display: inline-block;
        vertical-align: top;
        height: calc(var(--knob-size) - 2px);
        width: calc(var(--knob-size) - 2px);
        border-radius: calc(var(--knob-size) / 2);
        background-color: whitesmoke;
        border: 1px solid darkgray;
      }
      .plottery-toggle {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0 6px;
        cursor: pointer;
        font-size: var(--jp-ui-font-size1);
        color: var(--jp-ui-font-color1);
      }
    `;
    document.head.appendChild(plottery_toggle_style);

    function update_plottery_toggles() {
      const enabled = plottery_enabled();
      document.querySelectorAll('.plottery-toggle').forEach(el => {
        el.querySelector('.plottery-toolbar-switch').classList.toggle('on', enabled);
        el.title = enabled ? 'Plottery is on. Click to use ordinary Matplotlib.' : 'Plottery is off. Click to turn it on.';
      });
    }

    function make_plottery_toggle() {
      const node = document.createElement('div');
      node.className = 'plottery-toggle';
      node.innerHTML = '<span class="plottery-toolbar-switch"><span class="switch-knob"></span></span><span>Plottery</span>';
      node.addEventListener('click', () => commands.execute(toggle_plottery_command));
      return new Widget({ node });
    }

    // Follow a toggle made in another tab.
    window.addEventListener('storage', ev => {
      if (ev.key === 'plottery_enabled') apply_plottery_enabled(false);
    });

    commands.addCommand(new_plot_command, {
      label: 'Add New Matplotlib Plot',
      execute: () => {
        const panel = tracker.currentWidget;
        console.log('panel', panel);
        window.panel = panel; // debugging

        const notebook = panel.content;
        console.log('notebook', notebook);
        window.notebook = notebook; // debugging

        console.log('NotebookActions', NotebookActions);
        window.NotebookActions = NotebookActions; // debugging

        let cell = notebook.activeCell || notebook.selectedCells.at(-1) || notebook.cellsArray.at(-1);

        const [_, notebook_code_through_selected_cell] = get_notebook_code_through(notebook, cell);

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
          if (cell.model.sharedModel.source !== '' || cell.model.sharedModel.cell_type !== 'code') {
            NotebookActions.insertBelow(notebook);
            cell = notebook.activeCell;
          }
          cell.model.sharedModel.source = needed_import_lines.join('\n');
          NotebookActions.focusActiveCell(notebook);
          NotebookActions.runCells(notebook, [cell], panel.sessionContext);
        }

        if (cell.model.sharedModel.source !== '' || cell.model.sharedModel.cell_type !== 'code') {
          NotebookActions.insertBelow(notebook);
          cell = notebook.activeCell;
        }
        console.log('cell', cell);
        window.cell = cell; // debugging

        cell.model.sharedModel.source =
`fig = plt.figure(layout='tight')
ax = fig.add_subplot(1, 1, 1)


plt.show()`;
        NotebookActions.focusActiveCell(notebook);
        NotebookActions.runCells(notebook, [cell], panel.sessionContext);
      }
    });
    tracker.widgetAdded.connect((_sender, panel) => {
      const button = new ToolbarButton({
        className: 'new-plot',
        label: '📊 New Plot',
        // icon: 'ui-components:add',
        onClick: () => { commands.execute(new_plot_command); },
        tooltip: 'Add a new cell with Matplotlib starter code'
      });

      panel.toolbar.insertAfter('cellType', 'new-plot', button);
      panel.toolbar.insertAfter('new-plot', 'plottery-toggle', make_plottery_toggle());
      update_plottery_toggles();

      // Plottery off: keep its UIs out of the saved notebook, including any opened from an older save.
      panel.context.ready.then(() => { if (!plottery_enabled()) strip_all_plottery_outputs(panel); });
      panel.context.saveState.connect((_, save_state) => {
        if (save_state === 'started' && !plottery_enabled()) strip_all_plottery_outputs(panel);
      });
    });

    // Skeleton here provided by GPT-4o, so if this is non-optimal, 🤷
    tracker.widgetAdded.connect((sender, panel) => {
      console.log('sender', sender);
      console.log('panel', panel);
      window.sender = sender; // debugging
      window.panel = panel; // debugging

      // Attach the JS object to the DOM element so we can retrieve it
      // from our own JS later.
      panel.node.__panel = panel;

      // import plottery whenever kernel is restarted
      panel.sessionContext.kernelChanged.connect((_, { newValue: kernel }) => {
        console.log('kernel', kernel);
        window.kernel = kernel; // debugging
        if (kernel) {
          console.log("Kernel ready, importing plottery");
          // Also on a page reload, which reconnects to a kernel that may be in the other on/off state.
          kernel.requestExecute({ code: `import plottery\nplottery.set_enabled(${plottery_enabled() ? 'True' : 'False'})` });
        }
      // });

      // Add wrapper to rewrite normal Matplotlib code to call our functions

      // panel.sessionContext.ready.then(() => {
        // const session = panel.sessionContext.session;
        // const kernel = session?.kernel;
        if (!kernel) {
          return;
        }

        if (!kernel.plottery_wrapper_attached) {
          kernel.sendShellMessage = (
            (originalSendShellMessage => (...args) => {
              const { header, content, metadata } = args[0];
              // console.log('sendShellMessage args', args);

              if (header.msg_type === 'execute_request') {
                const notebook = tracker.currentWidget.content;
                const cell = notebook.cellsArray.find(c => c.model.sharedModel.id == metadata.cellId)

                // window.notebook = notebook; // debugging
                // window.cell = cell; // debugging

                // console.log('notebook', notebook);
                // console.log('cell', cell);

                perhaps_rewrite(content, metadata, cell, notebook);

                // console.log("Code sent to kernel:");
                // console.log(content.code);
              }

              // Call the original method
              return originalSendShellMessage.apply(kernel, args);
            })(kernel.sendShellMessage)
          );

          kernel.plottery_wrapper_attached = true;
        }
      });
    });
  }
};

export default plugin;
