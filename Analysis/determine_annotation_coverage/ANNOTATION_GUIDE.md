(this ai-generated file was a guide for sub-agents to figure out which function diffs in the type stubs were careful hand annotations rather than cosmetic or find-and-replace fixups)

# Annotation guide: classifying our matplotlib stub edits

## Context

Plottery is a **type-directed GUI** for matplotlib: it reads `.pyi` type stubs via mypy and
renders an editable widget for each parameter of a matplotlib call. The stubs under
`src/python-type-stubs-main/stubs/matplotlib/` are our fork of Microsoft's
`python-type-stubs`, forked at commit **`e328827`** (2023-09-27), vendored at
`upstream-stubs-e328827/`.

> **Check every change against that baseline.** Upstream was actively improving these stubs, so
> plenty of concrete defaults and `Literal`s in our fork are theirs, not ours. Before crediting us
> with something, read the corresponding file under `upstream-stubs-e328827/` — that
> directory is the ground truth for what we started from.

Upstream's annotations were too incomplete to drive a usable GUI, so we hand-authored
better ones. We now need to count **how many functions we meaningfully hand-annotated**,
which means separating real annotation work from incidental churn.

A change is **meaningful** if it changes what the GUI can show the user. Examples:

- `**kwargs` given a TypedDict → the GUI expands the splat into individual editable properties.
  This is the single most important thing we did.
- `Literal['a', 'b'] | str` instead of plain `str` → `'a'` and `'b'` become dropdown
  suggestions, even though the type is semantically identical to `str`.
- `= ...` replaced with a real default → the GUI can display and pre-populate the true default.

A change is **cosmetic** if the rendered GUI would be identical. Reformatting, import
shuffling, and `Sequence` → `Iterable` are cosmetic.

## Output format

Copy your assigned diff part **verbatim** and insert annotation lines into it. Do not
alter, reflow, reorder, or drop a single existing character — this will be verified
mechanically by stripping the annotation lines and diffing against the original.

Insert one annotation line immediately **after** the last diff line belonging to a
changed definition:

```
### ANN | <fully.qualified.name> | <MEANINGFUL|COSMETIC> | <tag,tag,...> | <short note>
```

- **fully.qualified.name** — the *public* matplotlib name, the one the docs use:
  `matplotlib.axes.Axes.set_title`, not `matplotlib.axes._axes.Axes.set_title`.
  Use `matplotlib.pyplot.bar`, `matplotlib.figure.Figure.colorbar`,
  `matplotlib.widgets.Slider.__init__`, etc.
- **verdict** — `MEANINGFUL` if at least one meaningful tag applies, otherwise `COSMETIC`.
- **tags** — comma-separated, no spaces, from the vocabulary below.
- **note** — one short clause naming the concrete change, e.g.
  `**kwargs: Line2DProps; 8 params gained real defaults`.

### Scope: annotate function definitions only

We are counting **matplotlib function calls** the GUI can drive, so annotate only `def`s —
module-level functions and class methods.

**Leave every other changed region completely unannotated.** Do not insert an `### ANN` line for:

- import hunks (added, removed, or reordered imports)
- module-level type aliases and `TypedDict` definitions
- class attribute blocks, `__all__`, and comment-only hunks

Those regions still appear in your output verbatim — you just do not annotate them. A file may
therefore contain long unannotated stretches, which is expected.

## Tag vocabulary

Meaningful:

| tag | meaning |
|---|---|
| `kwargs-typeddict` | `**kwargs` given a TypedDict (`**kwargs: Line2DProps`), so the GUI expands the splat |
| `new-params` | parameters spelled out that upstream hid behind `*args`/`**kwargs` or omitted |
| `literal-enum` | `Literal[...]` alternatives added or expanded, producing dropdown suggestions |
| `concrete-default` | `= ...` replaced with a real default value |
| `type-refine` | vague type replaced with a materially more precise one (`dict` → `ArrowProps`, `Sequence[float]` → `tuple[float, float]`, `str` → `XYCoordSystem`) |

Cosmetic:

| tag | meaning |
|---|---|
| `reformat` | line wrapping, trailing commas, black-style formatting only |
| `variance` | `Sequence`/`List`/`list` → `Iterable` and similar container swaps with no GUI effect |
| `import` | imports added, removed, or reordered |
| `comment` | only a comment or `# TODO` added |
| `alias-rename` | a type alias renamed without changing the set of accepted values |
| `vague-annot` | an annotation was added, but one too vague for the GUI to render anything from — e.g. a bare `fontdict: dict` with no TypedDict attached, which is no better than the `Any` it replaced |

Extra tag, combinable with either verdict:

| tag | meaning |
|---|---|
| `suspect` | the new annotation looks buggy or malformed — flag it, e.g. `functions=tuple[Callable, Callable] \| Transform` assigns a *type* as a default value |

## The find-and-replace rule

We are counting per-function **authoring effort**, not every change that happens to affect the GUI.
A mechanical alias swap applied across many call sites does not make each of those functions
hand-annotated. Tag it `find-replace` and mark it `COSMETIC`.

The alias itself is real work and is counted once, where it is defined in `_typing.pyi`.

| swap | verdict at the call site |
|---|---|
| `Color` → `ColorType` | `COSMETIC \| find-replace` |
| `cmap: str \| Colormap` → `CmapType` | `COSMETIC \| find-replace` |
| `Sequence`/`list` → `Iterable` | `COSMETIC \| variance` |

A change *is* meaningful when someone clearly worked on that specific signature: enumerating
parameters hidden behind `*args`/`**kwargs`, attaching a TypedDict to a splat, looking up and
writing real defaults, writing an inline `Literal[...]` for one particular parameter, or fixing a
single wrong type (`Widget.set_active(active: Widget)` → `bool`). A function that received both a
sweep and real work is `MEANINGFUL` — tag the real work.

## Judgment calls
- **`label: str | Literal["My Plot"]`.** Meaningful (`literal-enum`) — a deliberate hack to
  seed a default for a required argument.
- **Mixed changes.** A function that gained both a typed `**kwargs` and some reflowing is
  `MEANINGFUL`; tag the meaningful part and ignore the noise.
- **Reformat-only functions are common.** Do not inflate the count. If black wrapped a
  signature across lines and nothing else changed, it is `COSMETIC | reformat`.
- When genuinely torn, pick the verdict you'd defend to a reviewer and say why in the note.

## Reference material

- Our fork: `src/python-type-stubs-main/stubs/matplotlib/`
- Upstream baseline: `upstream-stubs-e328827/`
- The TypedDicts (`Line2DProps`, `PatchProps`, `TextProps`, …) are defined in
  `src/python-type-stubs-main/stubs/matplotlib/_typing.pyi`. Read it to see how many
  properties a given `**kwargs: XProps` actually unlocks.
