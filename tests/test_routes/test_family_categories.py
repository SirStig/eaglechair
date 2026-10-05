"""
Product families listed under several categories / subcategories

ProductFamily.category_id / subcategory_id stay the primary assignment; the
family_categories / family_subcategories tables hold the full set. Admin
create/update store the sets, every read returns them (primary first), and
category filters match a family through any of its categories.
"""

import pytest
from sqlalchemy import select

from backend.models.chair import family_categories
from tests.factories import create_category, create_product_family, create_product_subcategory

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}


@pytest.fixture
def as_admin(async_client):
    from backend.api.dependencies import authenticate_admin
    from backend.models.company import AdminRole, AdminUser
    from tests.conftest import get_app

    app = get_app()
    admin = AdminUser(id=424245, username="family-admin", email="family@example.com",
                      role=AdminRole.ADMIN, is_active=True)
    app.dependency_overrides[authenticate_admin] = lambda: admin
    yield
    app.dependency_overrides.pop(authenticate_admin, None)


@pytest.mark.integration
@pytest.mark.admin
async def test_create_and_update_family_with_several_categories(async_client, db_session, as_admin):
    chairs = await create_category(db_session, name="Chairs")
    barstools = await create_category(db_session, name="Barstools")
    outdoor = await create_category(db_session, name="Outdoor")
    wood = await create_product_subcategory(db_session, category_id=chairs.id, name="Wood")
    metal = await create_product_subcategory(db_session, category_id=barstools.id, name="Metal")

    res = await async_client.post("/api/v1/admin/catalog/families", json={
        "name": "Berliner", "slug": "berliner",
        "category_id": chairs.id, "category_ids": [chairs.id, barstools.id],
        "subcategory_id": wood.id, "subcategory_ids": [wood.id, metal.id],
    }, headers=UA)
    assert res.status_code == 201, res.text
    family = res.json()
    assert family["category_ids"] == [chairs.id, barstools.id]
    assert family["subcategory_ids"] == [wood.id, metal.id]

    # Dropping the primary from the set promotes the first entry
    res = await async_client.put(f"/api/v1/admin/catalog/families/{family['id']}", json={
        "category_ids": [outdoor.id, barstools.id], "subcategory_ids": [],
    }, headers=UA)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["category_id"] == outdoor.id
    assert body["category_ids"] == [outdoor.id, barstools.id]
    assert body["subcategory_id"] is None and body["subcategory_ids"] == []

    # Admin list filters match an extra category too
    res = await async_client.get("/api/v1/admin/catalog/families", params={"category_id": barstools.id}, headers=UA)
    assert [f["id"] for f in res.json()] == [family["id"]]


@pytest.mark.integration
@pytest.mark.admin
async def test_move_to_category_swaps_primary_in_set(async_client, db_session, as_admin):
    a = await create_category(db_session)
    b = await create_category(db_session)
    extra = await create_category(db_session)
    fam = await create_product_family(db_session, category_id=a.id)
    await async_client.put(f"/api/v1/admin/catalog/families/{fam.id}",
                           json={"category_ids": [a.id, extra.id]}, headers=UA)

    # Bulk "Move to category" only sends category_id
    res = await async_client.put(f"/api/v1/admin/catalog/families/{fam.id}", json={"category_id": b.id}, headers=UA)
    assert res.status_code == 200, res.text
    assert sorted(res.json()["category_ids"]) == sorted([b.id, extra.id])
    assert res.json()["category_ids"][0] == b.id


@pytest.mark.integration
@pytest.mark.products
async def test_public_families_filter_matches_extra_category(async_client, db_session, as_admin):
    chairs = await create_category(db_session)
    barstools = await create_category(db_session)
    fam = await create_product_family(db_session, category_id=chairs.id, name="Avignon")
    await async_client.put(f"/api/v1/admin/catalog/families/{fam.id}",
                           json={"category_ids": [chairs.id, barstools.id]}, headers=UA)

    res = await async_client.get("/api/v1/families", params={"category_id": barstools.id}, headers=UA)
    assert res.status_code == 200, res.text
    match = [f for f in res.json() if f["id"] == fam.id]
    assert match and match[0]["category_ids"] == [chairs.id, barstools.id]


@pytest.mark.integration
async def test_startup_backfill_adds_primary_links(db_session):
    from backend.database.base import ensure_family_category_links

    cat = await create_category(db_session)
    fam = await create_product_family(db_session, category_id=cat.id)
    conn = await db_session.connection()
    assert await ensure_family_category_links(conn=conn) >= 1
    assert await ensure_family_category_links(conn=conn) == 0  # idempotent

    rows = (await db_session.execute(
        select(family_categories).where(family_categories.c.family_id == fam.id)
    )).all()
    assert [(r.family_id, r.category_id) for r in rows] == [(fam.id, cat.id)]
