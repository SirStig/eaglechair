"""
EagleChair Models Package

Import all models here for Alembic autogenerate support
"""

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
    CompanyStatus,
    AdminUser,
    AdminRole,
    AdminAuditLog,
)

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
)

# Quote and Cart models
from backend.models.quote import (
    Quote,
    QuoteStatus,
    QuoteItem,
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
    "CompanyStatus",
    "AdminUser",
    "AdminRole",
    "AdminAuditLog",
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
    # Quotes & Cart
    "Quote",
    "QuoteStatus",
    "QuoteItem",
    "Cart",
    "CartItem",
    "SavedConfiguration",
]
