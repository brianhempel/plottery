from io import BufferedWriter, BytesIO

from matplotlib.axis import Tick
from matplotlib.cm import ScalarMappable
from matplotlib.ticker import Formatter, Locator
from .colorbar import Colorbar
import numpy as np
from typing import Callable, Iterable, List, Literal, Sequence, overload
from ._typing import CmapType, TextProps, ColorType, ArrayLike, PathLike, FileLike
from .text import Text
from .gridspec import GridSpec, SubplotSpec
from .backend_bases import (
    FigureCanvasBase,
    MouseButton,
    MouseEvent,
    RendererBase,
)
from .colors import Colormap, Normalize
from .legend import Legend
from .layout_engine import LayoutEngine
from .image import FigureImage
from .transforms import BboxBase
from .axes import Axes
from .artist import Artist, _finalize_rasterization, allow_rasterization
from mpl_toolkits.mplot3d import Axes3D

class _AxesStack:
    def __init__(self) -> None: ...
    def as_list(self) -> list[Axes]: ...
    def remove(self, a: Axes) -> None: ...
    def bubble(self, a: Axes) -> None: ...
    def add(self, a: Axes) -> None: ...
    def current(self) -> None: ...

class SubplotParams:
    def __init__(
        self,
        left: float = ...,
        bottom: float = ...,
        right: float = ...,
        top: float = ...,
        wspace: float = ...,
        hspace: float = ...,
    ) -> None: ...
    validate = ...
    def update(
        self,
        left: float | None = ...,
        bottom: float | None = ...,
        right: float | None = ...,
        top: float | None = ...,
        wspace: float | None = ...,
        hspace: float | None = ...,
    ) -> None: ...

class FigureBase(Artist):
    def __init__(self, **kwargs) -> None: ...
    def autofmt_xdate(
        self,
        bottom: float = 0.2,
        rotation: int = 30,
        ha: Literal["left", "center", "right"] = "right",
        which: Literal["major", "minor", "both"] = "major",
    ) -> None: ...
    def get_children(self) -> list[Artist]: ...
    def contains(self, mouseevent: MouseEvent) -> bool: ...
    def get_window_extent(
        self, renderer: RendererBase = ..., *args, **kwargs
    ): ...
    def suptitle(
        self,
        t: str,
        x: float = 0.5,
        y: float = 0.98,
        **kwargs: TextProps
    ) -> Text: ...
    def supxlabel(self, t: str, **kwargs) -> Text: ...
    def supylabel(self, t: str, **kwargs) -> Text: ...
    def get_edgecolor(self): ...
    def get_facecolor(self): ...
    def get_frameon(self) -> bool: ...
    def set_linewidth(self, linewidth: float) -> None: ...
    def get_linewidth(self) -> float: ...
    def set_edgecolor(self, color: ColorType): ...
    def set_facecolor(self, color: str) -> None: ...
    def set_frameon(self, b: bool): ...
    frameon = ...
    def add_artist(self, artist: Artist, clip: bool = False) -> Artist: ...
    def add_axes(self, *args, **kwargs) -> Axes: ...
    @overload
    def add_subplot(
        self,
        nrows: int, # The Sketch-n-Plot default int is 1
        ncols: int, # The Sketch-n-Plot default int is 1
        index: int | tuple[int, int], # The Sketch-n-Plot default int is 1
        /,
        projection: Literal['aitoff', 'hammer', 'lambert', 'mollweide', 'polar', 'rectilinear'] | str | None = None,
        polar: bool = False,
        sharex: Axes | None = None,
        sharey: Axes | None = None,
        frameon: bool = True,
        label: str = '',
        xscale: Literal["linear", "log", "symlog", "logit"] | str | None = None,
        yscale: Literal["linear", "log", "symlog", "logit"] | str | None = None,
        box_aspect: float | None = None,
        facecolor: ColorType | None = None,
        **kwargs
    ) -> Axes: ...
    # Also covers fig.add_subplot() with no args, fig.add_subplot(gs[0, :]), and fig.add_subplot((2, 2, 1))
    @overload
    def add_subplot(
        self,
        grid: Literal[111] | int | SubplotSpec | tuple[int, int, int] = 111,
        /,
        projection: Literal['aitoff', 'hammer', 'lambert', 'mollweide', 'polar', 'rectilinear'] | str | None = None,
        polar: bool = False,
        sharex: Axes | None = None,
        sharey: Axes | None = None,
        frameon: bool = True,
        label: str = '',
        xscale: Literal["linear", "log", "symlog", "logit"] | str | None = None,
        yscale: Literal["linear", "log", "symlog", "logit"] | str | None = None,
        box_aspect: float | None = None,
        facecolor: ColorType | None = None,
        **kwargs
    ) -> Axes: ...
    # Unreachable: the overloads above also match projection="3d", so 3D subplots type as Axes.
    # Kept for when mplot3d has stubs; until then Axes3D is Any, and Axes is more useful to Plottery.
    @overload
    def add_subplot(
        self, *args, projection: Literal["3d"], **kwargs
    ) -> Axes3D: ...
    # Returns np.ndarrays at runtime, but typed as lists (see the comment on pyplot.subplots).
    @overload
    def subplots(
        self,
        nrows: Literal[1] = 1,
        ncols: Literal[1] = 1,
        *,
        sharex: bool | Literal["none", "all", "row", "col"] = False,
        sharey: bool | Literal["none", "all", "row", "col"] = False,
        squeeze: Literal[True] = True,
        width_ratios: Sequence[float] | None = None,
        height_ratios: Sequence[float] | None = None,
        subplot_kw: dict | None = None,
        gridspec_kw: dict | None = None,
    ) -> Axes: ...
    @overload
    def subplots(
        self,
        nrows: Literal[1] = 1,
        ncols: int = 1,
        *,
        sharex: bool | Literal["none", "all", "row", "col"] = False,
        sharey: bool | Literal["none", "all", "row", "col"] = False,
        squeeze: Literal[True] = True,
        width_ratios: Sequence[float] | None = None,
        height_ratios: Sequence[float] | None = None,
        subplot_kw: dict | None = None,
        gridspec_kw: dict | None = None,
    ) -> List[Axes]: ...
    @overload
    def subplots(
        self,
        nrows: int = 1,
        ncols: Literal[1] = 1,
        *,
        sharex: bool | Literal["none", "all", "row", "col"] = False,
        sharey: bool | Literal["none", "all", "row", "col"] = False,
        squeeze: Literal[True] = True,
        width_ratios: Sequence[float] | None = None,
        height_ratios: Sequence[float] | None = None,
        subplot_kw: dict | None = None,
        gridspec_kw: dict | None = None,
    ) -> List[Axes]: ...
    @overload
    def subplots(
        self,
        nrows: int = 1,
        ncols: int = 1,
        *,
        sharex: bool | Literal["none", "all", "row", "col"] = False,
        sharey: bool | Literal["none", "all", "row", "col"] = False,
        squeeze: bool = True,
        width_ratios: Sequence[float] | None = None,
        height_ratios: Sequence[float] | None = None,
        subplot_kw: dict | None = None,
        gridspec_kw: dict | None = None,
    ) -> List[List[Axes]]: ...
    def delaxes(self, ax: Axes) -> None: ...
    def clear(self, keep_observers: bool = False) -> None: ...
    def clf(self, keep_observers: bool = False) -> None: ...
    def legend(self, *args, **kwargs) -> Legend: ...
    def text(
        self, x: float, y: float, s: str, fontdict: dict = ..., **kwargs
    ) -> Text: ...
    def colorbar(
        self,
        mappable: ScalarMappable,
        cax: Axes = ...,
        ax: Axes | Iterable[Axes] = ...,
        use_gridspec: bool = ...,
        location: Literal['left', 'right', 'top', 'bottom'] = ...,
        orientation: Literal['vertical', 'horizontal'] = ...,
        fraction: float = 0.15,
        shrink: float = 1.0,
        aspect: float = 20,
        pad: float = 0.05,
        anchor: tuple[float, float] = ...,
        panchor: tuple[float, float] | Literal[False] = ...,
        extend: Literal['neither', 'both', 'min', 'max'] = ...,
        extendfrac: Literal['auto'] | float | Iterable[float] = ...,
        extendrect: bool = False,
        spacing: Literal['uniform', 'proportional'] = ...,
        ticks: Iterable[Tick] | Locator | None = ...,
        format: Literal["%04.1f"] | str | Formatter | None = ...,
        drawedges: bool = ...,
        label: str = ...,
        boundaries: Iterable[float] = ...,
        values: Iterable[float] =...
    ) -> Colorbar: ...
    def subplots_adjust(
        self,
        left: float = ...,
        bottom: float = ...,
        right: float = ...,
        top: float = ...,
        wspace: float = ...,
        hspace: float = ...,
    ) -> None: ...
    def align_xlabels(self, axs: Sequence[Axes] = ...) -> None: ...
    def align_ylabels(self, axs: Sequence[Axes] = ...) -> None: ...
    def align_labels(self, axs: Sequence[Axes] = ...) -> None: ...
    def add_gridspec(
        self, nrows: int = 1, ncols: int = 1, **kwargs
    ) -> GridSpec: ...
    def subfigures(
        self,
        nrows: int = 1,
        ncols: int = 1,
        squeeze: bool = True,
        wspace: float | None = None,
        hspace: float | None = None,
        width_ratios: ArrayLike = ...,
        height_ratios: ArrayLike = ...,
        **kwargs,
    ): ...
    def add_subfigure(
        self, subplotspec: SubplotSpec, **kwargs
    ) -> SubFigure: ...
    def sca(self, a: Axes) -> Axes: ...
    def gca(self) -> Axes: ...
    def get_default_bbox_extra_artists(self): ...
    def get_tightbbox(
        self,
        renderer: RendererBase = ...,
        bbox_extra_artists: Sequence[Artist] | None = ...,
    ) -> BboxBase: ...
    def subplot_mosaic(
        self,
        mosaic: list | str,
        *,
        sharex: bool = ...,
        sharey: bool = ...,
        subplot_kw: dict = ...,
        gridspec_kw: dict = ...,
        empty_sentinel: object = ...,
    ) -> dict[Text, Axes]: ...

class Figure(FigureBase):

    callbacks = ...
    def __str__(self) -> str: ...
    def __repr__(self): ...
    def __init__(
        self,
        figsize: tuple[float, float] = ...,
        dpi: float = ...,
        facecolor: ColorType = ...,
        edgecolor: ColorType = ...,
        linewidth: float = ...,
        frameon: bool = ...,
        subplotpars: SubplotParams = ...,
        tight_layout: bool | dict = ...,
        constrained_layout: bool = ...,
        *,
        layout: (
            LayoutEngine | Literal["constrained", "compressed", "tight"] | None
        ) = ...,
        **kwargs,
    ) -> None: ...
    def set_layout_engine(
        self,
        layout: (
            LayoutEngine | Literal["constrained", "compressed", "tight"]
        ) = ...,
        **kwargs: dict,
    ) -> None: ...
    def get_layout_engine(self) -> None: ...
    def show(self, warn: bool = True) -> None: ...
    @property
    def axes(self) -> list[Axes]: ...
    get_axes = ...
    dpi = ...
    def get_tight_layout(self) -> bool: ...
    def set_tight_layout(
        self, tight: bool | Literal["w_pad", "h_pad", "rect"] | None
    ): ...
    def get_constrained_layout(self) -> bool: ...
    def set_constrained_layout(self, constrained: bool | dict | None): ...
    def set_constrained_layout_pads(self, **kwargs) -> None: ...
    def get_constrained_layout_pads(self, relative: bool = ...): ...
    def set_canvas(self, canvas: FigureCanvasBase) -> None: ...
    canvas: FigureCanvasBase

    def figimage(
        self,
        X: ArrayLike,
        xo: int = ...,
        yo: int = ...,
        alpha: None | float = ...,
        norm: Normalize = ...,
        cmap: CmapType = ...,
        vmin: float = ...,
        vmax: float = ...,
        origin: Literal["upper", "lower"] = ...,
        resize: bool = ...,
        **kwargs,
    ) -> FigureImage: ...
    def set_size_inches(
        self, w: float, h: float = ..., forward: bool = True
    ) -> None: ...
    def get_size_inches(self) -> np.ndarray: ...
    def get_figwidth(self): ...
    def get_figheight(self): ...
    def get_dpi(self) -> float: ...
    def set_dpi(self, val: float) -> None: ...
    def set_figwidth(self, val: float, forward: bool = ...) -> None: ...
    def set_figheight(self, val: float, forward: bool = ...) -> None: ...
    def clear(self, keep_observers: bool = ...) -> None: ...
    @allow_rasterization
    def draw(self, renderer) -> None: ...
    def draw_without_rendering(self) -> None: ...
    def draw_artist(self, a: Artist) -> None: ...
    def __getstate__(self): ...
    def __setstate__(self, state) -> None: ...
    def add_axobserver(self, func: Callable) -> None: ...
    def savefig(
        self,
        fname: str | PathLike | FileLike | BytesIO | BufferedWriter,
        *,
        transparent: bool = ...,
        **kwargs,
    ) -> None: ...
    def ginput(
        self,
        n: int = ...,
        timeout: float = ...,
        show_clicks: bool = ...,
        mouse_add: MouseButton | None = ...,
        mouse_pop: MouseButton | None = ...,
        mouse_stop: MouseButton | None = ...,
    ) -> list[tuple[float, float]]: ...
    def waitforbuttonpress(self, timeout=...) -> None: ...
    def execute_constrained_layout(self, renderer=...) -> None: ...
    def tight_layout(
        self,
        *,
        pad: float = 1.08,
        h_pad: float = ...,
        w_pad: float = ...,
        rect: tuple[float, float, float, float] = ...,
    ) -> None: ...

def figaspect(arg: float): ...

class SubFigure(FigureBase):

    callbacks = ...
    def __init__(
        self,
        parent: FigureBase,
        subplotspec: SubplotSpec,
        *,
        facecolor: ColorType = ...,
        edgecolor: ColorType = ...,
        linewidth: float = ...,
        frameon: bool = ...,
        **kwargs,
    ) -> None: ...
    @property
    def dpi(self) -> float: ...
    @dpi.setter
    def dpi(self, value: float): ...
    def get_dpi(self) -> float: ...
    def set_dpi(self, val: float) -> None: ...
    def get_constrained_layout(self) -> bool: ...
    def get_constrained_layout_pads(self, relative: bool = ...): ...
    def get_layout_engine(self) -> LayoutEngine: ...
    @property
    def axes(self) -> list[Axes]: ...
    get_axes = ...
    def draw(self, renderer: RendererBase) -> None: ...
