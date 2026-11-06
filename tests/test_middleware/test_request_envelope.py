"""Packed write bodies are restored before the application reads them."""

import json

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from backend.core.middleware.request_envelope import RequestEnvelopeMiddleware
from backend.core.request_envelope import FORM_PREFIX

ST_LOUIS = 'Heights 28.25"; and 40.25"; for St. Louis table bases.'


def _envelope(payload: dict) -> dict:
    raw = json.dumps(payload).encode()
    return {"_ec": 1, "body": raw.hex()}


@pytest.fixture
def envelope_app():
    app = FastAPI()
    app.add_middleware(RequestEnvelopeMiddleware)

    @app.post("/echo")
    async def echo(request: Request):
        return json.loads(await request.body())

    @app.post("/form")
    async def form(request: Request):
        parsed = await request.form()
        upload = parsed.get("file")
        file_bytes = await upload.read() if upload is not None and hasattr(upload, "read") else None
        return {"description": parsed.get("description"), "file": file_bytes.decode() if file_bytes else None}

    return app


@pytest.mark.asyncio
async def test_packed_json_is_restored(envelope_app):
    payload = {"description": ST_LOUIS, "overview_text": ST_LOUIS}
    async with AsyncClient(transport=ASGITransport(app=envelope_app), base_url="http://test") as client:
        response = await client.post("/echo", json=_envelope(payload))
    assert response.status_code == 200
    assert response.json() == payload


@pytest.mark.asyncio
async def test_plain_json_is_unchanged(envelope_app):
    payload = {"description": ST_LOUIS}
    async with AsyncClient(transport=ASGITransport(app=envelope_app), base_url="http://test") as client:
        response = await client.post("/echo", json=payload)
    assert response.status_code == 200
    assert response.json() == payload


@pytest.mark.asyncio
async def test_bad_packed_body_is_rejected(envelope_app):
    async with AsyncClient(transport=ASGITransport(app=envelope_app), base_url="http://test") as client:
        response = await client.post("/echo", json={"_ec": 1, "body": "zz"})
    assert response.status_code == 400
    assert response.json()["error"] == "INVALID_REQUEST"


@pytest.mark.asyncio
async def test_packed_form_text_is_restored_and_file_kept(envelope_app):
    async with AsyncClient(transport=ASGITransport(app=envelope_app), base_url="http://test") as client:
        response = await client.post(
            "/form",
            data={"description": FORM_PREFIX + ST_LOUIS.encode().hex()},
            files={"file": ("catalog.pdf", b"%PDF-1.4", "application/pdf")},
        )
    assert response.status_code == 200
    assert response.json() == {"description": ST_LOUIS, "file": "%PDF-1.4"}
