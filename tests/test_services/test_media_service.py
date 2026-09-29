"""
Unit Tests for Media Service

Covers WebP encoding, responsive variant generation and cleanup.
"""

import io

import pytest
from PIL import Image

from backend.services import media_service

pytestmark = pytest.mark.unit


def _jpeg_bytes(size=(3000, 2000), mode="RGB", color=(200, 30, 30), exif_orientation=None):
    img = Image.new(mode, size, color if mode == "RGB" else (0, 128, 255, 0))
    buf = io.BytesIO()
    kwargs = {}
    if exif_orientation:
        exif = img.getexif()
        exif[0x0112] = exif_orientation
        kwargs["exif"] = exif
    img.save(buf, format="JPEG", **kwargs)
    return buf.getvalue()


def test_store_image_writes_master_and_all_variants(tmp_path):
    path, size = media_service.store_image(_jpeg_bytes(), tmp_path, "chair_1_abc123", ".jpg")

    assert path.name == "chair_1_abc123.webp"
    assert size == path.stat().st_size
    with Image.open(path) as master:
        assert master.format == "WEBP"
        assert max(master.size) == media_service.MAX_IMAGE_DIMENSION
    for width in media_service.VARIANT_WIDTHS:
        with Image.open(tmp_path / f"chair_1_abc123.w{width}.webp") as variant:
            assert variant.width == width


def test_small_source_still_gets_every_variant_name_without_upscaling(tmp_path):
    path, _ = media_service.store_image(_jpeg_bytes(size=(500, 300)), tmp_path, "small", ".jpg")

    for width in media_service.VARIANT_WIDTHS:
        with Image.open(media_service.variant_path(path, width)) as variant:
            assert variant.width == min(width, 500)


def test_exif_orientation_and_cmyk_are_normalized(tmp_path):
    rotated, _ = media_service.store_image(_jpeg_bytes(size=(400, 200), exif_orientation=6), tmp_path, "rot", ".jpg")
    with Image.open(rotated) as img:
        assert img.size == (200, 400)

    cmyk, _ = media_service.store_image(_jpeg_bytes(size=(400, 200), mode="CMYK"), tmp_path, "cmyk", ".jpg")
    with Image.open(cmyk) as img:
        assert img.mode in ("RGB", "RGBA")


def test_undecodable_and_vector_files_are_stored_untouched(tmp_path):
    broken, _ = media_service.store_image(b"\xff\xd8\xffnot-a-jpeg", tmp_path, "broken", ".jpg")
    assert broken.name == "broken.jpg"
    assert broken.read_bytes() == b"\xff\xd8\xffnot-a-jpeg"

    svg = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
    path, _ = media_service.store_image(svg, tmp_path, "icon", ".svg")
    assert path.read_bytes() == svg
    assert not any(tmp_path.glob("icon.w*.webp"))


def test_write_variants_is_idempotent_and_delete_removes_variants(tmp_path):
    source = tmp_path / "legacy.jpg"
    source.write_bytes(_jpeg_bytes(size=(1200, 800)))

    assert media_service.write_variants(source) == len(media_service.VARIANT_WIDTHS)
    assert media_service.write_variants(source) == 0  # up to date

    media_service.delete_image_files(source)
    assert list(tmp_path.iterdir()) == []


def test_is_variant_path():
    assert media_service.is_variant_path("a/b/foo.w640.webp")
    assert not media_service.is_variant_path("a/b/foo.webp")
    assert not media_service.is_variant_path("a/b/foo.w640.jpg")
