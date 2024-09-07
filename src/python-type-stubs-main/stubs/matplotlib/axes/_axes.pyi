import datetime
from re import L

from matplotlib.backend_bases import MouseEvent
from matplotlib.patheffects import AbstractPathEffect
from font_manager import FontProperties
import mlab
import numpy as np
from typing import Annotated, Any, Callable, Dict, Generic, List, Literal, Optional, Sequence, Tuple, TypeVar, Union, overload
from typing_extensions import Unpack

# from matplotlib._typing import * seems not to work, need the explicit imports:
from matplotlib._typing import PatchProps, MarkerType, MarkerStrs, SingleLetterColorStrs, ArrayLike, ArrowProps, AxesProps, ColorType, CollectionProps, EventCollectionProps, Line2DProps, LineCollectionProps, Linestyle, NamedFontSize, PolygonProps, RectangleProps, TextCoordSystem, TextProps, XYCoordSystem

from matplotlib.backend_tools import Cursors
from matplotlib.contour import QuadContourSet
from matplotlib.transforms import Bbox, BboxTransformTo, Transform
from matplotlib.text import Annotation, Text
from matplotlib.container import BarContainer, ErrorbarContainer, StemContainer
from matplotlib.patches import FancyArrow, Polygon, Rectangle, StepPatch, Wedge
from matplotlib.quiver import Barbs, Quiver
from matplotlib.colors import Colormap, Normalize
from matplotlib.axes._secondary_axes import SecondaryAxis
from matplotlib.collections import (
    EventCollection,
    LineCollection,
    BrokenBarHCollection,
    PathCollection,
    PolyCollection,
    Collection,
    QuadMesh,
)
from matplotlib.lines import Line2D
from matplotlib.legend import Legend
from matplotlib.markers import MarkerStyle
from matplotlib.ticker import Formatter
from matplotlib.figure import Figure
from matplotlib.image import AxesImage, PcolorImage
from matplotlib.axis import XAxis, YAxis
from matplotlib.artist import Artist
from matplotlib.spines import Spines

from transforms import BboxBase
from ._base import _AxesBase

from matplotlib.table import table as table_table
from matplotlib.tri import (
    tricontour as tri_tricontour,
    tricontour as tri_tricontourf,
    tripcolor as tri_tripcolor,
    triplot as tri_triplot,
)

class Axes(_AxesBase):

    dataLim: Bbox
    viewLim: Bbox
    figure: Figure
    transAxes: BboxTransformTo
    transData: Transform
    xaxis: XAxis
    yaxis: YAxis
    spines: Spines
    fmt_xdata: None | Formatter = ...
    fmt_ydata: None | Formatter = ...
    cursor_to_use: Cursors = ...

    def get_title(
        self, loc: Literal["center", "left", "right"] = "center"
    ) -> str: ...
    def set_title(
        self,
        label: str | Literal["My Plot"], # Required args can't have a default, but we can "provide" a default via a Literal
        fontdict: (
            dict[str, object] | None
        ) = ...,  # TODO not sure what the set of permitted keys are...
        loc: Literal["center", "left", "right"] = "center",
        pad: float = 6.0,
        *,
        y: float = 1.0,  # @TODO william's says its None by default?
        **kwargs: AxesProps,
    ) -> Text: ...
    def get_legend_handles_labels(
        self, legend_handler_map=...
    ) -> tuple[list, list]: ...
    def legend(
        self,
        labels: Sequence[str] | None = None,
        loc: (
            Literal[
                "best",
                "upper right",
                "upper left",
                "lower left",
                "lower right",
                "right",
                "center left",
                "center right",
                "lower center",
                "upper center",
                "center",
            ]
            | tuple[float, float]
        ) = "best",  # @TODO: each "string" location can also be given as a numeric value
        bbox_to_anchor: (
            BboxBase | tuple[float, float] | tuple[float, float, float, float]
        ) | None = None,
        ncols: int = 1,
        ncol: int = 1,
        prop: None | dict = None,
        fontsize: int | NamedFontSize | None = None,
        labelcolor: ColorType | Sequence[ColorType] | None = None,
        numpoints: int = 1,
        scatterpoints: int = 1,
        scatteryoffsets: Sequence[float] = [0.375, 0.5, 0.3125],
        markerscale: float = 1.0,
        markerfirst: bool = True,
        reverse: bool = False,
        frameon: bool = True,
        fancybox: bool = True,
        shadow: bool = False,
        framealpha: float = 0.8,
        facecolor: Literal["inherit"] | ColorType = "inherit",
        edgecolor: Literal["inherit"] | ColorType = "black",
        mode: Literal["expand"] | None = None,
        bbox_transform: Transform | None = None,
        title: str | None = None,
        title_fontproperties: None | dict | FontProperties = None,
        title_fontsize: int | NamedFontSize | None = None,
        alignment: Literal["center", "left", "right"] = "center",
        borderpad: float = 0.4,
        labelspacing: float = 0.5,
        handlelength: float = 2.0,
        handleheight: float = 0.7,
        handletextpad: float = 0.8,
        borderaxespad: float = 0.5,
        columnspacing: float = 2.0,
        handler_map: dict | None = ...,
        draggable: bool = False,
    ) -> Legend: ...
    def inset_axes(
        self,
        bounds: Sequence[float],
        *,
        transform: Transform = ...,
        projection: (
            Literal[
                "aitoff",
                "hammer",
                "lambert",
                "mollweide",
                "polar",
                "rectilinear",
            ]
            | str
            | None
        ) = None,
        polar: bool = False,
        axes_class: None | Axes = None,
        zorder: float = 5,
        **kwargs,  # @TODO: I don't know what the kwargs are? (No docs: https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.inset_axes.html)
    ) -> Axes: ...
    def indicate_inset(
        self,
        bounds: Sequence[float],
        inset_ax: Axes = ...,
        *,
        transform: Transform = ...,
        facecolor: ColorType = "none",
        edgecolor: ColorType = "0.5",
        alpha: float = 0.5,
        zorder: float = 4.99,
        **kwargs: RectangleProps,
    ) -> Rectangle: ...
    def indicate_inset_zoom(
        self, inset_ax: Axes, **kwargs
    ) -> (
        Rectangle
    ): ...  # @TODO: Other keyword arguments are passed on to Axes.indicate_inset
    def secondary_xaxis(
        self,
        location: Literal["top", "bottom", "left", "right"] | float,
        *,
        functions=tuple[Callable, Callable] | Transform,
        **kwargs: AxesProps,
    ) -> SecondaryAxis: ...
    def secondary_yaxis(
        self,
        location: Literal["top", "bottom", "left", "right"] | float,
        *,
        functions=tuple[Callable, Callable] | Transform,
        **kwargs: AxesProps,
    ) -> SecondaryAxis: ...
    def text(
        self,
        x: float,
        y: float,
        s: str,
        fontdict: dict[str, object] | None = None,
        **kwargs: TextProps,
    ) -> Text: ...
    def annotate(
        self,
        text: str,
        xy: tuple[float, float],
        xytext: tuple[float, float] = ...,
        xycoords: XYCoordSystem | tuple[XYCoordSystem, XYCoordSystem] = "data",
        textcoords: TextCoordSystem = "data",  # @TODO: default is value of xycoords, not always 'data'
        arrowprops: ArrowProps = ...,
        annotation_clip: bool | None = None,
        **kwargs: TextProps,
    ) -> Annotation: ...
    def axhline(
        self,
        y: float = 0,
        xmin: float = 0,
        xmax: float = 1,
        **kwargs: Line2DProps,
    ) -> Line2D: ...
    def axvline(
        self,
        x: float = 0,
        ymin: float = 0,
        ymax: float = 1,
        **kwargs: Line2DProps,
    ) -> Line2D: ...
    def axline(
        self,
        xy1: tuple[float, float],
        xy2: tuple[float, float] = ...,
        *,
        slope: float = ...,
        **kwargs: Line2DProps,
    ) -> Line2D: ...
    def axhspan(
        self,
        ymin: float,
        ymax: float,
        xmin: float = 0,
        xmax: float = 1,
        **kwargs: PolygonProps,
    ) -> Polygon: ...
    def axvspan(
        self,
        xmin: float,
        xmax: float,
        ymin: float = 0,
        ymax: float = 1,
        **kwargs: PolygonProps,
    ) -> Polygon: ...
    def hlines(
        self,
        y: float | ArrayLike,
        xmin: float | ArrayLike,
        xmax: float | ArrayLike,
        colors: Sequence[ColorType] = "C0",
        linestyles: Literal["solid", "dashed", "dashdot", "dotted"] = "solid",
        label: str = "",
        **kwargs: LineCollectionProps,
    ) -> LineCollection: ...
    def vlines(
        self,
        x: float | ArrayLike,
        ymin: float | ArrayLike,
        ymax: float | ArrayLike,
        colors: Sequence[ColorType] = ...,
        linestyles: Literal["solid", "dashed", "dashdot", "dotted"] = ...,
        label: str = ...,
        **kwargs: LineCollectionProps,
    ) -> LineCollection: ...
    def eventplot(
        self,
        positions: ArrayLike | Sequence[ArrayLike],
        orientation: Literal["horizontal", "vertical"] = "horizontal",
        lineoffsets: float | ArrayLike = 1,
        linelengths: float | ArrayLike = 1,
        linewidths: float | ArrayLike = 1.5,
        colors: ColorType | Sequence[ColorType] = "C0",
        alpha: float | ArrayLike = 1,
        linestyles: Linestyle | Sequence[Linestyle] = "solid",
        **kwargs: EventCollectionProps,
    ) -> list[EventCollection]: ...
    # def plot(
    #     self,
    #     x: ArrayLike | float,
    #     y: ArrayLike | float,
    #     fmt: str = ...,  # TODO: This will really suck to type.. https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.plot.html
    #     scalex: bool = True,
    #     scaley: bool = True,
    #     data: dict = {},
    #     **kwargs: Line2DProps,
    # ) -> list[Line2D]: ...
    # def bar(
    #     self,
    #     x: float | ArrayLike,
    #     height: float | ArrayLike,
    #     width: float | ArrayLike = 0.8,
    #     bottom: float | ArrayLike = 0,
    #     *,  # What does the star mean?
    #     align: Literal["center", "edge"] = "center",
    #     color: ColorType | Sequence[ColorType] = ...,
    #     # color: ColorType | Sequence[ColorType] = ...,
    #     edgecolor: ColorType | Sequence[ColorType] = ...,
    #     linewidth: float | ArrayLike = ...,
    #     tick_label: str | Sequence[str] = ...,
    #     label: str | Sequence[str] = ...,
    #     xerr: float | ArrayLike = ...,
    #     yerr: float | ArrayLike = ...,
    #     ecolor: ColorType | Sequence[ColorType] = "black",
    #     capsize: float = 0.0,
    #     error_kw: float | ArrayLike = ...,
    #     log: bool = False,
    #     data: dict = ...,  # !TODO: This is weird
    #     **kwargs: RectangleProps,
    # ) -> BarContainer: ...
    def plot(
        self,
        x: ArrayLike | float,
        y: ArrayLike | float,
        fmt: str | Literal['o:g'] | MarkerStrs | Literal['-','--','-.',':'] | SingleLetterColorStrs = 'o:g',
        /,
        label: str | None = '',
        **kwargs: Line2DProps,
    ) -> list[Line2D]: ...
    def plot_date(
        self,
        x: ArrayLike,
        y: ArrayLike,
        fmt: str = ...,
        tz: datetime.tzinfo = "UTC",
        xdate: bool = True,
        ydate: bool = True,
        data: dict | None = None,
        **kwargs: Line2DProps,
    ) -> list[Line2D]: ...
    def loglog(
        self,
        base: float = 1.0,
        subs: Sequence | None = None,
        nonpositive: Literal["mask", "clip"] = "clip",
        # All parameters supported by plot.
        y: ArrayLike | float = ...,
        x: ArrayLike | float = ...,
        fmt: str = ...,  # @TODO: This will really suck to type.. https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.plot.html
        scalex: bool = True,
        scaley: bool = True,
        data: dict = {},
        **kwargs: Line2DProps,
    ) -> list[Line2D]: ...
    def semilogx(
        self,
        base: float = 10.0,
        subs: Sequence | None = None,
        nonpositive: Literal["mask", "clip"] = "clip",
        # All parameters supported by plot.
        y: ArrayLike | float = ...,
        x: ArrayLike | float = ...,
        fmt: str = ...,  # @TODO: This will really suck to type.. https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.plot.html
        scalex: bool = True,
        scaley: bool = True,
        data: dict = {},
        **kwargs: Line2DProps,
    ) -> list[Line2D]: ...
    def semilogy(
        self,
        base: float = 10.0,
        subs: Sequence | None = None,
        nonpositive: Literal["mask", "clip"] = "clip",
        # All parameters supported by plot.
        y: ArrayLike | float = ...,
        x: ArrayLike | float = ...,
        fmt: str = ...,  # @TODO: This will really suck to type.. https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.plot.html
        scalex: bool = True,
        scaley: bool = True,
        data: dict = {},
        **kwargs: Line2DProps,
    ) -> list[Line2D]: ...
    def acorr(self, x: ArrayLike, **kwargs): ...
    def xcorr(
        self,
        x: ArrayLike,
        y: ArrayLike,
        detrend: Callable = mlab.detrand_none,
        normed: bool = True,
        usevlines: bool = True,
        maxlags: int = 10,
        **kwargs,  # @TODO: Additional parameters are passed to Axes.vlines and Axes.axhline if usevlines is True; otherwise they are passed to Axes.plot.
    ) -> tuple[np.ndarray, np.ndarray, bool, int]: ...
    def step(
        self,
        x: ArrayLike,
        y: ArrayLike,
        *args,
        where: Literal["pre", "post", "mid"] = ...,
        data=...,
        **kwargs,
    ) -> list[Line2D]: ...
    def bar(
        self,
        x: float | ArrayLike,
        height: float | ArrayLike,
        width: float | ArrayLike = 0.8,
        bottom: float | ArrayLike = 0,
        *,  # What does the star mean?
        align: Literal["center", "edge"] = "center",
        color: ColorType | Sequence[ColorType] = ...,
        edgecolor: ColorType | Sequence[ColorType] = ...,
        linewidth: float | ArrayLike = 0.0,
        tick_label: str | Sequence[str] = ...,
        label: str | Sequence[str] = ...,
        xerr: float | ArrayLike = ...,
        yerr: float | ArrayLike = ...,
        ecolor: ColorType | Sequence[ColorType] = "black",
        capsize: float = 0.0,
        error_kw: float | ArrayLike = ...,
        log: bool = False,
        data: dict = ...,  # !TODO: This is weird
        **kwargs: RectangleProps,
    ) -> BarContainer: ...
    def barh(
        self,
        y: float | ArrayLike,
        width: float | ArrayLike,
        height: float | ArrayLike = 0.8,
        left: float | ArrayLike = 0,
        *,
        align: Literal["center", "edge"] = "center",
        color: ColorType | Sequence[ColorType] = ...,
        edgecolor: ColorType | Sequence[ColorType] = ...,
        linewidth: float | ArrayLike = ...,
        tick_label: str | Sequence[str] = ...,
        label: str | Sequence[str] = ...,
        xerr: float | ArrayLike = ...,
        yerr: float | ArrayLike = ...,
        ecolor: ColorType | Sequence[ColorType] = "black",
        capsize: float = 0.0,
        error_kw: dict = ...,
        log: bool = False,
        data: dict = ...,
        **kwargs: RectangleProps,
    ) -> BarContainer: ...
    def bar_label(
        self,
        container: BarContainer,
        labels: ArrayLike = ...,
        *,
        fmt: str = "%g",
        label_type: Literal["edge", "center"] = "edge",
        padding: float = 0,
        **kwargs,
    ) -> list[Text]: ...
    def broken_barh(
        self,
        xranges: Sequence[tuple[float, float]],
        yrange: tuple[float, float],
        **kwargs,
    ) -> BrokenBarHCollection: ...
    def stem(
        self,
        *args,
        linefmt: str = ...,
        markerfmt: str = ...,
        basefmt: str = "C3-",
        bottom: float = 0,
        label: str | None = None,
        use_line_collection: bool = True,
        orientation: str = "verical",
    ) -> StemContainer: ...
    def pie(
        self,
        x,
        explode: ArrayLike | None = None,
        labels: list | None = None,
        colors: ArrayLike | None = None,
        autopct: None | str | Callable = None,
        pctdistance: float = 0.6,
        shadow: bool = False,
        labeldistance: float | None = 1.1,
        startangle: float = 0,
        radius: float = 1,
        counterclock: bool = True,
        wedgeprops: dict | None = None,
        textprops: dict | None = None,
        center: tuple[float, float] = (0, 0),
        frame: bool = False,
        rotatelabels: bool = False,
        *,
        normalize: bool = True,
    ) -> tuple[list[Wedge], list[Text], list[Text]]: ...
    def errorbar(
        self,
        x: float | ArrayLike,
        y: float | ArrayLike,
        yerr: float | ArrayLike = ...,
        xerr: float | ArrayLike = ...,
        fmt: str = "",
        ecolor: ColorType | None = None,
        elinewidth: float | None = None,
        capsize: float = ...,
        barsabove: bool = False,
        lolims: bool = False,
        uplims: bool = False,
        xlolims: bool = False,
        xuplims: bool = False,
        errorevery: int = 1,
        capthick: float | None = None,
        **kwargs,
    ) -> ErrorbarContainer: ...
    def boxplot(
        self,
        x: ArrayLike,
        notch: bool = False,
        sym: Literal['b+'] | MarkerStrs | SingleLetterColorStrs | str = ...,
        vert: bool = True,
        whis: float | Tuple[Literal[5], Literal[95]] | Tuple[float, float] = 1.5,
        bootstrap: int = ...,
        usermedians: ArrayLike = ...,
        conf_intervals: ArrayLike = ...,
        positions: ArrayLike = ...,
        widths: float | ArrayLike = ...,
        patch_artist: bool = False,
        tick_labels: Sequence[str] = ...,
        labels: Sequence[str] = ..., # deprecated
        manage_ticks: bool = True,
        autorange: bool = False,
        meanline: bool = False,
        showmeans: bool = True,
        showcaps: bool = True,
        showbox: bool = True,
        showfliers: bool = False,
        capprops: Line2DProps = ...,
        capwidths=...,
        boxprops: Line2DProps | PatchProps =...,
        flierprops=...,
        medianprops=...,
        meanprops=...,
        whiskerprops: Line2DProps = ...,
        zorder: float = 2,
    ) -> dict[str, list[Line2D]]: ...
    def bxp(
        self,
        bxpstats: Sequence[dict],
        positions: ArrayLike = ...,
        widths: float | ArrayLike | None = None,
        vert: bool = True,
        patch_artist: bool = False,
        shownotches: bool = False,
        showmeans: bool = False,
        showcaps: bool = True,
        showbox: bool = True,
        showfliers: bool = True,
        boxprops: dict = ...,
        whiskerprops: dict = ...,
        flierprops: dict = ...,
        medianprops: dict = ...,
        capprops: dict = ...,
        meanprops: dict = ...,
        meanline: bool = False,
        manage_ticks: bool = True,
        zorder: float = 2,
        capwidths: float | ArrayLike | None = None,
    ) -> dict[str, list[Line2D]]: ...
    def scatter(
        self,
        x: float | ArrayLike,
        y: float | ArrayLike,
        s: float | ArrayLike = 36.0,
        c: ColorType | Sequence[ColorType] | None = ...,
        marker: MarkerType = 'o',
        cmap: str | Colormap = 'viridis',
        norm: Literal['asinh', 'function', 'functionlog', 'linear', 'log', 'logit', 'symlog'] | str | Normalize | None = None,
        vmin: float | None = None,
        vmax: float | None = None,
        alpha: float | None = None,
        linewidths: float | Sequence[float] = ...,
        edgecolors: ColorType | Sequence[ColorType] | Literal['face', 'none'] | None = ...,
        plotnonfinite: bool = False,
        **kwargs: CollectionProps,
    ) -> PathCollection: ...
    def hexbin(
        self,
        x: ArrayLike,
        y: ArrayLike,
        C: ArrayLike = ...,
        gridsize: int = 100,
        bins: Literal["log"] | int | Sequence | None = None,
        xscale: Literal["linear", "log"] = "linear",
        yscale: Literal["linear", "log"] = "linear",
        extent: Sequence[float] | None = None,
        cmap=...,
        norm=...,
        vmin=...,
        vmax=...,
        alpha=...,
        linewidths=...,
        edgecolors=...,
        reduce_C_function=...,
        mincnt: int | None = None,
        marginals: bool = False,
        **kwargs,
    ) -> PolyCollection: ...
    def arrow(
        self, x: float, y: float, dx: float, dy: float, **kwargs
    ) -> FancyArrow: ...
    def quiverkey(
        self, Q: Quiver, X: float, Y: float, U: float, label: str, **kwargs
    ): ...
    def quiver(self, *args, **kwargs) -> Quiver: ...
    def barbs(self, *args, **kwargs) -> Barbs: ...
    def fill(self, *args, data=..., **kwargs) -> list[Polygon]: ...
    def fill_between(
        self,
        x,
        y1: Scalar,
        y2: Scalar = ...,
        where: ArrayLike = ...,
        interpolate: bool = ...,
        step: Literal["pre", "post", "mid"] = ...,
        **kwargs,
    ) -> PolyCollection: ...
    def fill_betweenx(
        self,
        y,
        x1: Scalar,
        x2: Scalar = ...,
        where: ArrayLike = ...,
        step: Literal["pre", "post", "mid"] = ...,
        interpolate: bool = ...,
        **kwargs,
    ) -> PolyCollection: ...
    def imshow(
        self,
        X: ArrayLike,
        cmap: str | Colormap = ...,
        norm: Normalize = ...,
        aspect: Literal["equal", "auto"] | float = ...,
        interpolation: str = ...,
        alpha: float | ArrayLike = ...,
        vmin: float = ...,
        vmax: float = ...,
        origin: Literal["upper", "lower"] = ...,
        extent: Sequence[float] = ...,
        *,
        interpolation_stage: Literal["data", "rgba"] = ...,
        filternorm: bool = True,
        filterrad: float = 4,
        resample: bool = ...,
        url: str = ...,
        **kwargs,
    ) -> AxesImage: ...
    def pcolor(
        self,
        *args,
        shading: Literal["flat", "nearest", "auto"] = ...,
        alpha: float | None = None,
        norm: Normalize = ...,
        cmap: str | Colormap = ...,
        vmin: float | None = None,
        vmax: float | None = None,
        **kwargs,
    ) -> Collection: ...
    def pcolormesh(
        self,
        *args,
        alpha: float | None = None,
        norm: Normalize = ...,
        cmap: str | Colormap = ...,
        vmin: float | None = None,
        vmax: float | None = None,
        shading: Literal["flat", "nearest", "gouraud", "auto"] = ...,
        antialiased=...,
        **kwargs,
    ) -> QuadMesh: ...
    def pcolorfast(
        self,
        *args,
        alpha: float | None = None,
        norm: Normalize = ...,
        cmap: str | Colormap = ...,
        vmin: float | None = None,
        vmax: float | None = None,
        **kwargs,
    ) -> tuple[AxesImage, PcolorImage, QuadMesh]: ...
    def contour(self, *args, **kwargs) -> QuadContourSet: ...
    def contourf(self, *args, **kwargs) -> QuadContourSet: ...
    def clabel(self, CS, levels: ArrayLike = ..., **kwargs): ...
    @overload
    def hist(
        self,
        x: Sequence[ArrayLike],
        bins: int | ArrayLike | str = ...,
        range: tuple | None = ...,
        density: bool = ...,
        weights: None = ...,
        cumulative: bool | Literal[-1] = ...,
        bottom=...,
        histtype: Literal["bar", "barstacked", "step", "stepfilled"] = ...,
        align: Literal["left", "mid", "right"] = ...,
        orientation: Literal["vertical", "horizontal"] = ...,
        rwidth: float | None = ...,
        log: bool = ...,
        color: ColorType | None = ...,
        label: str | None = ...,
        stacked: bool = ...,
        **kwargs,
    ) -> tuple[list[list[float]], list[float], BarContainer | list]: ...
    @overload
    def hist(
        self,
        x: ArrayLike,
        bins: int | ArrayLike | str = ...,
        range: tuple[float, float] | None = None,
        density: bool = False,
        weights: ArrayLike | None = None,
        cumulative: bool | Literal[-1] = False,
        bottom: ArrayLike | Scalar | None = None,
        histtype: Literal["bar", "barstacked", "step", "stepfilled"] = "bar",
        align: Literal["left", "mid", "right"] = "mid",
        orientation: Literal["vertical", "horizontal"] = "vertical",
        rwidth: float | None = None,
        log: bool = False,
        color: ColorType | None = None,
        label: str | None = None,
        stacked: bool = False,
        **kwargs,
    ) -> tuple[list[float], list[float], BarContainer | list]: ...
    def stairs(
        self,
        values: ArrayLike,
        edges: ArrayLike = ...,
        *,
        orientation: Literal["vertical", "horizontal"] = "vertical",
        baseline: float | ArrayLike | None = 0,
        fill: bool = False,
        **kwargs,
    ) -> StepPatch: ...
    def hist2d(
        self,
        x,
        y,
        bins: None | int | ArrayLike = ...,
        range=...,
        density: bool = False,
        weights=...,
        cmin: float | None = None,
        cmax: float | None = None,
        **kwargs,
    ) -> tuple[
        np.ndarray, np.ndarray, np.ndarray, tuple[float, float] | None
    ]: ...
    def psd(
        self,
        x: Sequence,
        NFFT: int = ...,
        Fs: float = ...,
        Fc: int = 0,
        detrend: Literal["none", "mean", "linear"] | Callable = ...,
        window: Callable | np.ndarray = ...,
        noverlap: int = 0,
        pad_to: int = ...,
        sides: Literal["default", "onesided", "twosided"] = ...,
        scale_by_freq: bool = ...,
        return_line: bool = False,
        **kwargs,
    ) -> tuple[np.ndarray, np.ndarray, Line2D]: ...
    def csd(
        self,
        x: ArrayLike,
        y: ArrayLike,
        NFFT: int = ...,
        Fs: float = ...,
        Fc: int = 0,
        detrend: Literal["none", "mean", "linear"] | Callable = ...,
        window: Callable | np.ndarray = ...,
        noverlap: int = 0,
        pad_to: int = ...,
        sides: Literal["default", "onesided", "twosided"] = ...,
        scale_by_freq: bool = ...,
        return_line: bool = False,
        **kwargs,
    ) -> tuple[np.ndarray, np.ndarray, Line2D]: ...
    def magnitude_spectrum(
        self,
        x: Sequence,
        Fs: float = ...,
        Fc: int = ...,
        window: Callable | np.ndarray = ...,
        pad_to: int = ...,
        sides: Literal["default", "onesided", "twosided"] = ...,
        scale: Literal["default", "linear", "dB"] = "linear",
        **kwargs,
    ) -> tuple[np.ndarray, np.ndarray, Line2D]: ...
    def angle_spectrum(
        self,
        x: Sequence,
        Fs: float = ...,
        Fc: int = 0,
        window: Callable | np.ndarray = ...,
        pad_to: int = ...,
        sides: Literal["default", "onesided", "twosided"] = ...,
        **kwargs,
    ) -> tuple[np.ndarray, np.ndarray, Line2D]: ...
    def phase_spectrum(
        self,
        x: Sequence,
        Fs: float = ...,
        Fc: int = 0,
        window: Callable | np.ndarray = ...,
        pad_to: int = ...,
        sides: Literal["default", "onesided", "twosided"] = ...,
        **kwargs,
    ) -> tuple[np.ndarray, np.ndarray, Line2D]: ...
    def cohere(
        self,
        x,
        y,
        NFFT: int = ...,
        Fs: float = ...,
        Fc: int = 0,
        detrend: Literal["none", "mean", "linear"] | Callable = ...,
        window: Callable | np.ndarray = ...,
        noverlap: int = 0,
        pad_to: int = ...,
        sides: Literal["default", "onesided", "twosided"] = ...,
        scale_by_freq: bool = ...,
        **kwargs,
    ) -> tuple[np.ndarray, np.ndarray]: ...
    def specgram(
        self,
        x: Sequence,
        NFFT: int = ...,
        Fs: float = ...,
        Fc: int = 0,
        detrend: Literal["none", "mean", "linear"] | Callable = ...,
        window: Callable | np.ndarray = ...,
        noverlap: int = 128,
        cmap: Colormap = ...,
        xextent=...,
        pad_to: int = ...,
        sides: Literal["default", "onesided", "twosided"] = ...,
        scale_by_freq: bool = ...,
        mode: Literal["default", "psd", "magnitude", "angle", "phase"] = "psd",
        scale: Literal["default", "linear", "dB"] = "dB",
        vmin=...,
        vmax=...,
        **kwargs,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, AxesImage]: ...
    def spy(
        self,
        Z,
        precision: float | Literal["present"] = 0,
        marker=...,
        markersize=...,
        aspect: Literal["equal", "auto", None] | float = "equal",
        origin: Literal["upper", "lower"] = ...,
        **kwargs,
    ) -> AxesImage | Line2D: ...
    def matshow(self, Z: ArrayLike, **kwargs) -> AxesImage: ...
    def violinplot(
        self,
        dataset: ArrayLike,
        positions: ArrayLike = ...,
        vert: bool = True,
        widths: ArrayLike | float = 0.5,
        showmeans: bool = False,
        showextrema: bool = True,
        showmedians: bool = False,
        quantiles: ArrayLike | None = None,
        points: int = 100,
        bw_method: str | Scalar | Callable | None = None,
    ) -> dict[str, Collection]: ...
    def violin(
        self,
        vpstats: Sequence[dict],
        positions: ArrayLike = ...,
        vert: bool = True,
        widths: ArrayLike | float = 0.5,
        showmeans: bool = False,
        showextrema: bool = True,
        showmedians: bool = False,
    ) -> dict[str, Collection]: ...
    table = table_table
    stackplot = ...
    streamplot = ...
    tricontour = tri_tricontour.tricontour
    tricontourf = tri_tricontourf.tricontourf
    tripcolor = tri_tripcolor.tripcolor
    triplot = tri_triplot.triplot  #

# --------------------- Extra Typings -------------------- #
