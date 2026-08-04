"""
Test Category Hierarchy and Multi-Category Products

Covers:
- Nested categories (categories with a parent_id) are presented as children of
  their parent, never as primary categories.
- Products can be listed under several categories and subcategories.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.admin_service import AdminService
from backend.services.product_service import ProductService
from backend.utils.pagination import PaginationParams
from tests.factories import (
    create_category,
    create_chair,
    create_product_subcategory,
)


@pytest.mark.integration
@pytest.mark.products
class TestCategoryHierarchy:
    """Nested categories must not surface as primary categories."""

    @pytest.mark.asyncio
    async def test_nested_category_is_not_listed_as_primary(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        parent = await create_category(db_session, name="Chairs", slug="chairs")
        await create_category(
            db_session, name="Wood Chairs", slug="wood-chairs", parent_id=parent.id
        )

        response = await async_client.get("/api/v1/categories")

        assert response.status_code == 200
        data = response.json()
        slugs = [c["slug"] for c in data]
        assert slugs == ["chairs"]

    @pytest.mark.asyncio
    async def test_nested_category_is_returned_as_a_child(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        parent = await create_category(db_session, name="Chairs", slug="chairs")
        await create_category(
            db_session,
            name="Wood Chairs",
            slug="wood-chairs",
            parent_id=parent.id,
            display_order=2,
        )
        await create_product_subcategory(
            db_session,
            category_id=parent.id,
            name="Metal Chairs",
            slug="metal-chairs",
            display_order=1,
        )

        response = await async_client.get("/api/v1/categories")

        assert response.status_code == 200
        children = response.json()[0]["subcategories"]
        assert [(c["slug"], c["type"]) for c in children] == [
            ("metal-chairs", "subcategory"),
            ("wood-chairs", "category"),
        ]
        assert all(c["category_id"] == parent.id for c in children)

    @pytest.mark.asyncio
    async def test_include_nested_returns_flat_list(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        parent = await create_category(db_session, name="Chairs", slug="chairs")
        await create_category(
            db_session, name="Wood Chairs", slug="wood-chairs", parent_id=parent.id
        )

        response = await async_client.get(
            "/api/v1/categories", params={"include_nested": True}
        )

        assert response.status_code == 200
        slugs = sorted(c["slug"] for c in response.json())
        assert slugs == ["chairs", "wood-chairs"]

    @pytest.mark.asyncio
    async def test_subcategories_endpoint_includes_nested_categories(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        parent = await create_category(db_session, name="Chairs", slug="chairs")
        nested = await create_category(
            db_session, name="Wood Chairs", slug="wood-chairs", parent_id=parent.id
        )
        subcategory = await create_product_subcategory(
            db_session, category_id=parent.id, name="Metal Chairs"
        )
        await create_chair(db_session, category_id=nested.id)

        response = await async_client.get(
            "/api/v1/subcategories", params={"category_id": parent.id}
        )

        assert response.status_code == 200
        children = {c["type"]: c for c in response.json()}
        assert children["category"]["id"] == nested.id
        assert children["category"]["product_count"] == 1
        assert children["subcategory"]["id"] == subcategory.id

    @pytest.mark.asyncio
    async def test_admin_list_shows_nested_categories_as_children(
        self, db_session: AsyncSession
    ):
        from backend.api.v1.routes.admin.categories import _load_category_children

        parent = await create_category(db_session, name="Chairs", slug="chairs-admin")
        nested = await create_category(
            db_session,
            name="Wood Chairs",
            slug="wood-chairs-admin",
            parent_id=parent.id,
            display_order=2,
        )
        subcategory = await create_product_subcategory(
            db_session, category_id=parent.id, name="Metal", display_order=1
        )

        children = await _load_category_children(db_session, parent.id)

        assert [(c["id"], c["type"]) for c in children] == [
            (subcategory.id, "subcategory"),
            (nested.id, "category"),
        ]

    @pytest.mark.asyncio
    async def test_static_export_nests_child_categories(
        self, db_session: AsyncSession
    ):
        from backend.utils.static_content_exporter import (
            StaticContentExporter,
            export_content_after_update,
        )

        parent = await create_category(db_session, name="Chairs", slug="chairs")
        await create_category(
            db_session, name="Wood Chairs", slug="wood-chairs", parent_id=parent.id
        )

        await export_content_after_update("categories", db_session)

        exported = StaticContentExporter()._read_existing_content()["categories"]
        assert [c["slug"] for c in exported] == ["chairs"]
        assert [(c["slug"], c["type"]) for c in exported[0]["subcategories"]] == [
            ("wood-chairs", "category")
        ]


@pytest.mark.integration
@pytest.mark.products
class TestMultiCategoryProducts:
    """A product can belong to several categories and subcategories."""

    @pytest.mark.asyncio
    async def test_product_can_be_assigned_multiple_categories(
        self, db_session: AsyncSession
    ):
        chairs = await create_category(db_session, name="Chairs", slug="chairs-multi")
        stools = await create_category(db_session, name="Stools", slug="stools-multi")
        chair = await create_chair(db_session, category_id=chairs.id)

        await AdminService.update_product(
            db=db_session,
            product_id=chair.id,
            update_data={"category_ids": [chairs.id, stools.id]},
        )

        for category_id in (chairs.id, stools.id):
            result = await ProductService.get_products(
                db=db_session,
                pagination=PaginationParams(page=1, per_page=20),
                category_id=category_id,
            )
            assert [p.id for p in result["items"]] == [chair.id]

    @pytest.mark.asyncio
    async def test_primary_category_follows_the_selection(
        self, db_session: AsyncSession
    ):
        chairs = await create_category(db_session, name="Chairs", slug="chairs-primary")
        stools = await create_category(db_session, name="Stools", slug="stools-primary")
        chair = await create_chair(db_session, category_id=chairs.id)

        # The current primary is not in the submitted set, so it is replaced
        product = await AdminService.update_product(
            db=db_session,
            product_id=chair.id,
            update_data={"category_ids": [stools.id]},
        )

        assert product.category_id == stools.id

        result = await ProductService.get_products(
            db=db_session,
            pagination=PaginationParams(page=1, per_page=20),
            category_id=chairs.id,
        )
        assert result["items"] == []

    @pytest.mark.asyncio
    async def test_explicit_primary_stays_in_the_set(self, db_session: AsyncSession):
        chairs = await create_category(db_session, name="Chairs", slug="chairs-explicit")
        stools = await create_category(db_session, name="Stools", slug="stools-explicit")
        chair = await create_chair(db_session, category_id=stools.id)

        product = await AdminService.update_product(
            db=db_session,
            product_id=chair.id,
            update_data={"category_id": chairs.id, "category_ids": [chairs.id, stools.id]},
        )

        assert product.category_id == chairs.id

        for category_id in (chairs.id, stools.id):
            result = await ProductService.get_products(
                db=db_session,
                pagination=PaginationParams(page=1, per_page=20),
                category_id=category_id,
            )
            assert [p.id for p in result["items"]] == [chair.id]

    @pytest.mark.asyncio
    async def test_product_can_be_assigned_multiple_subcategories(
        self, db_session: AsyncSession
    ):
        category = await create_category(db_session, name="Chairs", slug="chairs-subs")
        wood = await create_product_subcategory(
            db_session, category_id=category.id, name="Wood"
        )
        metal = await create_product_subcategory(
            db_session, category_id=category.id, name="Metal"
        )
        chair = await create_chair(
            db_session, category_id=category.id, subcategory_id=wood.id
        )

        await AdminService.update_product(
            db=db_session,
            product_id=chair.id,
            update_data={"subcategory_ids": [wood.id, metal.id]},
        )

        for subcategory_id in (wood.id, metal.id):
            result = await ProductService.get_products(
                db=db_session,
                pagination=PaginationParams(page=1, per_page=20),
                subcategory_id=subcategory_id,
            )
            assert [p.id for p in result["items"]] == [chair.id]

    @pytest.mark.asyncio
    async def test_create_product_with_multiple_categories(
        self, db_session: AsyncSession
    ):
        chairs = await create_category(db_session, name="Chairs", slug="chairs-create")
        stools = await create_category(db_session, name="Stools", slug="stools-create")

        product = await AdminService.create_product(
            db=db_session,
            product_data={
                "name": "Multi Category Chair",
                "model_number": "MC-001",
                "slug": "multi-category-chair",
                "base_price": 10000,
                "category_ids": [chairs.id, stools.id],
                "images": [],
            },
        )

        # The first category becomes the primary one
        assert product.category_id == chairs.id

        result = await ProductService.get_products(
            db=db_session,
            pagination=PaginationParams(page=1, per_page=20),
            category_id=stools.id,
        )
        assert [p.id for p in result["items"]] == [product.id]

    @pytest.mark.asyncio
    async def test_unknown_category_id_is_rejected(self, db_session: AsyncSession):
        from backend.core.exceptions import ValidationError

        category = await create_category(db_session, name="Chairs", slug="chairs-bad")
        chair = await create_chair(db_session, category_id=category.id)

        with pytest.raises(ValidationError):
            await AdminService.update_product(
                db=db_session,
                product_id=chair.id,
                update_data={"category_ids": [category.id, 999999]},
            )

    @pytest.mark.asyncio
    async def test_product_response_exposes_all_categories(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        chairs = await create_category(db_session, name="Chairs", slug="chairs-resp")
        stools = await create_category(db_session, name="Stools", slug="stools-resp")
        chair = await create_chair(db_session, category_id=chairs.id)

        await AdminService.update_product(
            db=db_session,
            product_id=chair.id,
            update_data={"category_ids": [chairs.id, stools.id]},
        )

        response = await async_client.get("/api/v1/products")

        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == chair.id)
        assert item["category_ids"][0] == chairs.id
        assert sorted(item["category_ids"]) == sorted([chairs.id, stools.id])
