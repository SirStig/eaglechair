"""
EagleChair Legal Information Models

Models for storing legal documents, policies, terms, and warranties
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, Enum as SQLEnum
import enum

from backend.database.base import Base


class LegalDocumentType(str, enum.Enum):
    """Legal document type enumeration"""
    PRICE_LIST = "price_list"
    DIMENSIONS_SIZES = "dimensions_sizes"
    ORDERS = "orders"
    COM_COL_ORDERS = "com_col_orders"
    MINIMUM_ORDER = "minimum_order"
    PAYMENTS = "payments"
    TERMS = "terms"
    TAXES = "taxes"
    LEGAL_COSTS = "legal_costs"
    QUOTATIONS = "quotations"
    WARRANTY = "warranty"
    FLAMMABILITY = "flammability"
    CUSTOM_FINISHES = "custom_finishes"
    PARTIAL_SHIPMENTS = "partial_shipments"
    STORAGE = "storage"
    RETURNS = "returns"
    CANCELLATIONS = "cancellations"
    MAINTENANCE = "maintenance"
    SPECIAL_SERVICE = "special_service"
    SHIPMENTS_DAMAGE = "shipments_damage"
    FREIGHT_CLASSIFICATION = "freight_classification"
    IP_DISCLAIMER = "ip_disclaimer"
    IP_ASSIGNMENT = "ip_assignment"
    CONDITIONS_OF_SALE = "conditions_of_sale"
    PRIVACY_POLICY = "privacy_policy"
    OTHER = "other"


class LegalDocument(Base):
    """
    Legal documents and policies model
    Stores all legal information, terms, conditions, warranties, etc.
    """
    __tablename__ = "legal_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    document_type = Column(SQLEnum(LegalDocumentType), nullable=False, index=True, unique=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    short_description = Column(Text, nullable=True)
    
    # Display options
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    
    # Version control
    version = Column(String(20), default="1.0", nullable=False)
    effective_date = Column(String(50), nullable=True)
    
    # SEO
    slug = Column(String(255), unique=True, index=True, nullable=False)
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    
    def __repr__(self) -> str:
        return f"<LegalDocument(id={self.id}, type={self.document_type}, title={self.title})>"


class WarrantyInformation(Base):
    """
    Detailed warranty information model
    """
    __tablename__ = "warranty_information"
    
    id = Column(Integer, primary_key=True, index=True)
    warranty_type = Column(String(100), nullable=False)  # e.g., "Limited Warranty", "Extended"
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    duration = Column(String(100), nullable=True)  # e.g., "5 years", "Lifetime"
    coverage = Column(Text, nullable=True)
    exclusions = Column(Text, nullable=True)
    claim_process = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        return f"<WarrantyInformation(id={self.id}, type={self.warranty_type})>"


class ShippingPolicy(Base):
    """
    Shipping and freight policies
    """
    __tablename__ = "shipping_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    policy_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    freight_classification = Column(String(100), nullable=True)
    shipping_timeframe = Column(String(100), nullable=True)
    special_instructions = Column(Text, nullable=True)
    damage_claim_process = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<ShippingPolicy(id={self.id}, name={self.policy_name})>"

