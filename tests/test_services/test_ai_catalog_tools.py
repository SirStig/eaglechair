"""AI catalog tools: full-catalog reads, data audits, and approval-gated batch proposals."""

import uuid

import pytest
from sqlalchemy import select

from backend.models.ai_chat import AIChatSession, AIProposedEdit
from backend.models.chair import ProductFamily, ProductVariation
from backend.services import ai_catalog_tools as tools
from tests.factories import (
    create_admin,
    create_category,
    create_chair,
    create_finish,
    create_product_family,
    create_product_variation,
)

pytestmark = pytest.mark.asyncio


async def _chat(db_session, admin):
    chat = AIChatSession(id=str(uuid.uuid4()), title="t", admin_user_id=admin.id)
    db_session.add(chat)
    await db_session.commit()
    return chat


async def _propose(db_session, chat, admin, changes, title="Batch"):
    return await tools.create_proposals(
        db_session, session_id=chat.id, message_id=None, admin_user_id=admin.id, title=title, changes=changes,
    )


class TestReads:
    async def test_list_records_sees_inactive_and_paginates(self, db_session):
        product = await create_chair(db_session, is_active=True)
        for i in range(3):
            await create_product_variation(db_session, product.id, sku=f"PAGE-{i}", is_available=i != 0)

        page = await tools.list_records(db_session, "variations", filters={"product_id": product.id}, limit=2)
        assert page["total"] == 3 and page["returned"] == 2 and page["has_more"]
        rest = await tools.list_records(db_session, "variation", filters={"product_id": product.id}, limit=2, offset=2)
        assert rest["returned"] == 1 and not rest["has_more"]

        active_only = await tools.list_records(
            db_session, "variation", filters={"product_id": product.id}, include_inactive=False,
        )
        assert active_only["total"] == 2

    async def test_list_records_search_and_reference_names(self, db_session):
        family = await create_product_family(db_session, name="Abruzzo Test")
        await create_chair(db_session, family_id=family.id, model_number="5242", model_suffix="P", name="Side Chair")
        result = await tools.list_records(db_session, "product", search="5242p")
        assert result["total"] == 1
        assert result["records"][0]["family_name"] == "Abruzzo Test"

    async def test_unknown_filter_field_is_an_error(self, db_session):
        with pytest.raises(ValueError):
            await tools.list_records(db_session, "product", filters={"nope": 1})

    async def test_get_records_includes_variations_and_links(self, db_session):
        product = await create_chair(db_session)
        await create_product_variation(db_session, product.id, sku="GR-1")
        result = await tools.get_records(db_session, "product", [product.id, 999999])
        rec = result["records"][0]
        assert [v["sku"] for v in rec["variations"]] == ["GR-1"]
        assert "category_ids" in rec and "secondary_family_ids" in rec
        assert result["not_found"] == [999999]

    async def test_every_entity_type_is_listable(self, db_session):
        overview = await tools.catalog_overview(db_session)
        assert set(overview["counts"]) == set(tools.ENTITIES)
        for key in tools.ENTITIES:
            assert (await tools.list_records(db_session, key, limit=1))["entity_type"] == key
        schema = tools.describe_schema()
        assert "sku" in schema["entities"]["variation"]["fields"]
        assert "document" not in schema["entities"]["catalog_project"]["fields"]


class TestAudit:
    async def test_variation_audit_finds_cleanup_work(self, db_session):
        product = await create_chair(db_session, model_number="6018", is_active=False, width=20.0)
        await create_product_variation(db_session, product.id, sku="6018-wb", name="", width=20.0, is_available=True)
        await create_product_variation(db_session, product.id, sku="6018WB", name="Walnut")
        await create_product_variation(db_session, product.id, sku="9999X", name="  Odd  name")

        result = await tools.audit_data_quality(db_session, "variation", filters={"product_id": product.id})
        counts = result["issue_counts"]
        for issue in ("duplicate_sku", "sku_not_uppercase", "missing_name", "available_on_inactive_product",
                      "sku_does_not_match_product_model", "messy_whitespace", "redundant_dimensions"):
            assert counts.get(issue), issue
        fixes = [i for i in result["issues"] if i["issue"] == "sku_not_uppercase"]
        assert fixes[0]["suggested_changes"] == {"sku": "6018-WB"}
        assert result["auto_fixable_counts"]["messy_whitespace"] >= 1

    async def test_collect_audit_fixes_merges_one_change_per_record(self, db_session):
        product = await create_chair(db_session, name="  Messy   Chair ", short_description="Too  many spaces")
        await create_chair(db_session, name="Clean Chair")

        found = await tools.collect_audit_fixes(
            db_session, "product", filters={"id": product.id}, issue_types=["messy_whitespace"],
        )
        assert len(found["changes"]) == 1
        change = found["changes"][0]
        assert change["entity_id"] == product.id
        assert change["changes"]["name"] == "Messy Chair"
        assert change["changes"]["short_description"] == "Too many spaces"
        assert "messy whitespace" in change["reason"]

        none = await tools.collect_audit_fixes(db_session, "product", filters={"id": product.id}, issue_types=["nope"])
        assert none["changes"] == [] and "messy_whitespace" in none["fixable_issue_types"]


class TestProposals:
    async def test_propose_audit_fixes_builds_one_batch_with_progress(self, db_session, monkeypatch):
        from backend.services import ai_service

        admin = await create_admin(db_session)
        chat = await _chat(db_session, admin)
        family = await create_product_family(db_session)
        for i in range(30):
            await create_chair(db_session, family_id=family.id, name=f"Chair  {i} ")

        async def with_db(fn, *args, **kwargs):
            return await fn(db_session, *args, **kwargs)

        monkeypatch.setattr(ai_service, "_with_db", with_db)
        monkeypatch.setattr(ai_service, "PROPOSAL_CHUNK", 7)
        events = []
        ctx = ai_service.ToolContext(session_id=chat.id, admin_user_id=admin.id, mode="edit")
        result = await ai_service._propose_audit_fixes(
            {"entity_type": "product", "issue_types": ["messy_whitespace"], "filters": {"family_id": family.id}},
            ctx, events.append,
        )

        assert result["accepted"] == 30 and result["rejected_count"] == 0
        progress = [e["data"] for e in events if e["type"] == "progress" and e["data"]["total"]]
        assert [p["done"] for p in progress] == [7, 14, 21, 28, 30]
        batches = [e["data"]["batch"] for e in events if e["type"] == "edit_batch"]
        assert len(batches) == 1 and len(batches[0]["edits"]) == 30

        rows = (await db_session.execute(
            select(AIProposedEdit).where(AIProposedEdit.session_id == chat.id).order_by(AIProposedEdit.position)
        )).scalars().all()
        assert {r.batch_id for r in rows} == {batches[0]["batch_id"]}
        assert [r.position for r in rows] == list(range(30))

    async def test_batch_validates_and_reports_rejections(self, db_session):
        admin = await create_admin(db_session)
        chat = await _chat(db_session, admin)
        product = await create_chair(db_session, base_price=10000)
        variation = await create_product_variation(db_session, product.id, sku="BV-1", name="old")

        result = await _propose(db_session, chat, admin, [
            {"entity_type": "variation", "entity_id": variation.id, "changes": {"name": "New"}, "reason": "r"},
            {"entity_type": "product", "entity_id": product.id, "changes": {"base_price": "12500"}, "reason": "r"},
            {"entity_type": "family", "entity_id": 987654, "changes": {"name": "x"}, "reason": "missing record"},
            {"entity_type": "variation", "entity_id": variation.id, "changes": {"finish_id": 987654}, "reason": "bad fk"},
            {"entity_type": "chair", "entity_id": product.id, "changes": {"view_count": 5}, "reason": "read-only"},
            {"entity_type": "spaceship", "entity_id": 1, "changes": {"x": 1}, "reason": "bad type"},
        ])
        assert result["accepted"] == 2, result["rejected"]
        errors = " | ".join(r["error"] for r in result["rejected"])
        assert "no family with id 987654" in errors
        assert "no finish with that id" in errors
        assert "read-only" in errors
        assert "Unknown entity_type" in errors

        price = next(e for e in result["edits"] if e["entity_type"] == "product")
        assert price["changes"] == {"base_price": 12500}
        assert price["before"] == {"base_price": 10000}
        assert price["status"] == "pending"
        assert price["admin_url"] == f"/admin/catalog?edit={product.id}"
        # Nothing written yet
        await db_session.refresh(product)
        assert product.base_price == 10000

    async def test_noop_and_duplicate_changes_rejected(self, db_session):
        admin = await create_admin(db_session)
        chat = await _chat(db_session, admin)
        product = await create_chair(db_session)
        variation = await create_product_variation(db_session, product.id, sku="NOOP-1", name="same")
        result = await _propose(db_session, chat, admin, [
            {"entity_type": "variation", "entity_id": variation.id, "changes": {"name": "same"}, "reason": "no-op"},
            {"entity_type": "variation", "entity_id": variation.id, "changes": {"name": "A"}, "reason": "first"},
            {"entity_type": "variation", "entity_id": variation.id, "changes": {"name": "B"}, "reason": "dup"},
        ])
        assert result["accepted"] == 1
        errors = " | ".join(r["error"] for r in result["rejected"])
        assert "already matches" in errors and "more than one change" in errors

    async def test_apply_update_create_delete(self, db_session):
        admin = await create_admin(db_session)
        chat = await _chat(db_session, admin)
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id)
        finish = await create_finish(db_session)
        junk = await create_product_variation(db_session, product.id, sku="JUNK-1")
        keep = await create_product_variation(db_session, product.id, sku="keep-1")

        result = await _propose(db_session, chat, admin, [
            {"entity_type": "variation", "entity_id": keep.id, "changes": {"sku": "KEEP-1", "finish_id": finish.id}, "reason": "r"},
            {"action": "delete", "entity_type": "variation", "entity_id": junk.id, "reason": "dup"},
            {"action": "create", "entity_type": "family", "changes": {"name": "New Family", "category_id": category.id}, "reason": "r"},
        ])
        assert result["accepted"] == 3, result["rejected"]
        rows = (await db_session.execute(
            select(AIProposedEdit).where(AIProposedEdit.batch_id == result["batch_id"]).order_by(AIProposedEdit.position)
        )).scalars().all()
        outcomes = [await tools.apply_proposal(db_session, p) for p in rows]
        assert [o["status"] for o in outcomes] == ["applied"] * 3, outcomes

        await db_session.refresh(keep)
        assert keep.sku == "KEEP-1" and keep.finish_id == finish.id
        assert await db_session.get(ProductVariation, junk.id) is None
        family = await db_session.get(ProductFamily, outcomes[2]["entity_id"])
        assert family.name == "New Family" and family.slug == "new-family"

    async def test_apply_detects_conflicting_edit(self, db_session):
        admin = await create_admin(db_session)
        chat = await _chat(db_session, admin)
        product = await create_chair(db_session, name="Original")
        result = await _propose(db_session, chat, admin, [
            {"entity_type": "product", "entity_id": product.id, "changes": {"name": "AI Name"}, "reason": "r"},
        ])
        product.name = "Edited by hand"
        await db_session.commit()

        p = await db_session.get(AIProposedEdit, result["edits"][0]["id"])
        outcome = await tools.apply_proposal(db_session, p)
        assert outcome["conflict"] and outcome["status"] == "pending"
        forced = await tools.apply_proposal(db_session, p, force=True)
        assert forced["status"] == "applied"
        await db_session.refresh(product)
        assert product.name == "AI Name"

    async def test_create_requires_required_fields(self, db_session):
        admin = await create_admin(db_session)
        chat = await _chat(db_session, admin)
        result = await _propose(db_session, chat, admin, [
            {"action": "create", "entity_type": "product", "changes": {"name": "No model"}, "reason": "r"},
        ])
        assert result["accepted"] == 0
        assert "requires" in result["rejected"][0]["error"]


class TestEndpoints:
    HEADERS = {"User-Agent": "Mozilla/5.0 test", "X-Session-Token": "s", "X-Admin-Token": "a"}

    async def test_apply_and_decline_endpoints(self, async_client, db_session):
        from backend.api.dependencies import authenticate_admin
        from tests.conftest import get_app

        admin = await create_admin(db_session)
        other = await create_admin(db_session)
        chat = await _chat(db_session, admin)
        product = await create_chair(db_session, base_price=5000)
        v1 = await create_product_variation(db_session, product.id, sku="EP-1")
        v2 = await create_product_variation(db_session, product.id, sku="EP-2")
        result = await _propose(db_session, chat, admin, [
            {"entity_type": "product", "entity_id": product.id, "changes": {"base_price": 7500}, "reason": "r"},
            {"entity_type": "variation", "entity_id": v1.id, "changes": {"name": "One"}, "reason": "r"},
            {"entity_type": "variation", "entity_id": v2.id, "changes": {"name": "Two"}, "reason": "r"},
        ])
        price_id, v1_id, v2_id = [e["id"] for e in result["edits"]]
        # One proposal fails at apply time because its record is gone
        await db_session.delete(v1)
        await db_session.commit()

        app = get_app()
        app.dependency_overrides[authenticate_admin] = lambda: admin
        try:
            resp = await async_client.post(
                "/api/v1/admin/ai/edits/apply", json={"ids": [v1_id, price_id]}, headers=self.HEADERS,
            )
            assert resp.status_code == 200, resp.text
            by_id = {r["id"]: r for r in resp.json()["results"]}
            assert by_id[v1_id]["status"] == "failed"
            assert by_id[price_id]["status"] == "applied"

            resp = await async_client.post(
                "/api/v1/admin/ai/edits/decline", json={"ids": [v2_id]}, headers=self.HEADERS,
            )
            assert resp.json()["results"][0]["status"] == "declined"

            resp = await async_client.get(f"/api/v1/admin/ai/edits?session_id={chat.id}", headers=self.HEADERS)
            assert {e["id"]: e["status"] for e in resp.json()} == {
                price_id: "applied", v1_id: "failed", v2_id: "declined",
            }

            # Another admin can't apply someone else's proposals
            app.dependency_overrides[authenticate_admin] = lambda: other
            resp = await async_client.post(
                "/api/v1/admin/ai/edits/apply", json={"ids": [v2_id]}, headers=self.HEADERS,
            )
            assert resp.json()["results"][0]["error"] == "Proposal not found"
        finally:
            app.dependency_overrides.pop(authenticate_admin, None)

        await db_session.refresh(product)
        assert product.base_price == 7500
