// Notebook extension to get information about the notebook environment to the
// Python kernel. The IPython protocol is stateful and only sends code chunks so
// it does not have a concept of "the entire notebok", but we need the prior
// notebook code for e.g. type inference. So here we send info about the notebook
// over to the Python kernel.
//
// Namely, whenever you run a non-magic code cell, it prepends the code with:
//
//   provenance_is_off_by_n_lines = 4 // count of lines prepended
//   cell_lineno = (cell position in notebook_code_through_cell below)
//   cell_code = "code of the cell"
//   notebook_code_through_cell = "the code of the notebook up through the cell"
//
// Consequently, notebook_code_through_cell is what we run type inference on.
// The line number info is ultimately used to correlate parsed code locations to
// cell locations in the front-end editor.
define(["require", "base/js/namespace", "base/js/events"], function (
  requirejs,
  Jupyter,
  events
) {
  "use strict";

  function is_not_magic(code) {
    return !code.startsWith("%%");
  }

  function get_notebook_code_through(cell_code) {
    const code_cells = Jupyter.notebook
      .get_cells()
      .filter(cell => cell.cell_type === "code");

    const code_cells_through_cell = code_cells.slice(
      0,
      1 + code_cells.findLastIndex(cell => cell.get_text() === cell_code)
    );
    const code_cells_before_cell = code_cells_through_cell.slice(0, -1);

    const notebook_code_before_cell = code_cells_before_cell
      .map(cell => cell.get_text())
      .filter(is_not_magic)
      .join("\n");

    const notebook_code_through_cell = `${notebook_code_before_cell}\n${cell_code}`;

    const cell_lineno = notebook_code_before_cell.split("\n").length + 1;

    return [cell_lineno, notebook_code_through_cell];
  }

  function load_extension() {
    // Inject css, unused for now
    const link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = requirejs.toUrl("./style.css");
    document.getElementsByTagName("head")[0].appendChild(link);

    console.log("Setting up...");

    Jupyter.notebook.events.on(
      "execution_request.Kernel",
      function (ev, { kernel, content }) {
        const cell_code = content.code;

        if (is_not_magic(cell_code)) {
          const [cell_lineno, notebook_code_through_cell] =
            get_notebook_code_through(cell_code);

          content.code = `provenance_is_off_by_n_lines = 4\ncell_lineno = ${cell_lineno}\ncell_code = ${JSON.stringify(
            cell_code
          )}\nnotebook_code_through_cell = ${JSON.stringify(
            notebook_code_through_cell
          )}\n${content.code}`;
        }
      }
    );
  }

  return {
    load_ipython_extension: load_extension,
  };
});
