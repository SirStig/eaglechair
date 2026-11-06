"""Decode catalog writes that were packed so DreamHost's firewall can pass them.

ModSecurity (HTTP 418) scores quote-and-semicolon catalog text such as 28.25";
as SQL injection, and DreamHost does not allow per-rule exceptions. The browser
sends the real JSON as hex, which cannot contain those characters. This module
turns that packing back into the original body before routing.
"""

from __future__ import annotations

import json
import secrets
from typing import Optional

from starlette.datastructures import Headers, UploadFile
from starlette.formparsers import MultiPartParser

ENVELOPE_VERSION = 1
FORM_PREFIX = "echex1:"
HEX_DIGITS = frozenset("0123456789abcdefABCDEF")
MAX_JSON_BYTES = 10 * 1024 * 1024
MAX_PART_BYTES = 1024 * 1024 * 1024


class EnvelopeError(ValueError):
    """The body claimed to be a packed request and could not be read."""


def _is_hex(value: str) -> bool:
    return len(value) % 2 == 0 and all(char in HEX_DIGITS for char in value)


def decode_hex_text(value: str) -> bytes:
    if not _is_hex(value):
        raise EnvelopeError("packed body is not hex")
    if len(value) // 2 > MAX_JSON_BYTES:
        raise EnvelopeError("packed body is too large")
    return bytes.fromhex(value)


def unwrap_json_body(body: bytes) -> Optional[bytes]:
    """Return the original JSON bytes, or None when this is a normal body."""
    stripped = body.lstrip()
    if not stripped.startswith(b"{") and not stripped.startswith(b"["):
        return None
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict) or set(payload) != {"_ec", "body"}:
        return None
    if payload.get("_ec") != ENVELOPE_VERSION or not isinstance(payload.get("body"), str):
        raise EnvelopeError("unsupported packed body")
    return decode_hex_text(payload["body"])


def decode_form_text(value: str) -> str:
    if not isinstance(value, str) or not value.startswith(FORM_PREFIX):
        return value
    raw = decode_hex_text(value[len(FORM_PREFIX):])
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise EnvelopeError("packed field is not utf-8") from exc


def _quote_disposition(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _boundary_for(chunks: list[bytes]) -> str:
    for _ in range(8):
        boundary = "ec" + secrets.token_hex(16)
        raw = boundary.encode("ascii")
        if all(raw not in chunk for chunk in chunks):
            return boundary
    raise EnvelopeError("could not pack multipart body")


async def unwrap_multipart_body(body: bytes, content_type: str) -> tuple[bytes, str]:
    """Rebuild a multipart body with packed text fields restored."""

    async def chunks():
        yield body

    parser = MultiPartParser(
        Headers({"content-type": content_type}),
        chunks(),
        max_part_size=MAX_PART_BYTES,
    )
    try:
        form = await parser.parse()
    except Exception as exc:
        raise EnvelopeError("could not read multipart body") from exc

    parts: list[bytes] = []
    try:
        for name, value in form.multi_items():
            if isinstance(value, str):
                data = decode_form_text(value).encode("utf-8")
                header = (
                    f'Content-Disposition: form-data; name="{_quote_disposition(name)}"\r\n\r\n'
                ).encode("utf-8")
                parts.append(header + data)
                continue
            if not isinstance(value, UploadFile):
                continue
            file_bytes = await value.read()
            filename = _quote_disposition(value.filename or "upload")
            file_type = value.content_type or "application/octet-stream"
            header = (
                f'Content-Disposition: form-data; name="{_quote_disposition(name)}"; '
                f'filename="{filename}"\r\n'
                f"Content-Type: {file_type}\r\n\r\n"
            ).encode("utf-8")
            parts.append(header + file_bytes)
    finally:
        for _name, value in form.multi_items():
            if isinstance(value, UploadFile):
                await value.close()

    boundary = _boundary_for(parts)
    raw_boundary = boundary.encode("ascii")
    built = bytearray()
    for part in parts:
        built.extend(b"--" + raw_boundary + b"\r\n")
        built.extend(part)
        built.extend(b"\r\n")
    built.extend(b"--" + raw_boundary + b"--\r\n")
    return bytes(built), f"multipart/form-data; boundary={boundary}"
