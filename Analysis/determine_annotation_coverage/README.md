(this file is AI generated, but I hand-reviewed the function annotations and made only one change: stubs-e328827.ai-then-human-annotated.diff is the main artifact. 47 functions have MEANINGFUL hand annotations)

# Hand-authored stub annotations: what we changed vs. upstream

Measures how much of the matplotlib API Plottery meaningfully hand-annotates, by diffing our fork
against the upstream snapshot we forked from and classifying every changed function.

Everything for this analysis lives in this folder; all paths below are relative to it unless they
start with `src/`.

- **Fork:** `src/python-type-stubs-main/stubs/matplotlib/`
- **Upstream baseline:** microsoft/python-type-stubs @ [`e328827`](https://github.com/microsoft/python-type-stubs/commit/e328827) (2023-09-27), vendored at `upstream-stubs-e328827/`

## Establishing the baseline

Getting this right matters more than it sounds: upstream was actively improving these stubs, so an
even slightly wrong baseline silently credits us with their work.

`src/python-type-stubs-main.zip` (dated 2024-04-02) is **not** a pristine starting point — it
already contains the team's pre-git hand-edits. Its `_typing.pyi` is 475 lines against upstream's
25, and it already has 10 of the 11 `Props` TypedDicts and the hand-written 35-parameter `legend`.
So the fork has to be compared against an upstream commit, not against the zip.

`e328827` is that commit, confirmed two independent ways:

1. It is the last commit touching `stubs/matplotlib` before the zip's date — the next one is
   2024-05-02, after it.
2. Its `widgets.pyi`, `lines.pyi`, `patches.pyi`, `text.pyi`, `collections.pyi`, and `__init__.pyi`
   are **byte-identical** to the zip.

Tree-wide, the fork differs from `e328827` in only six files, and one of those (`colors.pyi`) is a
revert rather than authoring — see Exclusions.

## Files

| file | what it is |
|---|---|
| `stubs-e328827.diff` | the raw diff, fork vs. baseline (3446 lines) |
| `stubs-e328827.ai-then-human-annotated.diff` | **the deliverable** — that diff with one `### ANN` line per changed function (2659 lines: 2544 diff + 115 annotations), reviewed by hand |
| `stubs-e328827.ai-annotated.diff` | the pre-review version, kept to show what the human pass changed |
| `ANNOTATION_GUIDE.md` | the classification rubric and tag vocabulary |
| `parts-e328827/`, `annotated-e328827/` | per-file splits; the annotated diff is their concatenation |
| `upstream-stubs-e328827/` | the vendored upstream baseline the diff is taken against |
| `top matplotlib pages …csv` | doc-page traffic (400 pages, 28 days to 2026-07-24) |
| `coverage_of_top_pages.ipynb` | joins the two: how much of what people read do we annotate? |
| `evidence_{plt,ax}_plot_panel.png` | the `plt.plot` vs `ax.plot` panels, evidence for the counting rule |

The annotated diff is byte-identical to the diff it annotates — stripping the annotation lines
reproduces the source exactly:

```bash
grep -v '^### ANN' stubs-e328827.ai-then-human-annotated.diff | diff - <(cat \
  parts-e328827/_typing.diff parts-e328827/axes__axes.A.diff parts-e328827/axes__axes.B.diff \
  parts-e328827/axes__base.diff parts-e328827/figure.diff parts-e328827/pyplot.diff)
```

The human review pass changed exactly one verdict: `Axes.get_title` from meaningful to cosmetic, on
the grounds that a single `= "center"` on a getter is too thin to count.

## Scope

Only **function definitions** are annotated, since the claim is about matplotlib calls the GUI can
drive. Import hunks, module-level type aliases, `TypedDict` definitions, class attribute blocks,
and comment-only hunks appear in the annotated diff verbatim but carry no `### ANN` line — which is
why `_typing.pyi` is included for context but is entirely unannotated.

## Exclusions

Four regions of the diff are omitted from the annotated file because they are not annotation work:

- **`colors.pyi`** — the fork's copy is byte-identical to upstream's *2022* version, i.e. it was
  reverted to a state older than the rest of the tree. It contains no hand-authoring.
- **`axes/old_axes.pyi`** (622 lines) and **`old_typing.pyi`** (37 lines) — pre-fork copies kept as
  backups. Nothing imports them, so mypy never loads them; counting them would double-count `Axes`.
- **`.DS_Store`** — accidentally committed.

## Counting rule

A change is **meaningful** if it changes what the GUI can render — a typed `**kwargs` that expands
into editable properties, a `Literal[...]` that becomes dropdown suggestions, a `= ...` replaced by
a real default. It is **cosmetic** if the rendered GUI is identical: reformatting, import shuffling,
`Sequence` → `Iterable`. See `ANNOTATION_GUIDE.md` for the full rubric.

**Find-and-replace changes are not meaningful.** The quantity of interest is per-function
*authoring effort*, so a mechanical alias swap applied across many call sites does not make each of
those functions hand-annotated — even when the alias it points at renders a better widget.
Concretely, `Color` → `ColorType` and `cmap: str | Colormap` → `CmapType` are cosmetic at the call
site (tag `find-replace`). Authoring `ColorType` and `CmapType` *was* real work, and it is counted
once each, in `_typing.pyi`.

A change still counts when someone clearly worked on that specific signature: enumerating
parameters hidden behind `*args`/`**kwargs`, attaching a TypedDict to a splat, looking up and
writing real defaults, or writing an inline `Literal[...]` for one parameter.

## Headline counts

Of 115 changed functions, **47 are meaningfully hand-annotated** and 68 cosmetic:

| | count |
|---|---|
| **distinct API functions hand-annotated** | **47** |
| — net of `pyplot.colorbar`, which duplicates `Figure.colorbar` | 46 |

By module: `axes` 39, `figure` 4, `pyplot` 4.

The entire effort lives in five files — `_typing.pyi`, `axes/_axes.pyi`, `axes/_base.pyi`,
`figure.pyi`, `pyplot.pyi`. No other matplotlib stub was touched.

What the 47 consist of, by tag: 32 gained a typed `**kwargs` TypedDict, 32 gained real defaults in
place of `= ...`, 24 had parameters spelled out from a bare `*args`/`**kwargs`, 17 gained inline
`Literal` suggestions, 17 had a type materially refined.

Separately, `_typing.pyi` contributes **11 TypedDicts declaring 159 properties** (plus 51 commented
out), referenced from 33 `**kwargs:` sites. Those are type definitions rather than API calls, so
they sit outside the function count — but they are what turns opaque splats into editable panels,
and are worth quoting alongside it.

Only one `pyplot` function duplicates already-counted work: `pyplot.colorbar` copies 31 of its 33
parameters verbatim from `Figure.colorbar` (correctly making `mappable` optional), tagged
`mirrors-figure`. The other three (`figure`, `subplots`, `get_cmap`) are independent, and
`get_cmap` is absent from upstream entirely. Every `pyplot` wrapper that merely mirrored an `Axes`
method came out cosmetic under the find-and-replace rule, so there is no further double-counting.

## Coverage of the most-read documentation

`coverage_of_top_pages.ipynb` joins the 47 against doc-page traffic. Of the **top 100 most-visited
matplotlib *function* doc pages** (the `/api/_as_gen/` pages, minus class and module pages), **30 are
functions we hand-annotated** — 28% of the traffic those 100 pages receive.

The rule is deliberately strict: a page counts only if the call *that page documents* resolves to a
stub we annotated. Plottery reads whichever stub mypy picks for the code the user typed, so
annotating `Axes.plot` does nothing for `plt.plot`. Verified live — `plt.plot([1,2,3],[2,1,3])` shows
4 property rows and misbinds the y-data to `scalex`; `ax.plot(...)` shows 35.

Other cutoffs, since 100 is arbitrary: **28% at 25, 36% at 50, 30% at 100**, 29% over all 104 function
pages in the sample. It peaks at 50 because ranks 1–12 are almost all `pyplot` pages while ranks 13–50
are where the `Axes` pages cluster; don't quote 36% without also giving 30%.

Sliced by calling surface instead of by cutoff, the number is much stronger and says more: of the
top-50 pages documenting an **`Axes`/`Figure` method** — the object-oriented API Plottery is built
around — we hand-annotated **15 of 16 (94%)**, and 26 of 39 (67%) over the top 100. The only top-50
miss is `Axes.imshow`.

That strictness costs 29 pages, 46% of top-100 traffic: they are `pyplot` wrappers of functions we
already annotated (`plt.plot`, `plt.legend`, `plt.scatter`, `plt.hist`, `plt.bar`, `plt.title`, …)
whose wrapper stub was never given the same treatment. Delegating those signatures to their
`Axes`/`Figure` twins would take coverage from 30 to 59 with no new annotation work.

Of the 47 annotated functions, 30 have a top-100 page, 7 are `Axes` methods whose only popular page
is the `pyplot` twin, and 10 have no page in the top 400 under any spelling.

## Caveats for anyone citing these numbers

- **11 of the 47 are tagged `suspect`** — real annotation work that looks buggy. `Axes.boxplot`'s
  `showmeans`/`showfliers` defaults are inverted relative to matplotlib, so the GUI pre-populates
  wrong values; `secondary_xaxis`/`secondary_yaxis` assign a *type expression* as a default
  (`functions=tuple[Callable, Callable] | Transform`); `Axes.loglog` has `base=1.0`, a degenerate
  log base, where `semilogx`/`semilogy` correctly use `10.0`; `set_xticklabels`/`set_yticklabels`
  declare `fontdict: dict = None`; `Figure.add_subplot`'s second overload is missing its
  `@overload` decorator. Count them as hand-authored, but do not describe them as *correct*.
- **`pyplot.subplots` changed overload return types, not parameters** — drop it for a strictly
  parameter-focused count.
- **Broken imports** in `pyplot.pyi`: `ArrayLike` is imported from a nonexistent `matplotlib.pylab`,
  so those annotations may not resolve. Worth verifying before claiming they drive the GUI.
- **Deleting the `Color` alias** from `_typing.pyi` in favour of `ColorType` left every stub file
  still referencing `Color` pointing at an undefined name — `widgets.pyi`, `patches.pyi`,
  `lines.pyi`, `text.pyi`, and `collections.pyi` among them. Those files' color annotations dangle.
- `Figure.colorbar` drops `**kwargs` rather than typing it, so the stub now rejects kwargs
  matplotlib accepts. `Figure.add_subplot` also collapses upstream's projection-specific return
  types (`PolarAxes`, `MollweideAxes`, …) to plain `Axes`.
