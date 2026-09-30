"""
Test Image Renditions in Public API Responses

Image fields come back with a sibling `*_renditions` object so API clients
(the mobile app) get every stored size without rebuilding URLs themselves.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import (
    create_category,
    create_chair,
    create_finish,
    create_product_family,
    create_upholstery,
)

pytestmark = [pytest.mark.integration, pytest.mark.products]

PRIMARY = "/uploads/images/products/chair_1_ab12cd.jpg"
HOVER = "/uploads/images/products/chair_1_front.png"
LEGACY = "https://www.eaglechair.com/wp-content/uploads/2020/01/old.jpg"


def _assert_renditions(r, original):
    base = original.rsplit(".", 1)[0]
    assert r["original"] == original
    assert r["placeholder"] == f"{base}.w32.webp"
    assert [s["width"] for s in r["sizes"]] == [320, 640, 1024, 1600, 2400]
    assert r["sizes"][1]["url"] == f"{base}.w640.webp"
    assert r["full"] == f"{base}.full.webp"


@pytest.mark.asyncio
async def test_product_detail_includes_renditions(async_client: AsyncClient, db_session: AsyncSession):
    product = await create_chair(
        db_session,
        primary_image_url=PRIMARY,
        hover_images=[HOVER, LEGACY],
        images=[{"url": PRIMARY, "type": "side"}],
    )

    response = await async_client.get(f"/api/v1/products/{product.id}")
    assert response.status_code == 200
    data = response.json()

    # Existing fields are untouched
    assert data["primary_image_url"] == PRIMARY
    assert data["hover_images"] == [HOVER, LEGACY]

    _assert_renditions(data["primary_image_renditions"], PRIMARY)
    _assert_renditions(data["images_renditions"][0], PRIMARY)
    # Index-aligned with hover_images; legacy URLs come back as original only
    _assert_renditions(data["hover_images_renditions"][0], HOVER)
    assert data["hover_images_renditions"][1] == {
        "original": LEGACY,
        "placeholder": None,
        "sizes": [],
        "full": None,
    }
    assert data["thumbnail_renditions"] is None


@pytest.mark.asyncio
async def test_product_list_includes_renditions(async_client: AsyncClient, db_session: AsyncSession):
    await create_chair(db_session, primary_image_url=PRIMARY)

    response = await async_client.get("/api/v1/products")
    assert response.status_code == 200
    item = next(p for p in response.json()["items"] if p["primary_image_url"] == PRIMARY)
    _assert_renditions(item["primary_image_renditions"], PRIMARY)


@pytest.mark.asyncio
async def test_family_and_members_include_renditions(async_client: AsyncClient, db_session: AsyncSession):
    category = await create_category(db_session)
    family_image = "/uploads/images/families/series.jpg"
    family = await create_product_family(
        db_session, category_id=category.id, family_image=family_image
    )
    await create_chair(
        db_session,
        category_id=category.id,
        family_id=family.id,
        primary_image_url=PRIMARY,
        hover_images=[HOVER],
    )

    response = await async_client.get(f"/api/v1/families/{family.id}")
    assert response.status_code == 200
    _assert_renditions(response.json()["family_image_renditions"], family_image)

    response = await async_client.get(f"/api/v1/families/{family.id}/members")
    assert response.status_code == 200
    member = response.json()[0]
    _assert_renditions(member["primary_image_renditions"], PRIMARY)
    _assert_renditions(member["hover_images_renditions"][0], HOVER)


@pytest.mark.asyncio
async def test_finish_and_upholstery_include_renditions(async_client: AsyncClient, db_session: AsyncSession):
    finish_image = "/uploads/images/finishes/walnut.jpg"
    swatch = "/uploads/images/upholstery/navy_swatch.jpg"
    await create_finish(db_session, image_url=finish_image)
    await create_upholstery(db_session, swatch_image_url=swatch)

    response = await async_client.get("/api/v1/finishes")
    assert response.status_code == 200
    finish = next(f for f in response.json() if f["image_url"] == finish_image)
    _assert_renditions(finish["image_renditions"], finish_image)

    response = await async_client.get("/api/v1/upholsteries")
    assert response.status_code == 200
    upholstery = next(u for u in response.json() if u["swatch_image_url"] == swatch)
    _assert_renditions(upholstery["swatch_image_renditions"], swatch)
