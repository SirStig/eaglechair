"""
Unit Tests for Media Service

Covers full-resolution storage, progressive renditions and cleanup.
"""

import io

import pytest
from PIL import Image

from backend.services import media_service

pytestmark = pytest.mark.unit


def _jpeg_bytes(size=(3000, 2000), mode="RGB", exif_orientation=None):
    img = Image.new(mode, size, (200, 30, 30) if mode == "RGB" else (0, 128, 255, 0))
    buf = io.BytesIO()
    kwargs = {}
    if exif_orientation:
        exif = img.getexif()
        exif[0x0112] = exif_orientation
        kwargs["exif"] = exif
    img.save(buf, format="JPEG", **kwargs)
    return buf.getvalue()


def test_original_is_kept_byte_for_byte_at_full_resolution(tmp_path):
    content = _jpeg_bytes(size=(5000, 3000))
    path, size = media_service.store_image(content, tmp_path, "chair_1_abc123", ".jpg")

    assert path.name == "chair_1_abc123.jpg"
    assert path.read_bytes() == content
    assert size == len(content)


def test_renditions_ladder_is_written(tmp_path):
    path, _ = media_service.store_image(_jpeg_bytes(size=(5000, 3000)), tmp_path, "chair", ".jpg")

    with Image.open(media_service.placeholder_path(path)) as ph:
        assert ph.width == media_service.PLACEHOLDER_WIDTH
    for width in media_service.VARIANT_WIDTHS:
        with Image.open(media_service.variant_path(path, width)) as variant:
            assert variant.format == "WEBP"
            assert variant.width == width
    with Image.open(media_service.full_path(path)) as full:
        assert full.format == "WEBP"
        assert full.size == (5000, 3000)


def test_webp_original_is_its_own_full_rendition(tmp_path):
    buf = io.BytesIO()
    Image.new("RGB", (1200, 800), (1, 2, 3)).save(buf, format="WEBP")
    path, _ = media_service.store_image(buf.getvalue(), tmp_path, "photo", ".webp")

    assert media_service.full_path(path) == path
    assert not (tmp_path / "photo.full.webp").exists()
    assert (tmp_path / "photo.w640.webp").exists()


def test_small_source_still_gets_every_name_without_upscaling(tmp_path):
    path, _ = media_service.store_image(_jpeg_bytes(size=(500, 300)), tmp_path, "small", ".jpg")

    for width in media_service.VARIANT_WIDTHS:
        with Image.open(media_service.variant_path(path, width)) as variant:
            assert variant.width == min(width, 500)


def test_exif_orientation_and_cmyk_are_normalized_in_renditions(tmp_path):
    rotated, _ = media_service.store_image(_jpeg_bytes(size=(400, 200), exif_orientation=6), tmp_path, "rot", ".jpg")
    with Image.open(media_service.full_path(rotated)) as img:
        assert img.size == (200, 400)

    cmyk, _ = media_service.store_image(_jpeg_bytes(size=(400, 200), mode="CMYK"), tmp_path, "cmyk", ".jpg")
    with Image.open(media_service.variant_path(cmyk, 320)) as img:
        assert img.mode in ("RGB", "RGBA")


def test_non_web_formats_are_converted_at_full_resolution(tmp_path):
    buf = io.BytesIO()
    Image.new("RGB", (3000, 2000), (9, 9, 9)).save(buf, format="TIFF")
    path, _ = media_service.store_image(buf.getvalue(), tmp_path, "scan", ".tif")

    assert path.suffix == ".jpg"
    with Image.open(path) as img:
        assert img.size == (3000, 2000)


def test_undecodable_and_vector_files_are_stored_untouched(tmp_path):
    broken, _ = media_service.store_image(b"\xff\xd8\xffnot-a-jpeg", tmp_path, "broken", ".jpg")
    assert broken.name == "broken.jpg"
    assert broken.read_bytes() == b"\xff\xd8\xffnot-a-jpeg"

    svg = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
    path, _ = media_service.store_image(svg, tmp_path, "icon", ".svg")
    assert path.read_bytes() == svg
    assert not any(tmp_path.glob("icon.*.webp"))


def test_write_variants_is_idempotent_and_delete_removes_everything(tmp_path):
    source = tmp_path / "legacy.jpg"
    source.write_bytes(_jpeg_bytes(size=(1200, 800)))

    assert media_service.write_variants(source) == len(media_service.variant_paths(source))
    assert media_service.write_variants(source) == 0  # up to date

    media_service.delete_image_files(source)
    assert list(tmp_path.iterdir()) == []


def test_is_variant_path():
    assert media_service.is_variant_path("a/b/foo.w640.webp")
    assert media_service.is_variant_path("a/b/foo.w32.webp")
    assert media_service.is_variant_path("a/b/foo.full.webp")
    assert not media_service.is_variant_path("a/b/foo.webp")
    assert not media_service.is_variant_path("a/b/foo.w640.jpg")
