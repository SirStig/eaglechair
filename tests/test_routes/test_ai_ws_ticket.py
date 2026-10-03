"""Tests for the one-time AI chat WebSocket ticket"""

import time
import uuid

import pytest

from backend.api.v1.routes.admin import ai_chat
from backend.models.ai_chat import AIChatSession
from tests.factories import create_admin


async def _make_chat(db_session, admin):
    session = AIChatSession(id=str(uuid.uuid4()), title="Chat", admin_user_id=admin.id)
    db_session.add(session)
    await db_session.commit()
    return session


@pytest.mark.unit
@pytest.mark.admin
class TestWsTicket:
    @pytest.mark.asyncio
    async def test_ticket_redeems_once_for_its_chat(self, db_session):
        admin = await create_admin(db_session)
        chat = await _make_chat(db_session, admin)
        ticket = ai_chat._issue_ws_ticket(admin, chat.id)

        assert await ai_chat._redeem_ws_ticket(ticket, "other-chat") is None
        record = await ai_chat._redeem_ws_ticket(ticket, chat.id)
        assert record["a"] == admin.id
        assert await ai_chat._redeem_ws_ticket(ticket, chat.id) is None

    @pytest.mark.asyncio
    async def test_ticket_expires(self, db_session, monkeypatch):
        admin = await create_admin(db_session)
        ticket = ai_chat._issue_ws_ticket(admin, "chat-1")
        real_time = time.time
        monkeypatch.setattr(ai_chat.time, "time", lambda: real_time() + 31)
        assert await ai_chat._redeem_ws_ticket(ticket, "chat-1") is None

    @pytest.mark.asyncio
    async def test_tampered_ticket_rejected(self, db_session):
        admin = await create_admin(db_session)
        ticket = ai_chat._issue_ws_ticket(admin, "chat-1")
        payload, sig = ticket.split(".")
        other = ai_chat._issue_ws_ticket(admin, "chat-2")
        assert await ai_chat._redeem_ws_ticket(f"{other.split('.')[0]}.{sig}", "chat-2") is None
        assert await ai_chat._redeem_ws_ticket("garbage", "chat-1") is None

    @pytest.mark.asyncio
    async def test_ticket_endpoint(self, async_client, db_session):
        from backend.api.dependencies import get_current_admin
        from tests.conftest import get_app

        admin = await create_admin(db_session)
        chat = await _make_chat(db_session, admin)
        app = get_app()
        app.dependency_overrides[get_current_admin] = lambda: admin
        try:
            await self._check_ticket_endpoint(async_client, chat)
        finally:
            app.dependency_overrides.pop(get_current_admin, None)

    async def _check_ticket_endpoint(self, async_client, chat):
        headers = {"User-Agent": "Mozilla/5.0 test", "X-Session-Token": "s", "X-Admin-Token": "a"}
        response = await async_client.post(
            "/api/v1/admin/ai/ws-ticket", json={"session_id": chat.id}, headers=headers
        )
        assert response.status_code == 200, response.text
        assert response.json()["ticket"]

        response = await async_client.post(
            "/api/v1/admin/ai/ws-ticket", json={"session_id": "not-mine"}, headers=headers
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_ticket_endpoint_requires_auth(self, async_client):
        response = await async_client.post("/api/v1/admin/ai/ws-ticket", json={"session_id": "x"})
        assert response.status_code in (401, 403)


@pytest.mark.unit
@pytest.mark.admin
def test_websocket_handshake_through_admin_router(client):
    """The admin router's dependencies must not break the WebSocket upgrade."""
    with client.websocket_connect("/api/v1/admin/ai/ws/missing?ticket=bad") as ws:
        message = ws.receive_json()
    assert message["type"] == "error"
