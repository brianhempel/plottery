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
      .filter((cell) => cell.cell_type === "code");

    const code_cells_through_cell = code_cells.slice(
      0,
      1 + code_cells.findLastIndex((cell) => cell.get_text() === cell_code)
    );
    const code_cells_before_cell = code_cells_through_cell.slice(0, -1);

    const notebook_code_before_cell = code_cells_before_cell
      .map((cell) => cell.get_text())
      .filter(is_not_magic)
      .join("\n");

    const notebook_code_through_cell = `${notebook_code_before_cell}\n${cell_code}`;

    const cell_lineno = notebook_code_before_cell.split("\n").length + 1;

    return [cell_lineno, notebook_code_through_cell];
  }

  function setup() {
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

          // content.code =
          //   `provenance_is_off_by_n_lines = 4\n` +
          //   `cell_lineno = ${cell_lineno}\n` +
          //   `cell_code = ${JSON.stringify(cell_code)}\n` +
          //   `notebook_code_through_cell = ${JSON.stringify(
          //     notebook_code_through_cell
          //   )}` +
          //   `${content.code}`;
        }
      }
    );
  }

  function load_extension() {
    // Inject css
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = requirejs.toUrl("./style.css");
    document.getElementsByTagName("head")[0].appendChild(link);

    // Load when the kernel's ready
    if (Jupyter.notebook.kernel) {
      setup();
    } else {
      events.on("kernel_ready.Kernel", setup);
    }
  }

  return {
    load_ipython_extension: load_extension,
  };
});
