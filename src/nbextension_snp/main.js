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
          new_cell.execute();
        }
      }
    ])
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
      kernel.execute('import snp')
    })

    const orig_cell_execute = IPython.CodeCell.prototype.execute;

    // We need to know which cell is executing to grab the code before
    let cell_executing = undefined;
    IPython.CodeCell.prototype.execute = function (stop_on_error) {
      cell_executing = this;
      const out = orig_cell_execute.call(this, stop_on_error);
      cell_executing = undefined;
      return out;
    }

    // Replace plt.show() with snp.show()
    Jupyter.notebook.events.on(
      "execution_request.Kernel",
      function (ev, { kernel, content }) {
        const cell_code = content.code;

        if (is_not_magic(cell_code) && cell_code.includes('show')) {
          // console.log('content', content);
          const cell = content.cell || cell_executing; // content.cell if SNP called kernel.execute directly, cell_executing from above if user manually ran the cell
          const [cell_lineno, notebook_code_through_cell] = get_notebook_code_through(cell);

          // look for
          // import matplotlib.pyplot as SOMETHING
          // from matplotlib.pyplot import show
          // from matplotlib.pyplot import *

          const matplotlib_show_names = [...notebook_code_through_cell.matchAll(/^\s*import matplotlib as (\w+)/mg)].map(m => `${m[1]}.pyplot.show`)
          const pyplot_show_names = [...notebook_code_through_cell.matchAll(/^\s*import matplotlib\.pyplot as (\w+)/mg)].map(m => `${m[1]}.show`)
          const just_show_names = [...notebook_code_through_cell.matchAll(/^\s*from matplotlib\.pyplot import .*(\*|\bshow\b)/mg)].map(_ => `show`)
          const targets = ['matplotlib.pyplot.show', ...matplotlib_show_names, ...pyplot_show_names, ...just_show_names];

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

    // "New Plot" Button
    Jupyter.notebook._fully_loaded ? add_new_plot_button() : events.on("notebook_loaded.Notebook", add_new_plot_button);
  }

  return {
    load_ipython_extension: load_extension,
  };
});
