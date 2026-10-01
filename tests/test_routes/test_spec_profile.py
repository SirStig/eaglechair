"""
Test category spec profiles

Categories and subcategories carry a `spec_profile` that picks which catalog
spec symbols product pages show (chair, barstool, ...). NULL inherits from the
parent; the storefront resolves the inheritance.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import create_category, create_product_subcategory


@pytest.mark.integration
@pytest.mark.products
class TestSpecProfile:
    @pytest.mark.asyncio
    async def test_public_categories_expose_spec_profiles(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        parent = await create_category(
            db_session, name="Barstools", slug="barstools", spec_profile="barstool"
        )
        await create_product_subcategory(
            db_session, category_id=parent.id, name="Backless", slug="backless", spec_profile="bench"
        )
        await create_category(db_session, name="Wood", slug="wood-barstools", parent_id=parent.id)

        response = await async_client.get("/api/v1/categories")

        assert response.status_code == 200
        category = response.json()[0]
        assert category["spec_profile"] == "barstool"
        assert {c["slug"]: c["spec_profile"] for c in category["subcategories"]} == {
            "backless": "bench",
            "wood-barstools": None,
        }

    @pytest.mark.asyncio
    async def test_admin_sets_and_clears_category_spec_profile(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        category = await create_category(db_session, name="Chairs", slug="chairs")

        response = await async_client.put(
            f"/api/v1/admin/categories/{category.id}",
            json={"spec_profile": "chair"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["spec_profile"] == "chair"

        response = await async_client.put(
            f"/api/v1/admin/categories/{category.id}",
            json={"spec_profile": None},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["spec_profile"] is None

    @pytest.mark.asyncio
    async def test_admin_rejects_unknown_spec_profile(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        category = await create_category(db_session, name="Chairs", slug="chairs")

        response = await async_client.put(
            f"/api/v1/admin/categories/{category.id}",
            json={"spec_profile": "sofa"},
            headers=admin_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_admin_sets_subcategory_spec_profile(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        category = await create_category(db_session, name="Barstools", slug="barstools")
        subcategory = await create_product_subcategory(db_session, category_id=category.id)

        response = await async_client.put(
            f"/api/v1/admin/catalog/subcategories/{subcategory.id}",
            json={"spec_profile": "bench"},
            headers=admin_headers,
        )

        assert response.status_code == 200
        assert response.json()["spec_profile"] == "bench"

    @pytest.mark.asyncio
    async def test_static_export_includes_spec_profiles(self, db_session: AsyncSession):
        from backend.utils.static_content_exporter import (
            StaticContentExporter,
            export_content_after_update,
        )

        parent = await create_category(
            db_session, name="Chairs", slug="chairs", spec_profile="chair"
        )
        await create_product_subcategory(
            db_session, category_id=parent.id, name="Lounge", slug="lounge", spec_profile="bench"
        )

        await export_content_after_update("categories", db_session)

        exported = StaticContentExporter()._read_existing_content()["categories"]
        assert exported[0]["specProfile"] == "chair"
        assert exported[0]["subcategories"][0]["specProfile"] == "bench"

    @pytest.mark.asyncio
    async def test_ensure_spec_profile_columns_adds_column_with_slug_defaults(self, tmp_path):
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        from backend.database.base import ensure_spec_profile_columns

        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}")
        try:
            async with engine.begin() as conn:
                await conn.execute(text("CREATE TABLE categories (id INTEGER PRIMARY KEY, slug TEXT)"))
                await conn.execute(
                    text("CREATE TABLE product_subcategories (id INTEGER PRIMARY KEY, slug TEXT)")
                )
                await conn.execute(
                    text("INSERT INTO categories (id, slug) VALUES (1, 'barstools'), (2, 'custom')")
                )
                await conn.execute(
                    text("INSERT INTO product_subcategories (id, slug) VALUES (1, 'outdoor-bases')")
                )

            assert await ensure_spec_profile_columns(engine) == ["categories", "product_subcategories"]
            # Idempotent
            assert await ensure_spec_profile_columns(engine) == []

            async with engine.connect() as conn:
                categories = dict(
                    (await conn.execute(text("SELECT slug, spec_profile FROM categories"))).all()
                )
                subcategory = (
                    await conn.execute(text("SELECT spec_profile FROM product_subcategories"))
                ).scalar()
            assert categories == {"barstools": "barstool", "custom": None}
            assert subcategory == "table_base"
        finally:
            await engine.dispose()
