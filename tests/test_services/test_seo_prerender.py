"""
SEO prerender: per-page shells, share cards and sitemap
(backend/services/seo_prerender.py).
"""

import json
import re

import pytest
from PIL import Image

from backend.services import og_image_service as og
from backend.services import seo_prerender as seo
from tests.factories import create_category, create_chair, create_product_family

TEMPLATE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!--seo:start-->
    <title data-rh="true">Default</title>
    <!--seo:end-->
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
"""


@pytest.fixture
def web_root(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / "index.html").write_text(TEMPLATE, encoding="utf-8")
    (root / seo.PAGES_FILE).write_text(json.dumps({"pages": [
        {"url": "/", "title": "Home | Eagle Chair", "description": "Home", "noindex": False},
        {"url": "/about", "title": "About Eagle Chair | Since 1984", "description": "About us", "noindex": False},
        {"url": "/cart", "title": "Quote Cart | Eagle Chair", "description": "Cart", "noindex": True},
    ]}), encoding="utf-8")
    uploads = tmp_path / "uploads"
    monkeypatch.setattr(seo, "web_root", lambda: root)
    monkeypatch.setattr(seo, "upload_root", lambda: uploads)
    # No disk/network images in tests: every source is a plain product shot
    monkeypatch.setattr(og, "load_source_image", lambda url, upload_dir: Image.new("RGB", (400, 700), (90, 60, 40)))
    return root


@pytest.fixture
async def catalog(db_session):
    seating = await create_category(db_session, name="Seating", slug="seating", description="")
    chairs = await create_category(db_session, parent_id=seating.id, name="Chairs", slug="chairs")
    family = await create_product_family(
        db_session, category_id=seating.id, name="Force 9", slug="force-9", description="",
    )
    chair = await create_chair(
        db_session,
        category_id=chairs.id,
        family_id=family.id,
        name="Force 9 Chair",
        model_number="3414",
        slug="model-3414",
        short_description="Steel frame side chair with padded seat",
        full_description="Steel frame side chair with padded seat.",
        seat_height=18.0,
        width=17.5,
        depth=21.0,
        height=34.0,
        stock_status="Made to Order",
        images=[{"url": "/uploads/images/products/3414.webp", "type": "main"}],
        primary_image_url="/uploads/images/products/3414.webp",
    )
    tricky = await create_chair(
        db_session,
        category_id=seating.id,
        name='Bistro "Classic" <Stool>',
        model_number="5324",
        slug="model-5324",
        short_description="</script><script>alert(1)</script>",
        images=[],
    )
    return {"seating": seating, "chairs": chairs, "family": family, "chair": chair, "tricky": tricky}


def _ld(html: str) -> list[dict]:
    return [
        json.loads(m)
        for m in re.findall(r'<script data-rh="true" type="application/ld\+json">(.*?)</script>', html)
    ]


async def _build(db_session) -> dict:
    snapshot = await seo.load_snapshot(db_session)
    return seo.build_all(snapshot)


class TestPaths:
    def test_product_path_matches_frontend_rule(self):
        cat = {"slug": "chairs", "parent_slug": "seating"}
        assert seo.product_path({"id": 1, "slug": "model-1", "category": cat}) == "/products/seating/chairs/model-1"
        top = {"slug": "tables", "parent_slug": None}
        assert seo.product_path({"id": 2, "slug": "t", "category": top}) == "/products/tables/uncategorized/t"
        assert seo.product_path({"id": 3, "slug": None, "category": None}) == "/products/3"

    def test_category_path(self):
        assert seo.category_path({"slug": "chairs", "parent_slug": "seating"}) == "/products/category/seating/chairs"
        assert seo.category_path({"slug": "seating", "parent_slug": None}) == "/products/category/seating"

    def test_truncate_cuts_at_word_boundary(self):
        out = seo.truncate(("word " * 60).strip(), 40)
        assert len(out) <= 40 and out.endswith("…") and not out.endswith(" …")

    def test_compose_title_drops_trailing_parts_to_fit(self):
        assert seo.compose_title("Chair", "Chairs") == "Chair | Chairs | Eagle Chair"
        long = seo.compose_title("A Very Long Product Name, Model 1234ABC", "Restaurant Chairs And Seating")
        assert long == "A Very Long Product Name, Model 1234ABC | Eagle Chair"


class TestBuild:
    async def test_product_shell_has_meta_card_and_json_ld(self, db_session, web_root, catalog):
        stats = await _build(db_session)
        assert stats["pages"] >= 6

        html = (web_root / "_seo/products/seating/chairs/model-3414/index.html").read_text(encoding="utf-8")
        assert '<title data-rh="true">Force 9 Chair, Model 3414 | Chairs | Eagle Chair</title>' in html
        assert (
            '<link data-rh="true" rel="canonical" '
            'href="https://www.eaglechair.com/products/seating/chairs/model-3414"/>'
        ) in html
        assert 'property="og:type" content="product"' in html
        # Share card: stable name + content hash, on the media host
        image = re.search(r'property="og:image" content="([^"]+)"', html).group(1)
        assert image.startswith("https://joshua.eaglechair.com/uploads/og/product/model-3414.jpg?v=")
        with Image.open(web_root.parent / "uploads/og/product/model-3414.jpg") as card:
            assert card.size == (og.CARD_W, og.CARD_H)

        product, crumbs = _ld(html)
        assert product["@type"] == "Product"
        assert product["sku"] == product["mpn"] == "3414"
        assert product["brand"]["name"] == "Eagle Chair"
        assert product["height"] == {"@type": "QuantitativeValue", "value": 34.0, "unitCode": "INH"}
        assert {"@type": "PropertyValue", "name": "Seat height", "value": 18.0, "unitCode": "INH"} in product["additionalProperty"]
        assert product["isRelatedTo"]["url"] == "https://www.eaglechair.com/families/force-9"
        assert "offers" not in product  # quote-only catalog: no prices
        assert [i["name"] for i in crumbs["itemListElement"]] == ["Home", "Products", "Seating", "Chairs", "Force 9 Chair"]

        # Crawlable content for bots that don't run JS, outside #root
        assert html.index('<noscript><main class="seo-fallback">') < html.index('<div id="root">')
        assert "<dt>Seat height</dt><dd>18&quot;</dd>" in html

    async def test_escapes_catalog_text(self, db_session, web_root, catalog):
        await _build(db_session)
        html = (web_root / "_seo/products/seating/uncategorized/model-5324/index.html").read_text(encoding="utf-8")
        assert "<script>alert(1)" not in html
        assert "<Stool>" not in html  # tag-like text is stripped
        assert "Bistro &quot;Classic&quot;, Model 5324 | Seating | Eagle Chair" in html
        # "</script>" in product text can't close the JSON-LD element early
        assert len(_ld(html)) == 2

    async def test_family_and_category_pages(self, db_session, web_root, catalog):
        await _build(db_session)
        family = (web_root / "_seo/families/force-9/index.html").read_text(encoding="utf-8")
        assert "Force 9 Collection" in family
        collection = _ld(family)[0]
        assert collection["@type"] == "CollectionPage"
        assert collection["mainEntity"]["itemListElement"][0]["url"].endswith("/products/seating/chairs/model-3414")
        assert (web_root.parent / "uploads/og/family/force-9.jpg").is_file()

        # A parent category lists its subcategory's products too
        parent = (web_root / "_seo/products/category/seating/index.html").read_text(encoding="utf-8")
        assert "/products/seating/chairs/model-3414" in parent
        assert (web_root / "_seo/products/category/seating/chairs/index.html").is_file()

    async def test_static_pages_and_noindex(self, db_session, web_root, catalog):
        await _build(db_session)
        about = (web_root / "_seo/about/index.html").read_text(encoding="utf-8")
        assert "uploads/og/page/about.jpg?v=" in about
        cart = (web_root / "_seo/cart/index.html").read_text(encoding="utf-8")
        assert 'name="robots" content="noindex, follow"' in cart
        assert not (web_root / "_seo/index.html").exists()  # home keeps index.html

    async def test_sitemap_uses_canonical_urls_and_images(self, db_session, web_root, catalog):
        await _build(db_session)
        xml = (web_root / "sitemap.xml").read_text(encoding="utf-8")
        assert "<loc>https://www.eaglechair.com/products/seating/chairs/model-3414</loc>" in xml
        assert "<image:loc>https://joshua.eaglechair.com/uploads/images/products/3414.webp</image:loc>" in xml
        assert "<loc>https://www.eaglechair.com/about</loc>" in xml
        assert "/cart" not in xml

    async def test_unchanged_cards_are_reused_and_stale_ones_pruned(self, db_session, web_root, catalog):
        assert (await _build(db_session))["cards_rendered"] > 0
        assert (await _build(db_session))["cards_rendered"] == 0

        stale = web_root.parent / "uploads/og/product/removed-product.jpg"
        stale.write_bytes(b"x")
        manifest = web_root.parent / "uploads/og/manifest.json"
        data = json.loads(manifest.read_text())
        data["product/removed-product"] = "deadbeef"
        manifest.write_text(json.dumps(data))
        await _build(db_session)
        assert not stale.exists()

    async def test_skips_without_seo_markers(self, db_session, web_root, catalog):
        (web_root / "index.html").write_text("<html><head></head><body></body></html>")
        snapshot = await seo.load_snapshot(db_session)
        assert seo.build_all(snapshot) == {"pages": 0}
        assert not (web_root / "_seo").exists()


class TestSitemapRoute:
    async def test_sitemap_endpoint(self, async_client, catalog):
        response = await async_client.get("/api/v1/seo/sitemap.xml")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/xml")
        assert "/products/seating/chairs/model-3414" in response.text
