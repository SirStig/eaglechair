"""
Catalog PDF photos: white backgrounds become transparent

Product photos shot on pure white would print as white boxes on the grey
catalog background; the loader removes white that touches the photo's edge
and keeps white inside the product.
"""

import pytest
from PIL import Image, ImageDraw

from backend.services.catalog_pdf.images import ImageLoader, remove_white_background

pytestmark = pytest.mark.unit


def _chair_on_white(size=(600, 800)) -> Image.Image:
    """A dark frame with a white seat inside it, on a pure white background."""
    img = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle((150, 150, 450, 650), outline=(40, 30, 30), width=12)  # frame
    draw.rectangle((162, 162, 438, 638), fill=(255, 255, 255))  # white seat, enclosed
    draw.line((200, 650, 200, 780), fill=(40, 30, 30), width=3)  # thin leg
    return img


def test_white_background_becomes_transparent_but_product_stays():
    out = remove_white_background(_chair_on_white())
    assert out.mode == "RGBA"
    alpha = out.getchannel("A")
    assert alpha.getpixel((5, 5)) == 0  # corner background
    assert alpha.getpixel((300, 720)) == 0  # background between the legs
    assert alpha.getpixel((150, 400)) == 255  # frame
    assert alpha.getpixel((300, 400)) == 255  # white seat inside the frame is kept
    assert alpha.getpixel((200, 720)) > 0  # thin leg survives


def test_photo_without_white_border_is_untouched():
    photo = Image.new("RGB", (400, 300), (120, 140, 160))
    assert remove_white_background(photo) is photo


def test_loader_cuts_out_product_photos_but_not_install_photos(tmp_path):
    folder = tmp_path / "images" / "products"
    folder.mkdir(parents=True)
    _chair_on_white().save(folder / "chair.jpg", quality=95)
    loader = ImageLoader(tmp_path, max_px=800)
    url = "/uploads/images/products/chair.jpg"

    product = loader.load(url)
    assert product.data.startswith(b"\x89PNG")  # has transparency now
    # Trimmed to the visible chair (the frame and leg), not the whole white canvas
    assert product.width < 600 and product.height < 800

    install = loader.load(url, cutout=False)
    assert install.data.startswith(b"\xff\xd8")  # unchanged JPEG photo
    assert (install.width, install.height) == (600, 800)
