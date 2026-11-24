# Plottery: Graphical Editing for Matplotlib

[Paper](https://plottery.org/assets/Plottery-%20A%20Code-Integrated%20GUI%20for%20Matplotlib%20Preprint%20with%20Appendix.pdf) · [5min Video Figure](https://plottery.org/assets/Plottery%20Video%20Figure.mp4) · [Appendix](https://plottery.org/assets/Plottery-%20A%20Code-Integrated%20GUI%20for%20Matplotlib%20Appendix.pdf) · [Study Replication Package](https://doi.org/10.17605/OSF.IO/DBU3C)

```
$ pip install plottery-ui
```

Plottery is an in-notebook graphical interface for Matplotlib (MPL). Instead of a static image, with Plottery `plt.show()` produces a rich graphical interface that lets you add plot elements, drag and resize shapes, tweak plot arguments with live preview, and prompt an LLM to make changes. All changes are written to the code live—the code is the ground truth—and code editing is supported at any time.

Plottery is described in our paper...

> Brian Hempel, Ruanqianqian (Lisa) Huang, Devamardeep Hayatpur, Sorin Lerner, and Haijun Xia. *Plottery: A Code-Integrated GUI for Matplotlib.* VL/HCC 2026.

...but should also be plausibly usable. See install instructions below.

## Video Figure From Paper

<video controls><source src="https://plottery.org/assets/Plottery%20Video%20Figure.mp4" type="video/mp4"></video>

## Install

```
pip install plottery-ui
```

Install it into the environment you run Jupyter from (JupyterLab 4 or Notebook 7). To install JupyterLab along with it, use `pip install "plottery-ui[lab]"`. Then start Jupyter and any cell that calls `plt.show()` shows the Plottery UI. The **Plottery** toggle in the notebook toolbar turns it off.

If your notebook's kernel runs in a different Python environment than Jupyter itself, install `plottery-ui` into the kernel's environment too. Otherwise plots appear as ordinary Matplotlib images, with a message saying so.

To avoid having to type your LLM provider's API key on the front-end, set an LLM API key (e.g. `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) in the environment you start Jupyter from.

## Development

See `DEVELOPING.md`.
