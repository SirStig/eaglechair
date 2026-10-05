"""
Admin bulk edit (POST /admin/bulk/{resource}) and product option group switches
"""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models.chair import Chair, ProductVariation, variation_families
from backend.models.company import AdminRole, AdminUser
from backend.models.content import Catalog, CatalogType
from tests.factories import (
    create_catalog,
    create_category,
    create_chair,
    create_color,
    create_product_family,
    create_product_variation,
)

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}
BASE = "/api/v1/admin/bulk"


@pytest.fixture
def as_role():
    from backend.api.dependencies import get_current_admin
    from tests.conftest import get_app

    app = get_app()

    def _set(role=AdminRole.ADMIN):
        admin = AdminUser(id=626262, username=f"bulk-{role.value}", email="bulk@example.com", role=role, is_active=True)
        app.dependency_overrides[get_current_admin] = lambda: admin

    yield _set
    app.dependency_overrides.pop(get_current_admin, None)


async def _product(db_session, product_id):
    """Fresh product with its category and family assignments loaded"""
    result = await db_session.execute(
        select(Chair)
        .where(Chair.id == product_id)
        .options(selectinload(Chair.categories), selectinload(Chair.secondary_families))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _reload(db_session, model, row_id):
    row = await db_session.get(model, row_id)
    await db_session.refresh(row)
    return row


@pytest.mark.integration
@pytest.mark.admin
class TestBulkEdit:
    async def test_move_line_sheets_to_catalogs(self, async_client, as_role, db_session):
        as_role()
        sheets = [await create_catalog(db_session, catalog_type=CatalogType.PRODUCT_LINE) for _ in range(2)]
        response = await async_client.post(
            f"{BASE}/catalogs",
            json={"ids": [s.id for s in sheets] + [999999], "changes": {"catalog_type": "full_catalog"}},
            headers=UA,
        )
        assert response.status_code == 200, response.text
        assert response.json() == {"updated": 2, "missing": [999999]}
        for sheet in sheets:
            assert (await _reload(db_session, Catalog, sheet.id)).catalog_type == CatalogType.FULL_CATALOG

    async def test_rejects_bad_values_and_fields(self, async_client, as_role, db_session):
        as_role()
        catalog = await create_catalog(db_session)
        bad_enum = await async_client.post(
            f"{BASE}/catalogs", json={"ids": [catalog.id], "changes": {"catalog_type": "nope"}}, headers=UA
        )
        assert bad_enum.status_code == 400
        not_allowed = await async_client.post(
            f"{BASE}/catalogs", json={"ids": [catalog.id], "changes": {"file_url": "/x.pdf"}}, headers=UA
        )
        assert not_allowed.status_code == 400
        bad_fk = await async_client.post(
            f"{BASE}/catalogs", json={"ids": [catalog.id], "changes": {"category_id": 999999}}, headers=UA
        )
        assert bad_fk.status_code == 400
        unknown = await async_client.post(f"{BASE}/nope", json={"ids": [1], "changes": {"is_active": True}}, headers=UA)
        assert unknown.status_code == 404

    async def test_requires_admin_role(self, async_client, as_role, db_session):
        as_role(AdminRole.EDITOR)
        catalog = await create_catalog(db_session)
        response = await async_client.post(
            f"{BASE}/catalogs", json={"ids": [catalog.id], "changes": {"is_active": False}}, headers=UA
        )
        assert response.status_code == 403

    async def test_move_products_to_category(self, async_client, as_role, db_session):
        as_role()
        old, new, extra = [await create_category(db_session) for _ in range(3)]
        product = await create_chair(db_session, category_id=old.id)
        await async_client.post(
            f"{BASE}/products", json={"ids": [product.id], "changes": {"add_category_id": extra.id}}, headers=UA
        )
        response = await async_client.post(
            f"{BASE}/products", json={"ids": [product.id], "changes": {"category_id": new.id}}, headers=UA
        )
        assert response.status_code == 200, response.text
        product = await _product(db_session, product.id)
        assert product.category_id == new.id
        assert {c.id for c in product.categories} == {new.id, extra.id}

    async def test_products_add_and_remove_family(self, async_client, as_role, db_session):
        as_role()
        category = await create_category(db_session)
        main, other = [await create_product_family(db_session, category_id=category.id) for _ in range(2)]
        orphan = await create_chair(db_session, category_id=category.id)
        member = await create_chair(db_session, category_id=category.id, family_id=main.id)
        ids = [orphan.id, member.id]
        main_id, other_id = main.id, other.id

        added = await async_client.post(f"{BASE}/products", json={"ids": ids, "changes": {"add_family_id": other_id}}, headers=UA)
        assert added.status_code == 200, added.text
        orphan = await _product(db_session, ids[0])
        member = await _product(db_session, ids[1])
        assert orphan.family_id == other_id
        assert member.family_id == main_id
        assert [f.id for f in member.secondary_families] == [other_id]

        removed = await async_client.post(f"{BASE}/products", json={"ids": ids, "changes": {"remove_family_id": main_id}}, headers=UA)
        assert removed.status_code == 200, removed.text
        member = await _product(db_session, ids[1])
        assert member.family_id == other_id
        assert member.secondary_families == []

    async def test_products_option_list_ops_and_switches(self, async_client, as_role, db_session):
        as_role()
        red, blue = await create_color(db_session), await create_color(db_session)
        product = await create_chair(db_session, available_colors=[red.id])
        response = await async_client.post(
            f"{BASE}/products",
            json={"ids": [product.id], "changes": {"add_colors": [blue.id], "remove_colors": [red.id], "laminates_enabled": False}},
            headers=UA,
        )
        assert response.status_code == 200, response.text
        product = await _reload(db_session, Chair, product.id)
        assert product.available_colors == [blue.id]
        assert product.laminates_enabled is False

    async def test_variations_switches_and_family(self, async_client, as_role, db_session):
        as_role()
        product = await create_chair(db_session)
        family = await create_product_family(db_session)
        variations = [await create_product_variation(db_session, product.id) for _ in range(2)]
        ids = [v.id for v in variations]
        response = await async_client.post(
            f"{BASE}/variations",
            json={"ids": ids, "changes": {"upholstery_enabled": False, "add_family_id": family.id}},
            headers=UA,
        )
        assert response.status_code == 200, response.text
        for variation_id in ids:
            assert (await _reload(db_session, ProductVariation, variation_id)).upholstery_enabled is False
        linked = await db_session.execute(
            select(variation_families.c.variation_id).where(variation_families.c.family_id == family.id)
        )
        assert sorted(linked.scalars().all()) == sorted(ids)

        # Inherit again
        reset = await async_client.post(
            f"{BASE}/variations", json={"ids": ids, "changes": {"upholstery_enabled": None}}, headers=UA
        )
        assert reset.status_code == 200
        assert (await _reload(db_session, ProductVariation, ids[0])).upholstery_enabled is None


@pytest.mark.integration
@pytest.mark.products
class TestOptionGroupSwitches:
    async def test_list_hides_switched_off_groups_but_detail_keeps_them(self, async_client, db_session):
        color = await create_color(db_session)
        product = await create_chair(db_session, available_colors=[color.id], colors_enabled=False)

        listing = await async_client.get("/api/v1/products", params={"limit": 50}, headers=UA)
        assert listing.status_code == 200, listing.text
        items = listing.json().get("items") or listing.json().get("products") or []
        row = next(p for p in items if p["id"] == product.id)
        assert "colors" not in (row.get("customizations") or {})

        detail = await async_client.get(f"/api/v1/products/{product.id}", headers=UA)
        assert detail.status_code == 200, detail.text
        body = detail.json()
        assert body["colors_enabled"] is False
        assert [c["id"] for c in body["customizations"]["colors"]] == [color.id]
