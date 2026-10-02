"""
Build the catalog template layers from Eagle Chair's own catalog PDFs.

The catalog generator (backend/services/catalog_pdf/) stamps these layers onto
every page so exported catalogs match the printed ones: the gradient
backgrounds, the eagle logo, the rounded text panels and the emblems are taken
directly from the 2024/2026 catalog sheets (vector paths are redrawn as
vectors, background photos keep their original resolution).

Source PDFs live on EagleServer (EagleCatalog/catalog pages). Re-run this only
when the brand template changes:

    python -m backend.scripts.build_catalog_template "/path/to/EagleCatalog/catalog pages"

Writes backend/assets/catalog_template/template.pdf, one layer per page in the
order of LAYERS, and copies the spec icons from the frontend.
"""

import shutil
import sys
from pathlib import Path

import fitz

ASSET_DIR = Path(__file__).resolve().parents[1] / "assets" / "catalog_template"
SPEC_ICON_SRC = Path(__file__).resolve().parents[2] / "frontend" / "src" / "assets" / "spec-icons"

SPEC_SHEET = "cat.3506-4506.Lobo.2026.pdf"  # page 0: spec page, page 2: gallery page
GALLERY_SHEET = "cat.3721-4721.Voda.2024..pdf"  # page 4: "Made in USA" emblem

# Layer names, in template.pdf page order (keep in sync with catalog_pdf/assets.py)
LAYERS = (
    "bg_spec",
    "bg_gallery",
    "logo",
    "spec_panel",
    "banner_panel",
    "flag_emblem",
    "made_in_usa",
)


def _redraw(paths, page) -> None:
    """Redraw get_drawings() paths onto ``page`` at their original positions."""
    for path in paths:
        shape = page.new_shape()
        for item in path["items"]:
            kind = item[0]
            if kind == "l":
                shape.draw_line(item[1], item[2])
            elif kind == "c":
                shape.draw_bezier(item[1], item[2], item[3], item[4])
            elif kind == "re":
                shape.draw_rect(item[1])
            elif kind == "qu":
                shape.draw_quad(item[1])
        line_cap = path.get("lineCap")
        shape.finish(
            fill=path.get("fill"),
            color=path.get("color"),
            even_odd=path.get("even_odd") or False,
            closePath=path.get("closePath") or False,
            width=path.get("width") or 0,
            fill_opacity=path.get("fill_opacity") or 1,
            stroke_opacity=path.get("stroke_opacity") or 1,
            lineCap=max(line_cap) if line_cap else 0,
            lineJoin=path.get("lineJoin") or 0,
        )
        shape.commit()


def _images(page, predicate):
    """(xref, smask, rect) for each image on ``page`` whose rect matches."""
    found = []
    for img in page.get_images(full=True):
        rects = page.get_image_rects(img[0])
        if rects and predicate(rects[0]):
            found.append((img[0], img[1], rects[0]))
    return found


def _pixmap(src_doc, xref, smask) -> fitz.Pixmap:
    """The image as RGB(A); its soft mask becomes the alpha channel."""
    pix = fitz.Pixmap(src_doc, xref)
    if pix.colorspace and pix.colorspace.n != 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    if smask:
        pix = fitz.Pixmap(pix, fitz.Pixmap(src_doc, smask))
    return pix


def _insert(src_doc, images, out_page, origin=(0.0, 0.0)) -> None:
    """Re-insert images (with their soft masks), shifted by -origin."""
    ox, oy = origin
    for xref, smask, rect in images:
        out_page.insert_image(rect - (ox, oy, ox, oy), pixmap=_pixmap(src_doc, xref, smask))


def _flattened_layer(out, src_doc, images, width, height, dpi=300) -> None:
    """A full-page layer: the images composited onto white as one JPEG."""
    scratch = fitz.open()
    page = scratch.new_page(width=width, height=height)
    _insert(src_doc, images, page)
    jpeg = page.get_pixmap(dpi=dpi).tobytes("jpeg", jpg_quality=90)
    out.new_page(width=width, height=height).insert_image(fitz.Rect(0, 0, width, height), stream=jpeg)


def _cropped_layer(out, src_doc, images) -> None:
    """A layer sized to the images' bounding box."""
    box = fitz.Rect()
    for _, _, rect in images:
        box.include_rect(rect)
    layer = out.new_page(width=box.width, height=box.height)
    _insert(src_doc, images, layer, (box.x0, box.y0))


def build(source_dir: Path) -> Path:
    spec_doc = fitz.open(source_dir / SPEC_SHEET)
    gallery_doc = fitz.open(source_dir / GALLERY_SHEET)
    spec_page, gallery_page = spec_doc[0], spec_doc[2]
    width, height = spec_page.rect.width, spec_page.rect.height

    out = fitz.open()

    # bg_spec / bg_gallery: the gradient photo halves of each page type, flattened
    for page in (spec_page, gallery_page):
        _flattened_layer(out, spec_doc, _images(page, lambda r: r.width >= width - 1), width, height)

    spec_paths = spec_page.get_drawings()

    # logo: the black eagle top-left, kept at its page position
    layer = out.new_page(width=width, height=height)
    _redraw([p for p in spec_paths if p["rect"].y1 < 45 and p["rect"].x0 < 100], layer)

    # spec_panel: rounded white text panel plus the brown eagle in its corner
    layer = out.new_page(width=width, height=height)
    _redraw([p for p in spec_paths if p["rect"].y0 >= 600 and p["rect"].x0 >= 20], layer)

    # banner_panel: the gallery page's tagline banner plus its eagle
    layer = out.new_page(width=width, height=height)
    _redraw([p for p in gallery_page.get_drawings() if p["rect"].y0 >= 720], layer)

    # flag_emblem: the stars-and-stripes eagle
    _cropped_layer(
        out, spec_doc, _images(spec_page, lambda r: r.width < 80 and r.y0 > 500 and r.x0 > 150)
    )

    # made_in_usa: flag eagle with the "Made in USA" lettering under it
    _cropped_layer(
        out, gallery_doc, _images(gallery_doc[4], lambda r: r.x0 < 20 and r.y0 > 600 and r.width < 80)
    )

    assert len(out) == len(LAYERS), f"expected {len(LAYERS)} layers, built {len(out)}"
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    target = ASSET_DIR / "template.pdf"
    out.save(target, garbage=4, deflate=True)

    icon_dir = ASSET_DIR / "spec-icons"
    icon_dir.mkdir(exist_ok=True)
    for svg in SPEC_ICON_SRC.glob("*.svg"):
        shutil.copy2(svg, icon_dir / svg.name)
    return target


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(f"Wrote {build(Path(sys.argv[1]))}")
