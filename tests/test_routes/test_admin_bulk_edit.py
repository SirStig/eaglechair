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
    create_quote,
    create_quote_item,
)

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}
BASE = "/api/v1/admin/bulk"


@pytest.fixture
def as_role():
    from backend.api.dependencies import authenticate_admin
    from tests.conftest import get_app

    app = get_app()

    def _set(role=AdminRole.ADMIN):
        admin = AdminUser(id=626262, username=f"bulk-{role.value}", email="bulk@example.com", role=role, is_active=True)
        app.dependency_overrides[authenticate_admin] = lambda: admin

    # Step-up identity confirmation (permanent deletes) has its own tests
    from backend.services.admin_confirmation import require_recent_confirmation

    app.dependency_overrides[require_recent_confirmation] = lambda: None
    yield _set
    app.dependency_overrides.pop(authenticate_admin, None)
    app.dependency_overrides.pop(require_recent_confirmation, None)


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

    def test_permission_policy(self):
        """Checked centrally in get_current_admin (overridden in these tests), so assert the policy itself"""
        from backend.core.admin_permissions import Permission, missing_permissions

        viewer = AdminUser(id=1, username="v", role=AdminRole.VIEWER, permissions=None, is_active=True)
        editor = AdminUser(id=2, username="e", role=AdminRole.EDITOR, permissions=None, is_active=True)
        admin = AdminUser(id=3, username="a", role=AdminRole.ADMIN, permissions=None, is_active=True)

        assert Permission.EDIT_CATALOG in missing_permissions(viewer, "POST", "/api/v1/admin/bulk/catalogs")
        assert not missing_permissions(editor, "POST", "/api/v1/admin/bulk/catalogs")
        assert not missing_permissions(editor, "POST", "/api/v1/admin/material-sources")
        assert Permission.EDIT_SALES in missing_permissions(
            AdminUser(id=4, username="c", role=AdminRole.EDITOR, permissions=["edit_catalog"], is_active=True),
            "POST",
            "/api/v1/admin/bulk/quotes",
        )
        assert Permission.PERMANENT_DELETE in missing_permissions(admin, "POST", "/api/v1/admin/bulk/catalogs/delete")

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


@pytest.mark.integration
@pytest.mark.admin
class TestPermanentDelete:
    async def _delete(self, client, resource, ids, confirm="DELETE"):
        return await client.post(f"{BASE}/{resource}/delete", json={"ids": ids, "confirm": confirm}, headers=UA)

    async def test_requires_super_admin_and_confirm_word(self, async_client, as_role, db_session):
        catalog = await create_catalog(db_session, is_active=False)
        as_role(AdminRole.ADMIN)
        assert (await self._delete(async_client, "catalogs", [catalog.id])).status_code == 403
        as_role(AdminRole.SUPER_ADMIN)
        assert (await self._delete(async_client, "catalogs", [catalog.id], confirm="yes")).status_code == 400
        assert await db_session.get(Catalog, catalog.id) is not None

    async def test_only_retired_rows_are_deleted(self, async_client, as_role, db_session):
        as_role(AdminRole.SUPER_ADMIN)
        live = await create_catalog(db_session, is_active=True)
        retired = await create_catalog(db_session, is_active=False)
        live_id, retired_id = live.id, retired.id
        response = await self._delete(async_client, "catalogs", [live_id, retired_id])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["deleted"] == 1
        assert [s["id"] for s in body["skipped"]] == [live_id]
        assert "still active" in body["skipped"][0]["reason"]
        db_session.expire_all()
        assert await db_session.get(Catalog, retired_id) is None
        assert await db_session.get(Catalog, live_id) is not None

    async def test_product_in_a_quote_is_kept_others_take_their_variations(self, async_client, as_role, db_session):
        as_role(AdminRole.SUPER_ADMIN)
        quoted = await create_chair(db_session, is_active=False)
        loose = await create_chair(db_session, is_active=False)
        variation = await create_product_variation(db_session, loose.id)
        quote = await create_quote(db_session)
        await create_quote_item(db_session, quote.id, product_id=quoted.id)
        quoted_id, loose_id, variation_id = quoted.id, loose.id, variation.id

        response = await self._delete(async_client, "products", [quoted_id, loose_id])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["deleted"] == 1
        assert body["skipped"][0]["id"] == quoted_id
        assert "quote line" in body["skipped"][0]["reason"]
        db_session.expire_all()
        assert await db_session.get(Chair, loose_id) is None
        assert await db_session.get(ProductVariation, variation_id) is None
        assert await db_session.get(Chair, quoted_id) is not None

    async def test_parent_and_child_categories_go_together(self, async_client, as_role, db_session):
        from backend.models.chair import Category

        as_role(AdminRole.SUPER_ADMIN)
        parent = await create_category(db_session, is_active=False)
        child = await create_category(db_session, parent_id=parent.id, is_active=False)
        ids = [parent.id, child.id]
        response = await self._delete(async_client, "categories", ids)
        assert response.status_code == 200, response.text
        assert response.json() == {"deleted": 2, "skipped": []}
        db_session.expire_all()
        for category_id in ids:
            assert await db_session.get(Category, category_id) is None


@pytest.mark.integration
@pytest.mark.admin
class TestSupplierLinks:
    async def _create(self, client, **overrides):
        body = {"name": "Wilsonart", "material_type": "laminate", "url": "www.wilsonart.com/laminate", **overrides}
        return await client.post("/api/v1/admin/material-sources", json=body, headers=UA)

    async def test_create_normalises_url_and_validates(self, async_client, as_role):
        as_role()
        created = await self._create(async_client)
        assert created.status_code == 200, created.text
        assert created.json()["url"] == "https://www.wilsonart.com/laminate"
        assert (await self._create(async_client, material_type="wallpaper")).status_code == 422
        assert (await self._create(async_client, url="   ")).status_code == 422

    async def test_links_show_on_products_and_follow_switches(self, async_client, as_role, db_session):
        as_role()
        laminate = (await self._create(async_client)).json()
        fabric = (await self._create(async_client, name="Momentum", material_type="upholstery", url="https://memosamples.com")).json()
        product = await create_chair(db_session, laminates_enabled=False)
        product_id = product.id

        added = await async_client.post(
            f"{BASE}/products",
            json={"ids": [product_id], "changes": {"add_material_sources": [laminate["id"], fabric["id"]]}},
            headers=UA,
        )
        assert added.status_code == 200, added.text

        listing = await async_client.get("/api/v1/products", params={"limit": 50}, headers=UA)
        items = listing.json().get("items") or listing.json().get("products") or []
        sources = next(p for p in items if p["id"] == product_id)["customizations"]["sources"]
        # Laminates are switched off for this product, so only the fabric supplier shows in lists
        assert list(sources) == ["upholstery"]
        assert sources["upholstery"][0]["name"] == "Momentum"

        detail = (await async_client.get(f"/api/v1/products/{product_id}", headers=UA)).json()
        assert set(detail["customizations"]["sources"]) == {"laminate", "upholstery"}
        assert detail["material_sources"] == [laminate["id"], fabric["id"]]

    async def test_exported_for_resource_pages(self, db_session):
        from backend.models.content import MaterialSource
        from backend.utils.static_content_exporter import SECTION_BUILDERS

        db_session.add(MaterialSource(name="Formica", material_type="laminate", url="https://formica.com"))
        db_session.add(MaterialSource(name="Old", material_type="laminate", url="https://old.example", is_active=False))
        await db_session.flush()
        exported = await SECTION_BUILDERS["materialSources"](db_session)
        assert [s["name"] for s in exported] == ["Formica"]
        assert exported[0]["materialType"] == "laminate"
