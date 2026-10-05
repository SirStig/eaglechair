"""
Time Machine: history capture (backend/services/history_service.py),
restores (backend/services/history_restore.py) and the super-admin routes
(backend/api/v1/routes/admin/time_machine.py)
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import insert, select

from backend.core.ephemeral_store import ephemeral_store
from backend.models.chair import Category, Chair, ProductVariation, chair_categories
from backend.models.company import AdminRole, Company
from backend.models.history import HistoryChangeSet, HistoryEntry
from backend.services import history_service, media_service
from backend.services.history_service import HistoryRecorder
from tests.factories import create_admin, create_category, create_chair, create_company, create_product_variation
from tests.test_routes.test_admin_access import _headers

TM = "/api/v1/admin/time-machine"
PRODUCTS = "/api/v1/admin/products"


@pytest.fixture(autouse=True)
def _clear_confirmations():
    ephemeral_store.clear_memory()
    yield
    ephemeral_store.clear_memory()


async def _super(db_session):
    admin = await create_admin(db_session, role=AdminRole.SUPER_ADMIN)
    return admin, await _headers(db_session, admin)


async def _entries(db_session, **filters):
    query = select(HistoryEntry).order_by(HistoryEntry.id)
    for name, value in filters.items():
        query = query.where(getattr(HistoryEntry, name) == value)
    return (await db_session.execute(query)).scalars().all()


async def _reload(db_session, model, row_id):
    """The row as the database has it now (the routes changed it on the same connection)"""
    return await db_session.get(model, row_id, populate_existing=True)


@pytest.mark.integration
@pytest.mark.admin
class TestCapture:
    async def test_edit_records_full_old_and_new_values(self, async_client, db_session):
        _, headers = await _super(db_session)
        product = await create_chair(db_session, full_description="Original words")
        long_text = "Hand-built frame. " * 200  # far past the activity log's 300-char trim

        response = await async_client.patch(
            f"{PRODUCTS}/{product.id}", json={"full_description": long_text}, headers=headers
        )
        assert response.status_code == 200, response.text

        [entry] = await _entries(db_session, table_name="chairs", row_key=str(product.id))
        assert entry.op == "updated"
        assert entry.data["before"] == {"full_description": "Original words"}
        assert entry.data["after"] == {"full_description": long_text}
        change_set = await db_session.get(HistoryChangeSet, entry.change_set_id)
        assert change_set.action == "update" and change_set.resource_type == "products"

    async def test_reads_and_unchanged_saves_record_nothing(self, async_client, db_session):
        _, headers = await _super(db_session)
        product = await create_chair(db_session)
        await async_client.get(f"{PRODUCTS}/{product.id}", headers=headers)
        await async_client.patch(f"{PRODUCTS}/{product.id}", json={"name": product.name}, headers=headers)
        assert await _entries(db_session, table_name="chairs") == []

    async def test_secret_columns_are_never_recorded_for_updates(self, db_session):
        company = await create_company(db_session)
        with HistoryRecorder(db_session, lambda: None, {"action": "update", "resource_type": "companies"}):
            company.hashed_password = "new-hash"
            company.company_name = "Renamed Co"
            await db_session.commit()
        [entry] = await _entries(db_session, table_name="companies")
        assert set(entry.data["before"]) == {"company_name"}


@pytest.mark.integration
@pytest.mark.admin
class TestRestore:
    async def test_revert_an_edit(self, async_client, db_session):
        _, headers = await _super(db_session)
        product = await create_chair(db_session, full_description="Good copy")
        await async_client.patch(f"{PRODUCTS}/{product.id}", json={"full_description": "Oops"}, headers=headers)
        [entry] = await _entries(db_session, table_name="chairs")

        preview = await async_client.get(f"{TM}/preview", params={"change_set_id": entry.change_set_id}, headers=headers)
        assert preview.status_code == 200, preview.text
        assert preview.json()["counts"]["revert"] == 1 and preview.json()["can_apply"]

        response = await async_client.post(f"{TM}/restore", json={"change_set_id": entry.change_set_id}, headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["counts"]["revert"] == 1
        assert (await _reload(db_session, Chair, product.id)).full_description == "Good copy"

        reverted = await _reload(db_session, HistoryChangeSet, entry.change_set_id)
        assert reverted.reverted_at is not None
        # The restore is itself history, so it can be undone too
        undo = await db_session.get(HistoryChangeSet, reverted.reverted_by_set_id)
        assert undo.restores_set_id == entry.change_set_id and undo.action == "restore"
        response = await async_client.post(f"{TM}/restore", json={"change_set_id": undo.id}, headers=headers)
        assert response.status_code == 200, response.text
        assert (await _reload(db_session, Chair, product.id)).full_description == "Oops"

    async def test_bring_back_a_hard_deleted_product_with_its_parts(self, async_client, db_session):
        _, headers = await _super(db_session)
        extra = await create_category(db_session)
        product = await create_chair(db_session, name="Lobo Side", full_description="Keep me")
        variation = await create_product_variation(db_session, product.id, sku="LOBO-1")
        await db_session.execute(insert(chair_categories).values(chair_id=product.id, category_id=extra.id))
        await db_session.commit()

        response = await async_client.delete(f"{PRODUCTS}/{product.id}", params={"hard": "true"}, headers=headers)
        assert response.status_code == 200, response.text
        assert await _reload(db_session, Chair, product.id) is None

        deleted = await _entries(db_session, op="deleted")
        assert {e.table_name for e in deleted} >= {"chairs", "product_variations", "chair_categories"}
        set_id = deleted[0].change_set_id

        detail = (await async_client.get(f"{TM}/changes/{set_id}", headers=headers)).json()
        by_table = {e["table"]: e for e in detail["entries"]}
        chair_entry = by_table["chairs"]
        assert chair_entry["label"] == "Lobo Side" and chair_entry["parent_id"] is None
        assert by_table["chair_categories"]["parent_id"] == chair_entry["id"]

        response = await async_client.post(f"{TM}/restore", json={"change_set_id": set_id}, headers=headers)
        assert response.status_code == 200, response.text
        restored = await _reload(db_session, Chair, product.id)
        assert restored is not None and restored.full_description == "Keep me"
        assert (await db_session.get(ProductVariation, variation.id)).sku == "LOBO-1"
        links = (await db_session.execute(
            select(chair_categories).where(chair_categories.c.chair_id == product.id)
        )).all()
        assert len(links) == 1

    async def test_rewind_one_record_undoes_every_later_change(self, async_client, db_session):
        _, headers = await _super(db_session)
        product = await create_chair(db_session, name="First name", full_description="v1")
        await async_client.patch(f"{PRODUCTS}/{product.id}", json={"full_description": "v2"}, headers=headers)
        await async_client.patch(
            f"{PRODUCTS}/{product.id}", json={"name": "Second name", "full_description": "v3"}, headers=headers
        )
        first, _ = await _entries(db_session, table_name="chairs")

        history = (await async_client.get(f"{TM}/records/chairs/{product.id}", headers=headers)).json()
        assert [e["op"] for e in history["entries"]] == ["updated", "updated"] and history["exists"]

        response = await async_client.post(f"{TM}/restore", json={"entry_id": first.id}, headers=headers)
        assert response.status_code == 200, response.text
        product = await _reload(db_session, Chair, product.id)
        assert (product.name, product.full_description) == ("First name", "v1")

    async def test_newer_edits_are_a_conflict_until_confirmed(self, async_client, db_session):
        _, headers = await _super(db_session)
        product = await create_chair(db_session, full_description="v1")
        await async_client.patch(f"{PRODUCTS}/{product.id}", json={"full_description": "v2"}, headers=headers)
        await async_client.patch(f"{PRODUCTS}/{product.id}", json={"full_description": "v3"}, headers=headers)
        first, _ = await _entries(db_session, table_name="chairs")

        preview = (await async_client.get(
            f"{TM}/preview", params={"change_set_id": first.change_set_id}, headers=headers
        )).json()
        assert preview["needs_force"] and preview["steps"][0]["conflicts"][0]["current"] == "v3"

        refused = await async_client.post(f"{TM}/restore", json={"change_set_id": first.change_set_id}, headers=headers)
        assert refused.status_code == 409
        assert (await _reload(db_session, Chair, product.id)).full_description == "v3"

        forced = await async_client.post(
            f"{TM}/restore", json={"change_set_id": first.change_set_id, "force": True}, headers=headers
        )
        assert forced.status_code == 200, forced.text
        assert (await _reload(db_session, Chair, product.id)).full_description == "v1"

    async def test_undo_a_create_removes_the_row(self, async_client, db_session):
        _, headers = await _super(db_session)
        response = await async_client.post(
            "/api/v1/admin/categories", json={"name": "Temporary", "slug": "temporary-tm"}, headers=headers
        )
        assert response.status_code == 201, response.text
        category_id = response.json()["id"]
        [entry] = await _entries(db_session, table_name="categories", op="created")

        response = await async_client.post(f"{TM}/restore", json={"change_set_id": entry.change_set_id}, headers=headers)
        assert response.status_code == 200, response.text
        assert await _reload(db_session, Category, category_id) is None

    async def test_restore_is_blocked_when_a_parent_is_gone(self, async_client, db_session):
        _, headers = await _super(db_session)
        product = await create_chair(db_session)
        variation = await create_product_variation(db_session, product.id)
        with HistoryRecorder(db_session, lambda: None, {"action": "delete", "resource_type": "products"}) as rec:
            await db_session.delete(variation)
            await db_session.commit()
        # The product goes too, with no history to bring it back
        await db_session.delete(await db_session.get(Chair, product.id))
        await db_session.commit()

        preview = (await async_client.get(
            f"{TM}/preview", params={"change_set_id": rec.set_id}, headers=headers
        )).json()
        assert not preview["can_apply"]
        assert "Product" in preview["steps"][0]["message"]
        response = await async_client.post(f"{TM}/restore", json={"change_set_id": rec.set_id}, headers=headers)
        assert response.status_code == 409


@pytest.mark.integration
@pytest.mark.admin
class TestAccessAndListing:
    async def test_super_admins_only(self, async_client, db_session):
        admin = await create_admin(db_session, role=AdminRole.ADMIN)
        headers = await _headers(db_session, admin)
        for path in ("/summary", "/changes", "/preview?change_set_id=x"):
            assert (await async_client.get(f"{TM}{path}", headers=headers)).status_code == 403
        response = await async_client.post(f"{TM}/restore", json={"change_set_id": "x"}, headers=headers)
        assert response.status_code == 403

    async def test_list_filters_and_headlines(self, async_client, db_session):
        admin, headers = await _super(db_session)
        product = await create_chair(db_session, name="Findable Chair")
        await async_client.patch(f"{PRODUCTS}/{product.id}", json={"full_description": "new"}, headers=headers)

        body = (await async_client.get(f"{TM}/changes", params={"q": "Findable"}, headers=headers)).json()
        assert body["total"] == 1
        [item] = body["items"]
        assert item["admin"]["id"] == admin.id and item["counts"]["updated"] == 1
        assert item["headline"][0]["label"] == "Findable Chair"
        deleted_only = await async_client.get(f"{TM}/changes", params={"op": "deleted"}, headers=headers)
        assert deleted_only.json()["total"] == 0

        summary = (await async_client.get(f"{TM}/summary", headers=headers)).json()
        assert summary["retention_days"] >= 1
        assert {"table": "chairs", "label": "Product"} in summary["tables"]


@pytest.mark.unit
class TestRetentionAndTrash:
    async def test_purge_drops_history_past_retention(self, db_session):
        old = datetime.utcnow() - timedelta(days=400)
        db_session.add(HistoryChangeSet(
            id="a" * 32, action="update", resource_type="products", created_at=old, updated_at=old,
        ))
        db_session.add(HistoryEntry(
            change_set_id="a" * 32, table_name="chairs", row_key="1", op="updated",
            data={"key": {"id": 1}}, created_at=old, updated_at=old,
        ))
        await db_session.commit()
        assert await history_service.purge_expired(db_session) == 1
        assert await db_session.get(HistoryChangeSet, "a" * 32) is None

    def test_deleted_images_wait_in_trash_and_come_back(self, tmp_path):
        uploads = tmp_path / "uploads"
        master = uploads / "images" / "products" / "chair.jpg"
        master.parent.mkdir(parents=True)
        master.write_bytes(b"jpeg")

        media_service.delete_image_files(master, uploads)
        assert not master.exists()
        assert (tmp_path / ".upload-trash" / "images" / "products" / "chair.jpg").read_bytes() == b"jpeg"

        assert media_service.restore_trashed_image(master, uploads)
        assert master.read_bytes() == b"jpeg"

    def test_values_survive_encoding(self):
        from decimal import Decimal

        from backend.models.company import CompanyStatus

        table = Company.__table__
        for column, value in (
            ("status", CompanyStatus.ACTIVE),
            ("created_at", datetime(2026, 10, 5, 12, 30, 1, 5)),
        ):
            encoded = history_service.encode_value(value)
            assert history_service.decode_value(table.c[column], encoded) == value
        assert history_service.encode_value(Decimal("1.50")) == "1.50"
