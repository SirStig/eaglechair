"""
Catalog Builder schemas

A catalog document is {"settings": {...}, "pages": [...]}. Pages are one of
cover / toc / product / gallery / photo (see
backend/services/catalog_pdf/layouts.py for how each is drawn); fields a page
type does not use are ignored. Items point at a product and/or variation;
dx / dy / scale are the editor's photo adjustments in PDF points.
"""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.services.catalog_pdf.data import new_page_id
from backend.services.catalog_pdf.renderer import DEFAULT_COPYRIGHT

PageType = Literal["cover", "toc", "product", "gallery", "photo"]
Emblem = Literal["none", "flag", "made_in_usa"]

_TEXT = 2000
_LINE = 200


class CatalogItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    product_id: Optional[int] = None
    variation_id: Optional[int] = None
    image_url: Optional[str] = Field(None, max_length=500)
    caption: Optional[str] = Field(None, max_length=300)
    show_specs: bool = True
    dx: float = Field(0, ge=-612, le=612)
    dy: float = Field(0, ge=-792, le=792)
    scale: float = Field(1, ge=0.2, le=4)


class CatalogPage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_page_id, max_length=64)
    type: PageType
    title: str = Field("", max_length=_LINE)
    subtitle: str = Field("", max_length=_LINE)
    toc_label: Optional[str] = Field(None, max_length=_LINE)
    include_in_toc: bool = True
    items: list[CatalogItem] = Field(default_factory=list, max_length=8)

    # product page panel
    features: str = Field("", max_length=_TEXT)
    materials: str = Field("", max_length=_TEXT)
    environmental: str = Field("", max_length=_TEXT)
    standard: str = Field("", max_length=_TEXT)
    options: str = Field("", max_length=_TEXT)
    ip_text: str = Field("", max_length=_LINE)
    emblem: Emblem = "none"

    # gallery / toc banner, cover taglines
    tagline: str = Field("", max_length=_TEXT)
    tagline_right: str = Field("", max_length=_LINE)
    year: str = Field("", max_length=20)
    website: str = Field("", max_length=_LINE)

    # photo page
    image_url: Optional[str] = Field(None, max_length=500)
    caption: str = Field("", max_length=_TEXT)
    dx: float = Field(0, ge=-612, le=612)
    dy: float = Field(0, ge=-792, le=792)
    scale: float = Field(1, ge=0.2, le=4)
    show_footer: bool = False


class CatalogSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field("", max_length=_LINE)
    copyright: str = Field(DEFAULT_COPYRIGHT, max_length=300)
    page_numbers: bool = True


class CatalogDocument(BaseModel):
    settings: CatalogSettings = Field(default_factory=CatalogSettings)
    pages: list[CatalogPage] = Field(default_factory=list, max_length=500)


class CatalogProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=_TEXT)
    document: Optional[CatalogDocument] = None


class CatalogProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=_TEXT)
    document: Optional[CatalogDocument] = None


class PreviewRequest(BaseModel):
    document: CatalogDocument
    page_index: int = Field(0, ge=0)
    dpi: int = Field(110, ge=40, le=200)


class ExportRequest(BaseModel):
    document: CatalogDocument
    filename: Optional[str] = Field(None, max_length=120)
    project_id: Optional[int] = None


class SuggestPagesRequest(BaseModel):
    family_ids: list[int] = Field(default_factory=list, max_length=200)
    product_ids: list[int] = Field(default_factory=list, max_length=500)
    include_gallery: bool = True
