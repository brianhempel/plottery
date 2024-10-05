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

import { ToolbarButton } from '@jupyterlab/apputils';

function is_not_magic(code) {
  return !code.startsWith("%%");
}

function notebook_cells(notebook) {
  return notebook.model.sharedModel.cells;
}

function cell_type(cell) {
  return cell.cell_type;
}

function cell_code(cell) {
  return cell.source;
}

function get_persistent_item(cell, key) {
  return sessionStorage.getItem(`cell-${cell.id}-snp-${key}`);
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

// Will mutate content.code
function perhaps_rewrite(content, cell, notebook) {
  const cell_code = content.code || '';

  if (is_not_magic(cell_code) && cell_code.includes('show')) {
    // console.log('content', content);
    const [cell_lineno, notebook_code_through_cell] = get_notebook_code_through(notebook, cell);

    console.log('cell_lineno', cell_lineno);
    console.log('notebook_code_through_cell', notebook_code_through_cell);

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
          const fig_idx = get_persistent_item(cell, 'fig_idx') || '0'; // Recall which fig is selected in the UI by querying the front-end's state.persistent_dataset
          content.code =
`${cell_code_show_replaced}
last_snp = snp.show_ui(fig_idx=${fig_idx}) # Store to a variable for debugging
last_snp`;
        }
    }
  }
}

const plugin = {
  id: 'snp_jupyter',
  autoStart: true,
  requires: [INotebookTracker],
  activate: function(app, tracker) {
    console.log('Activating snp_jupyter');
    console.log('app', app);
    console.log('tracker', tracker);
    window.app = app; // debugging
    window.tracker = tracker; // debugging

    const { commands } = app;
    const new_plot_command = 'snp:new-plot';

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

        NotebookActions.insertBelow(notebook);

        const cell = notebook.activeCell;
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
    });

    // Skeleton here provided by GPT-4o, so if this is non-optimal, 🤷
    tracker.widgetAdded.connect((sender, panel) => {
      console.log('sender', sender);
      console.log('panel', panel);
      window.sender = sender; // debugging
      window.panel = panel; // debugging

      // import snp whenever kernel is restarted
      panel.sessionContext.kernelChanged.connect((_, { newValue: kernel }) => {
        console.log('kernel', kernel);
        window.kernel = kernel; // debugging
        if (kernel) {
          console.log("Kernel ready, importing snp");
          kernel.requestExecute({
            code: 'import snp'
          });
        }
      });

      // Add wrapper to rewrite normal Matplotlib code to call our functions
      panel.sessionContext.ready.then(() => {
        const session = panel.sessionContext.session;
        const kernel = session?.kernel;
        if (!kernel) {
          return;
        }

        if (!kernel.snp_wrapper_attached) {
          kernel.sendShellMessage = (
            (originalSendShellMessage => (...args) => {
              const { header, content, metadata } = args[0];
              console.log('sendShellMessage args', args);

              if (header.msg_type === 'execute_request') {
                const notebook = tracker.currentWidget.content;
                const cell = notebook.model.sharedModel.cells.find(c => c.id == metadata.cellId)

                window.notebook = notebook; // debugging
                window.cell = cell; // debugging

                console.log('notebook', notebook);
                console.log('cell', cell);

                perhaps_rewrite(content, cell, notebook);

                console.log("Code sent to kernel:");
                console.log(content.code);
              }

              // Call the original method
              return originalSendShellMessage.apply(kernel, args);
            })(kernel.sendShellMessage)
          );

          kernel.snp_wrapper_attached = true;
        }
      });
    });
  }
};

export default plugin;
