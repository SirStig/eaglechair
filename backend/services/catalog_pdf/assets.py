"""
Brand template layers, spec icons and fonts for the catalog generator.

template.pdf is built from the printed catalogs by
backend/scripts/build_catalog_template.py: one layer per page, stamped onto
catalog pages with show_pdf_page (vectors stay vectors).
"""

import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

import fitz

ASSET_DIR = Path(__file__).resolve().parents[2] / "assets" / "catalog_template"
TEMPLATE_PATH = ASSET_DIR / "template.pdf"
SPEC_ICON_DIR = ASSET_DIR / "spec-icons"
FONT_DIR = ASSET_DIR / "fonts"

# Page order of template.pdf (keep in sync with build_catalog_template.LAYERS)
LAYERS = {
    "bg_spec": 0,
    "bg_gallery": 1,
    "logo": 2,
    "spec_panel": 3,
    "banner_panel": 4,
    "flag_emblem": 5,
    "made_in_usa": 6,
}

# Where the eagle sits on the logo layer, for stamping it elsewhere/scaled
LOGO_CLIP = fitz.Rect(21.4, 8.3, 54.3, 39.2)

PAGE_WIDTH, PAGE_HEIGHT = 612.0, 792.0

# Catalog colors
INK = (0x22 / 255, 0x1F / 255, 0x1F / 255)  # body text #221f1f
WHITE = (1.0, 1.0, 1.0)
BROWN = (0x59 / 255, 0x40 / 255, 0x3A / 255)  # cover lettering
GREY = (0.38, 0.38, 0.40)

# The catalogs set titles in Helvetica Light Oblique. Helvetica is licensed
# with macOS and is not bundled; drop a licensed copy into fonts/ under one of
# these names and the generator uses it, otherwise Helvetica Oblique.
TITLE_FONT_FILES = (
    "Helvetica-LightOblique.ttf",
    "Helvetica-LightOblique.otf",
    "HelveticaLightOblique.ttf",
    "title.ttf",
    "title.otf",
)


def _title_font_file() -> Optional[Path]:
    for name in TITLE_FONT_FILES:
        path = FONT_DIR / name
        if path.is_file():
            return path
    return None


@lru_cache(maxsize=1)
def fonts() -> dict[str, fitz.Font]:
    """Font objects by role: regular, bold, oblique, bold_oblique, title, serif_bold."""
    title_file = _title_font_file()
    return {
        "regular": fitz.Font("helv"),
        "bold": fitz.Font("hebo"),
        "oblique": fitz.Font("heit"),
        "bold_oblique": fitz.Font("hebi"),
        "title": fitz.Font(fontfile=str(title_file)) if title_file else fitz.Font("heit"),
        "serif_bold": fitz.Font("tibo"),
    }


_ACCENT_RE = re.compile(r"var\(--spec-accent[^)]*\)")


def _hex(rgb) -> str:
    return "#" + "".join(f"{round(c * 255):02x}" for c in rgb)


@lru_cache(maxsize=64)
def spec_icon_pdf(name: str) -> Optional[bytes]:
    """A spec icon SVG as one-page PDF bytes, in black, or None."""
    if not re.fullmatch(r"[a-z0-9-]+", name or ""):
        return None
    path = SPEC_ICON_DIR / f"{name}.svg"
    if not path.is_file():
        return None
    svg = path.read_text(encoding="utf-8")
    # Symbols print solid black: the accent part is inked like the rest
    svg = _ACCENT_RE.sub(_hex(INK), svg).replace("currentColor", _hex(INK))
    with fitz.open(stream=svg.encode("utf-8"), filetype="svg") as doc:
        return doc.convert_to_pdf()


class SharedAssets:
    """
    Template and spec icons kept open between renders. Opening them per page
    (and per icon row) was a large share of preview time. Only use while
    holding the renderer's lock: fitz documents are not thread-safe.
    """

    def __init__(self):
        self.template = fitz.open(TEMPLATE_PATH)
        self._icon_paths: dict[str, Optional[tuple]] = {}

    def icon_paths(self, name: str) -> Optional[tuple]:
        """
        The icon's vector paths, normalized to a unit square, or None.

        Icons are drawn as plain paths (draw_icon) rather than stamped with
        show_pdf_page, which rescans the page's resources on every call and
        was the slowest part of a product sheet.
        """
        if name not in self._icon_paths:
            pdf = spec_icon_pdf(name)
            if pdf is None:
                self._icon_paths[name] = None
            else:
                with fitz.open("pdf", pdf) as src:
                    page = src[0]
                    self._icon_paths[name] = (page.rect, tuple(page.get_drawings()))
        return self._icon_paths[name]

    def draw_icon(self, page: fitz.Page, name: str, rect: fitz.Rect) -> bool:
        """Draw spec icon ``name`` into ``rect``; False if there is no such icon."""
        icon = self.icon_paths(name)
        if icon is None:
            return False
        bounds, paths = icon
        scale = min(rect.width / bounds.width, rect.height / bounds.height)
        matrix = fitz.Matrix(scale, 0, 0, scale, rect.x0 - bounds.x0 * scale, rect.y0 - bounds.y0 * scale)
        shape = page.new_shape()
        for path in paths:
            for item in path["items"]:
                kind = item[0]
                if kind == "l":
                    shape.draw_line(item[1] * matrix, item[2] * matrix)
                elif kind == "c":
                    shape.draw_bezier(item[1] * matrix, item[2] * matrix, item[3] * matrix, item[4] * matrix)
                elif kind == "re":
                    shape.draw_rect(item[1] * matrix)
                elif kind == "qu":
                    shape.draw_quad(item[1] * matrix)
            shape.finish(
                fill=path.get("fill"),
                color=path.get("color"),
                even_odd=path.get("even_odd") or False,
                closePath=path.get("closePath") or False,
                width=(path.get("width") or 0) * scale,
            )
        shape.commit()
        return True


_shared: Optional[SharedAssets] = None


def shared_assets() -> SharedAssets:
    """The process-wide SharedAssets (call under the renderer's lock)."""
    global _shared
    if _shared is None:
        _shared = SharedAssets()
    return _shared
