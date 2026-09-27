"""Render one plot through a real kernel, sending the same code the Plottery JupyterLab extension sends.

Run by 3_check.sh with the test venv's Python, from an empty directory outside the repo.
"""

import json
import os
import sys
import time

from jupyter_client.manager import start_new_kernel

# A notebook's first cell, rewritten the way perhaps_rewrite() in plottery_jupyter.js does it.
CELL = """import matplotlib.pyplot as plt

fig, ax = plt.subplots()
ax.bar(["a", "b", "c"], [1, 3, 2])
ax.set_title("Smoke test")
plt.show()"""
notebook_code_through_cell = "\n" + CELL  # no cells before this one
cell_lineno = 2
plt_show_lineno_in_cell = CELL.split("\n").index("plt.show()") + 1
REWRITTEN = CELL.replace(
    "plt.show(",
    f"plottery.show(globals() | locals(), {cell_lineno}, {plt_show_lineno_in_cell}, 0, {json.dumps(notebook_code_through_cell)},",
) + "\nlast_plottery = plottery.show_ui(fig_idx=0) # Store to a variable for debugging\nlast_plottery"

html, stdout, streams, errors = [], [], [], []


def on_output(msg):
    kind, content = msg["msg_type"], msg["content"]
    if kind in ("execute_result", "display_data"):
        html.append(content["data"].get("text/html", ""))
    elif kind == "stream":
        streams.append(content["text"])
        if content["name"] == "stdout":
            stdout.append(content["text"])
    elif kind == "error":
        errors.append("\n".join(content["traceback"]))


def run(code):
    t0 = time.time()
    kc.execute_interactive(code, output_hook=on_output, timeout=300)
    if errors:
        sys.exit("Kernel output:\n" + "".join(streams) + "\nKernel error:\n" + errors[0])
    return time.time() - t0


km, kc = start_new_kernel(kernel_name="python3")
try:
    # Make sure the kernel is this venv and plottery comes from the installed wheel.
    run("import os, sys, plottery\n"
        "print(sys.prefix)\n"
        "print(plottery.__file__)\n"
        "print(os.path.isdir(os.path.join(os.path.dirname(plottery.__file__), 'python-type-stubs-main', 'stubs', 'matplotlib')))")
    kernel_prefix, plottery_file, has_stubs = "".join(stdout).splitlines()
    assert kernel_prefix == sys.prefix, f"Kernel runs {kernel_prefix}, not this venv ({sys.prefix})"
    assert plottery_file.startswith(sys.prefix), f"plottery imported from {plottery_file}, not the installed wheel"
    assert has_stubs == "True", "Type stubs are missing from the installed package"

    run("plottery.set_enabled(True)")  # what the extension runs after `import plottery`
    secs = run(REWRITTEN)
finally:
    km.shutdown_kernel(now=True)

out = "".join(html)
assert "attach_plottery(" in out, "The cell output has no Plottery UI"
assert "cannot re-attach" not in out, "plugin.js has a top-level const/let"
assert "data-call-id" in out, "The cell output has no hover regions"
# ax.bar's **kwargs (capstyle, ...) only get types from our stubs: ~64 mentions with them, 1 without.
assert out.count("capstyle") > 20, "mypy didn't use the bundled type stubs (Properties panels would miss most arguments)"
assert not os.path.exists("__plottery_mypy_temp.py"), "mypy's temp file was left behind"
# mypy refuses stubs inside site-packages, so the installed plottery gives it a copy (see stubs_directory).
if "XDG_CACHE_HOME" in os.environ:
    copies = os.path.join(os.environ["XDG_CACHE_HOME"], "plottery")
    assert os.path.isdir(copies) and any(d.startswith("stubs-") for d in os.listdir(copies)), f"No stubs copy in {copies}"
print(f"ok: Plottery UI rendered in {secs:.1f}s ({len(out) // 1024} KB of HTML), plottery from {os.path.dirname(plottery_file)}")
