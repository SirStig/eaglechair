"""
EagleChair Models Package

Import all models here for Alembic autogenerate support
"""

# AI Chat models
from backend.models.ai_chat import (
    AIChatSession,
    AIChatMessage,
    AIMemory,
    AITrainingDocument,
    AIUploadedFile,
    AIProposedEdit,
)

# Legal models
from backend.models.legal import (
    LegalDocument,
    LegalDocumentType,
    WarrantyInformation,
    ShippingPolicy,
)

# Company and Admin models
from backend.models.company import (
    Company,
    CompanyShippingAddress,
    CompanyStatus,
    AdminUser,
    AdminRole,
    AdminAuditLog,
    AdminSession,
)
from backend.models.passkey import AdminPasskeyCredential

# Catalog Builder
from backend.models.catalog_project import CatalogProject

# Site analytics
from backend.models.analytics import AnalyticsEvent

# Product models
from backend.models.chair import (
    Category,
    Finish,
    Upholstery,
    Chair,
    ProductRelation,
)

# Content models
from backend.models.content import (
    TeamMember,
    CompanyInfo,
    FAQCategory,
    FAQ,
    Catalog,
    CatalogType,
    Installation,
    ContactLocation,
    Feedback,
    HeroSlide,
    ClientLogo,
    Testimonial,
    Feature,
    CompanyValue,
    CompanyMilestone,
    SalesRepresentative,
    SiteSettings,
    PageContent,
    EmailTemplate,
    MaterialSource,
)

# Quote and Cart models
from backend.models.quote import (
    Quote,
    QuoteStatus,
    QuoteItem,
    QuoteShippingDestination,
    QuoteItemAllocation,
    Cart,
    CartItem,
    SavedConfiguration,
)

__all__ = [
    # Legal
    "LegalDocument",
    "LegalDocumentType",
    "WarrantyInformation",
    "ShippingPolicy",
    # Company & Admin
    "Company",
    "CompanyShippingAddress",
    "CompanyStatus",
    "AdminUser",
    "AdminRole",
    "AdminAuditLog",
    "AdminSession",
    "AdminPasskeyCredential",
    # Products
    "Category",
    "Finish",
    "Upholstery",
    "Chair",
    "ProductRelation",
    # Content
    "TeamMember",
    "CompanyInfo",
    "FAQCategory",
    "FAQ",
    "Catalog",
    "CatalogType",
    "Installation",
    "ContactLocation",
    "Feedback",
    "HeroSlide",
    "ClientLogo",
    "Testimonial",
    "Feature",
    "CompanyValue",
    "CompanyMilestone",
    "SalesRepresentative",
    "SiteSettings",
    "PageContent",
    "EmailTemplate",
    "MaterialSource",
    # Quotes & Cart
    "Quote",
    "QuoteStatus",
    "QuoteItem",
    "QuoteShippingDestination",
    "QuoteItemAllocation",
    "Cart",
    "CartItem",
    "SavedConfiguration",
    # Catalog Builder
    "CatalogProject",
    # Site analytics
    "AnalyticsEvent",
]
