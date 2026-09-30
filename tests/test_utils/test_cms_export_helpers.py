"""
Unit tests for CMS export helpers: URL validators, the Redis-backed export
lock, JSON list parsing and atomic content writes.
"""

import asyncio
import json

import pytest

from backend.core import redis_lock as redis_lock_module
from backend.core.redis_lock import RELEASE_LOCK_SCRIPT, REFRESH_LOCK_SCRIPT, redis_lock
from backend.utils.serializers import parse_json_list
from backend.utils.static_content_exporter import StaticContentExporter
from backend.utils.validators import validate_cms_image_url, validate_cms_link


class FakeRedis:
    """Minimal async Redis stand-in for SET NX PX and the lock Lua scripts."""

    def __init__(self):
        self.store = {}

    async def set(self, key, value, nx=False, px=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def eval(self, script, numkeys, key, token, *args):
        if self.store.get(key) != token:
            return 0
        if script == RELEASE_LOCK_SCRIPT:
            del self.store[key]
        elif script != REFRESH_LOCK_SCRIPT:
            raise AssertionError("unexpected script")
        return 1


class BrokenRedis:
    async def set(self, *args, **kwargs):
        raise ConnectionError("redis down")


@pytest.mark.unit
class TestCMSUrlValidators:

    @pytest.mark.parametrize(
        "value",
        ["", "/products", "/", "https://example.com/a?b=c", "HTTP://EXAMPLE.COM",
         "mailto:sales@example.com", "tel:+15555550100"],
    )
    def test_allowed_links(self, value):
        assert validate_cms_link(value) == value.strip()

    @pytest.mark.parametrize(
        "value",
        ["javascript:alert(1)", " JavaScript:alert(1)", "java\tscript:alert(1)",
         "data:text/html,<script>", "//evil.example.com", "/\\evil.example.com",
         "products", "https://", "mailto:", "vbscript:x"],
    )
    def test_rejected_links(self, value):
        with pytest.raises(ValueError):
            validate_cms_link(value)

    @pytest.mark.parametrize(
        "value",
        ["", "/uploads/images/hero/a.webp", "uploads/images/a.png", "/assets/logo.png",
         "https://images.unsplash.com/photo?w=1920"],
    )
    def test_allowed_images(self, value):
        assert validate_cms_image_url(value) == value

    @pytest.mark.parametrize(
        "value",
        ["javascript:alert(1)", "data:image/svg+xml;base64,AAAA", "//evil.example.com/x.png",
         "\\\\evil\\x.png"],
    )
    def test_rejected_images(self, value):
        with pytest.raises(ValueError):
            validate_cms_image_url(value)


@pytest.mark.unit
class TestParseJsonList:

    @pytest.mark.parametrize(
        "value,expected",
        [
            (None, []),
            ("", []),
            (["/a.jpg"], ["/a.jpg"]),
            ('["/a.jpg", "/b.jpg"]', ["/a.jpg", "/b.jpg"]),
            (json.dumps(json.dumps(["/a.jpg"])), ["/a.jpg"]),
            ("/single.jpg", ["/single.jpg"]),
            ('{"not": "a list"}', []),
        ],
    )
    def test_parse(self, value, expected):
        assert parse_json_list(value) == expected


@pytest.mark.unit
class TestRedisLock:

    @pytest.mark.asyncio
    async def test_acquires_and_releases(self, monkeypatch):
        fake = FakeRedis()
        monkeypatch.setattr(redis_lock_module, "_get_client", lambda: fake)

        async with redis_lock("k", asyncio.Lock()) as held:
            assert held is True
            assert "k" in fake.store
        assert "k" not in fake.store

    @pytest.mark.asyncio
    async def test_does_not_release_lock_owned_by_someone_else(self, monkeypatch):
        fake = FakeRedis()
        monkeypatch.setattr(redis_lock_module, "_get_client", lambda: fake)

        async with redis_lock("k", asyncio.Lock()):
            # Our lock expired and another worker took it
            fake.store["k"] = "other-worker"
        assert fake.store["k"] == "other-worker"

    @pytest.mark.asyncio
    async def test_waits_for_holder_then_times_out_without_failing(self, monkeypatch):
        fake = FakeRedis()
        fake.store["k"] = "other-worker"
        monkeypatch.setattr(redis_lock_module, "_get_client", lambda: fake)

        async with redis_lock("k", asyncio.Lock(), wait_timeout=0.1) as held:
            assert held is False
        assert fake.store["k"] == "other-worker"

    @pytest.mark.asyncio
    async def test_falls_back_to_local_lock_when_redis_down(self, monkeypatch):
        monkeypatch.setattr(redis_lock_module, "_get_client", lambda: BrokenRedis())
        monkeypatch.setattr(redis_lock_module, "_redis_down_until", 0.0)

        async with redis_lock("k", asyncio.Lock()) as held:
            assert held is False


@pytest.mark.unit
class TestExporterWrites:

    def test_write_sections_merges_and_is_atomic(self, tmp_path):
        exporter = StaticContentExporter(frontend_path=str(tmp_path))
        (exporter.data_dir / ".contentData.json").write_text("{}")  # legacy backup

        exporter.write_sections({"heroSlides": [1], "faqs": [2]})
        exporter.write_sections({"faqs": [3]}, exporter.load_existing_content())

        content = exporter.load_existing_content()
        assert content == {"heroSlides": [1], "faqs": [3]}
        leftovers = [p.name for p in exporter.data_dir.iterdir() if p.name != "contentData.json"]
        assert leftovers == []

    def test_legal_documents_go_to_their_own_file(self, tmp_path):
        exporter = StaticContentExporter(frontend_path=str(tmp_path))
        exporter.write_sections({"faqs": [], "legalDocuments": [{"id": 1}]})

        assert "legalDocuments" not in exporter.load_existing_content()
        legal = json.loads((exporter.data_dir / "legalDocuments.json").read_text())
        assert legal["legalDocuments"] == [{"id": 1}]

    def test_unreadable_file_reports_none(self, tmp_path):
        exporter = StaticContentExporter(frontend_path=str(tmp_path))
        exporter.content_file.write_text("{not json")
        assert exporter.load_existing_content() is None
