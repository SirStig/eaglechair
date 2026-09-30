"""
Test CMS Admin Routes

Integration tests for the admin-only CMS write endpoints (/cms-admin/*):
field persistence, URL validation, clearing fields, the `exported` flag,
static export output and uploaded-image cleanup.

Exports go to a per-test temp dir (see the static_export_dir fixture in
conftest.py), never into the repo.
"""

import json

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.content import (
    CompanyMilestone,
    CompanyValue,
    Feature,
    HeroSlide,
    Installation,
    TeamMember,
)
from backend.utils.static_content_exporter import StaticContentExporter
from tests.factories import create_chair

API = "/api/v1/cms-admin"


def _exported_content(frontend_dir) -> dict:
    with open(frontend_dir / "data" / "contentData.json", encoding="utf-8") as f:
        return json.load(f)


async def _get(db_session: AsyncSession, model, **filters):
    db_session.expire_all()
    result = await db_session.execute(select(model).filter_by(**filters))
    return result.scalar_one()


@pytest.mark.integration
@pytest.mark.cms
@pytest.mark.admin
class TestCMSAdminCreate:
    """Create endpoints persist every schema field."""

    @pytest.mark.asyncio
    async def test_create_hero_slide_persists_all_fields(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers, static_export_dir
    ):
        payload = {
            "title": "Crafted Seating",
            "subtitle": "Since 1984",
            "background_image_url": "/uploads/images/hero/slide.webp",
            "cta_text": "Explore",
            "cta_link": "/products",
            "cta_style": "outline",
            "secondary_cta_text": "Call us",
            "secondary_cta_link": "tel:+15555550100",
            "display_order": 4,
            "is_active": True,
        }
        response = await async_client.post(f"{API}/hero-slides", json=payload, headers=admin_headers)

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["exported"] is True
        assert "message" in body

        slide = await _get(db_session, HeroSlide, title="Crafted Seating")
        for key, value in payload.items():
            assert getattr(slide, key) == value, key

        exported = _exported_content(static_export_dir)["heroSlides"]
        assert exported == [
            {
                "id": slide.id,
                "title": "Crafted Seating",
                "subtitle": "Since 1984",
                "image": "/uploads/images/hero/slide.webp",
                "ctaText": "Explore",
                "ctaLink": "/products",
                "ctaStyle": "outline",
                "secondaryCtaText": "Call us",
                "secondaryCtaLink": "tel:+15555550100",
                "displayOrder": 4,
            }
        ]

    @pytest.mark.asyncio
    async def test_create_feature_persists_all_fields(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        payload = {
            "title": "Built to Last",
            "description": "Commercial-grade frames",
            "icon": "shield",
            "icon_color": "#8b7355",
            "image_url": "https://cdn.example.com/feature.jpg",
            "feature_type": "home_page",
            "display_order": 3,
            "is_active": False,
        }
        response = await async_client.post(f"{API}/features", json=payload, headers=admin_headers)

        assert response.status_code == 201, response.text
        assert response.json()["exported"] is True
        feature = await _get(db_session, Feature, title="Built to Last")
        for key, value in payload.items():
            assert getattr(feature, key) == value, key

    @pytest.mark.asyncio
    async def test_create_company_value_persists_all_fields(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        payload = {
            "title": "Integrity",
            "subtitle": "Always",
            "description": "We do what we say",
            "icon": "handshake",
            "image_url": "/uploads/images/values/integrity.webp",
            "display_order": 2,
            "is_active": False,
        }
        response = await async_client.post(f"{API}/company-values", json=payload, headers=admin_headers)

        assert response.status_code == 201, response.text
        value = await _get(db_session, CompanyValue, title="Integrity")
        for key, expected in payload.items():
            assert getattr(value, key) == expected, key

    @pytest.mark.asyncio
    async def test_create_team_member_persists_all_fields(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        payload = {
            "name": "Ana Lopez",
            "title": "Head of Design",
            "bio": "Designs chairs",
            "email": "ana@example.com",
            "phone": "555-0100",
            "photo_url": "/uploads/images/team/ana.webp",
            "linkedin_url": "https://www.linkedin.com/in/ana",
            "display_order": 5,
            "is_active": False,
            "is_featured": True,
        }
        response = await async_client.post(f"{API}/team-members", json=payload, headers=admin_headers)

        assert response.status_code == 201, response.text
        member = await _get(db_session, TeamMember, name="Ana Lopez")
        for key, value in payload.items():
            assert getattr(member, key) == value, key

    @pytest.mark.asyncio
    async def test_create_milestone_with_decade_year(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        payload = {
            "year": "1990s",
            "title": "National Expansion",
            "description": "Showrooms nationwide",
            "image_url": "/uploads/images/history/1990s.webp",
            "display_order": 1,
            "is_active": True,
        }
        response = await async_client.post(
            f"{API}/company-milestones", json=payload, headers=admin_headers
        )

        assert response.status_code == 201, response.text
        milestone = await _get(db_session, CompanyMilestone, title="National Expansion")
        for key, value in payload.items():
            assert getattr(milestone, key) == value, key

        public = await async_client.get("/api/v1/content/company-milestones")
        assert public.status_code == 200
        assert {"year": "1990s", "title": "National Expansion"}.items() <= public.json()[0].items()

    @pytest.mark.asyncio
    async def test_milestone_year_longer_than_column_rejected(
        self, async_client: AsyncClient, admin_headers
    ):
        response = await async_client.post(
            f"{API}/company-milestones",
            json={"year": "12345678901", "title": "Too long"},
            headers=admin_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_public_milestones_sorted_by_display_order_then_year(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        for year, order in (("2010", 0), ("1984", 1), ("1990s", 0)):
            db_session.add(
                CompanyMilestone(year=year, title=f"M {year}", description="", display_order=order)
            )
        await db_session.commit()

        response = await async_client.get("/api/v1/content/company-milestones")

        assert response.status_code == 200
        assert [m["year"] for m in response.json()] == ["1990s", "2010", "1984"]


@pytest.mark.integration
@pytest.mark.cms
class TestFeaturedProducts:

    @pytest.mark.asyncio
    async def test_featured_products_with_featured_chair(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        chair = await create_chair(
            db_session,
            is_featured=True,
            primary_image_url="/uploads/images/products/chair.webp",
            images=[{"url": "/uploads/images/products/chair.webp", "type": "side"}],
        )

        response = await async_client.get("/api/v1/content/featured-products")

        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == chair.id
        assert data[0]["modelNumber"] == chair.model_number
        assert data[0]["primaryImage"] == "/uploads/images/products/chair.webp"
        assert data[0]["isFeatured"] is True


@pytest.mark.integration
@pytest.mark.cms
@pytest.mark.admin
class TestInstallations:

    @pytest.mark.asyncio
    async def test_installation_images_round_trip(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers, static_export_dir
    ):
        images = ["/uploads/images/gallery/a.webp", "https://cdn.example.com/b.jpg"]
        response = await async_client.post(
            f"{API}/gallery",
            json={"project_name": "Bistro", "images": images, "project_type": "restaurant"},
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text

        installation = await _get(db_session, Installation, project_name="Bistro")
        assert installation.images == images  # stored as a list, not a JSON string

        updated = ["/uploads/images/gallery/c.webp"]
        response = await async_client.put(
            f"{API}/gallery/{installation.id}", json={"images": updated}, headers=admin_headers
        )
        assert response.status_code == 200, response.text
        installation = await _get(db_session, Installation, project_name="Bistro")
        assert installation.images == updated

        public = await async_client.get("/api/v1/content/installations?project_type=restaurant")
        assert public.status_code == 200
        assert public.json()[0]["images"] == updated

        exported = _exported_content(static_export_dir)["galleryImages"]
        assert exported[0]["images"] == updated

    @pytest.mark.asyncio
    async def test_legacy_double_encoded_images_are_decoded(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        db_session.add(
            Installation(project_name="Legacy", images=json.dumps(["/uploads/images/old.jpg"]))
        )
        await db_session.commit()

        response = await async_client.get("/api/v1/content/installations")

        assert response.status_code == 200
        legacy = next(i for i in response.json() if i["title"] == "Legacy")
        assert legacy["images"] == ["/uploads/images/old.jpg"]


@pytest.mark.integration
@pytest.mark.cms
@pytest.mark.admin
class TestCMSAdminUpdates:

    @pytest.mark.asyncio
    async def test_update_clears_nullable_field(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        slide = HeroSlide(
            title="Keep me",
            subtitle="Remove me",
            background_image_url="/uploads/images/hero/x.webp",
            cta_link="/about",
        )
        db_session.add(slide)
        await db_session.commit()

        response = await async_client.patch(
            f"{API}/hero-slides/{slide.id}",
            json={"subtitle": None, "cta_link": None, "title": None},
            headers=admin_headers,
        )

        assert response.status_code == 200, response.text
        slide = await _get(db_session, HeroSlide, id=slide.id)
        assert slide.subtitle is None
        assert slide.cta_link is None
        assert slide.title == "Keep me"  # NOT NULL column: None is ignored

    @pytest.mark.asyncio
    async def test_update_without_fields_rejected(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers
    ):
        slide = HeroSlide(title="T", background_image_url="/uploads/images/hero/x.webp")
        db_session.add(slide)
        await db_session.commit()

        response = await async_client.patch(
            f"{API}/hero-slides/{slide.id}", json={}, headers=admin_headers
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_site_settings_update_new_fields(
        self, async_client: AsyncClient, admin_headers, static_export_dir
    ):
        response = await async_client.patch(
            f"{API}/site-settings",
            json={
                "logo_dark_url": "/uploads/images/brand/logo-dark.webp",
                "favicon_url": "/favicon.ico",
                "meta_title": "Eagle Chair",
                "primary_email": "info@example.com",
                "facebook_url": "https://facebook.com/eaglechair",
            },
            headers=admin_headers,
        )

        assert response.status_code == 200, response.text
        settings = _exported_content(static_export_dir)["siteSettings"]
        assert settings["logoDarkUrl"] == "/uploads/images/brand/logo-dark.webp"
        assert settings["faviconUrl"] == "/favicon.ico"
        assert settings["metaTitle"] == "Eagle Chair"

    @pytest.mark.asyncio
    async def test_site_settings_invalid_email_rejected(
        self, async_client: AsyncClient, admin_headers
    ):
        response = await async_client.patch(
            f"{API}/site-settings", json={"sales_email": "not-an-email"}, headers=admin_headers
        )
        assert response.status_code == 422


@pytest.mark.integration
@pytest.mark.cms
@pytest.mark.admin
class TestCMSUrlPolicy:

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "path,payload",
        [
            ("hero-slides", {"title": "T", "background_image_url": "/x.webp", "cta_link": "javascript:alert(1)"}),
            ("hero-slides", {"title": "T", "background_image_url": "/x.webp", "secondary_cta_link": "//evil.example.com"}),
            ("hero-slides", {"title": "T", "background_image_url": "data:image/svg+xml;base64,AAAA"}),
            ("client-logos", {"name": "C", "logo_url": "/l.png", "website_url": "JavaScript:alert(1)"}),
            ("team-members", {"name": "N", "title": "T", "linkedin_url": " javascript:alert(1)"}),
        ],
    )
    async def test_unsafe_urls_rejected(
        self, async_client: AsyncClient, admin_headers, path, payload
    ):
        response = await async_client.post(f"{API}/{path}", json=payload, headers=admin_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_unsafe_social_url_rejected(self, async_client: AsyncClient, admin_headers):
        response = await async_client.patch(
            f"{API}/site-settings", json={"facebook_url": "javascript:alert(1)"}, headers=admin_headers
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_allowed_link_forms_accepted(self, async_client: AsyncClient, admin_headers):
        for link in ("", "/products", "https://example.com/x", "mailto:sales@example.com", "tel:+15555550100"):
            response = await async_client.post(
                f"{API}/hero-slides",
                json={"title": f"T {link}", "background_image_url": "/uploads/images/h.webp", "cta_link": link},
                headers=admin_headers,
            )
            assert response.status_code == 201, (link, response.text)

    @pytest.mark.asyncio
    async def test_invalid_page_slug_rejected(self, async_client: AsyncClient, admin_headers):
        response = await async_client.patch(
            f"{API}/page-content/Bad.Slug/hero", json={"title": "x"}, headers=admin_headers
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_content_clear_and_export(
        self, async_client: AsyncClient, admin_headers, static_export_dir
    ):
        response = await async_client.patch(
            f"{API}/page-content/home/installation_gallery",
            json={"title": "Gallery", "subtitle": "Sub"},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["exported"] is True

        response = await async_client.patch(
            f"{API}/page-content/home/installation_gallery",
            json={"subtitle": None},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["title"] == "Gallery"
        assert data["subtitle"] is None


@pytest.mark.integration
@pytest.mark.cms
@pytest.mark.admin
class TestCMSExportFlag:

    @pytest.mark.asyncio
    async def test_exported_false_when_export_fails(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers, monkeypatch
    ):
        def fail(*args, **kwargs):
            raise OSError("disk full")

        monkeypatch.setattr(StaticContentExporter, "write_sections", fail)

        response = await async_client.post(
            f"{API}/features", json={"title": "Saved anyway", "description": "d"}, headers=admin_headers
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["exported"] is False
        assert "publishing to the live site failed" in body["message"]
        # The DB write still happened
        await _get(db_session, Feature, title="Saved anyway")

        response = await async_client.post(f"{API}/export-all", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["exported"] is False

    @pytest.mark.asyncio
    async def test_export_all_writes_every_section_once(
        self, async_client: AsyncClient, admin_headers, static_export_dir
    ):
        response = await async_client.post(f"{API}/export-all", headers=admin_headers)

        assert response.status_code == 200, response.text
        assert response.json()["exported"] is True
        content = _exported_content(static_export_dir)
        for key in ("siteSettings", "heroSlides", "galleryImages", "companyMilestones", "categories", "_metadata"):
            assert key in content
        assert "legalDocuments" not in content
        assert (static_export_dir / "data" / "legalDocuments.json").exists()
        assert not (static_export_dir / "data" / ".contentData.json").exists()


@pytest.mark.integration
@pytest.mark.cms
@pytest.mark.admin
class TestCMSUploadCleanup:

    @pytest.mark.asyncio
    async def test_delete_removes_unreferenced_upload_only(
        self, async_client: AsyncClient, db_session: AsyncSession, admin_headers, tmp_path, monkeypatch
    ):
        from backend.api.v1.routes.admin import upload

        monkeypatch.setattr(upload, "UPLOAD_BASE_DIR", tmp_path)
        image_dir = tmp_path / "images" / "cms"
        image_dir.mkdir(parents=True)
        own = image_dir / "own.webp"
        shared = image_dir / "shared.webp"
        own.write_bytes(b"x")
        shared.write_bytes(b"x")

        slide = HeroSlide(title="A", background_image_url="/uploads/images/cms/own.webp")
        other = HeroSlide(title="B", background_image_url="/uploads/images/cms/shared.webp")
        member = TeamMember(name="N", title="T", photo_url="/uploads/images/cms/shared.webp")
        db_session.add_all([slide, other, member])
        await db_session.commit()

        response = await async_client.delete(f"{API}/hero-slides/{slide.id}", headers=admin_headers)
        assert response.status_code == 200, response.text
        assert not own.exists()

        response = await async_client.delete(f"{API}/hero-slides/{other.id}", headers=admin_headers)
        assert response.status_code == 200, response.text
        assert shared.exists()  # still used by the team member

        response = await async_client.patch(
            f"{API}/team-members/{member.id}",
            json={"photo_url": "https://cdn.example.com/new.jpg"},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        assert not shared.exists()  # replaced and no longer referenced


@pytest.mark.integration
@pytest.mark.cms
@pytest.mark.auth
class TestCMSAdminAuth:

    @pytest.mark.asyncio
    async def test_company_token_rejected(self, async_client: AsyncClient, company_token):
        response = await async_client.post(
            f"{API}/hero-slides",
            json={"title": "Nope", "background_image_url": "/x.webp"},
            headers={"Authorization": f"Bearer {company_token}"},
        )
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_unauthenticated_rejected(self, async_client: AsyncClient):
        response = await async_client.post(f"{API}/export-all")
        assert response.status_code in (401, 403)
