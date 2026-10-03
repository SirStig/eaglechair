"""
Site analytics events

First-party, anonymous engagement tracking: page views, product views,
document downloads and searches. Visitors are identified only by random ids
generated in the browser (no IP address, no account link), so this table holds
no personal data.
"""

from sqlalchemy import Boolean, Column, Index, Integer, String

from backend.database.base import Base


class AnalyticsEventType:
    PAGE_VIEW = "page_view"
    PRODUCT_VIEW = "product_view"
    DOWNLOAD = "download"
    SEARCH = "search"
    # Quote funnel (accounts are off, so quotes are the conversion)
    CART_ADD = "cart_add"
    CART_REMOVE = "cart_remove"
    QUOTE_START = "quote_start"
    QUOTE_SUBMIT = "quote_submit"
    # Lead forms
    CONTACT_SUBMIT = "contact_submit"
    REP_SEARCH = "rep_search"
    # Interest signals
    MATERIAL_VIEW = "material_view"  # finish / upholstery / laminate / hardware opened
    PRODUCT_INTERACTION = "product_interaction"  # option picked, tab opened, image viewed
    CATALOG_READ = "catalog_read"  # catalog open in the PDF viewer (value = seconds)
    FILTER = "filter"  # catalog filter applied (label = "facet: value")
    # Time on page: value = visible seconds, depth = max scroll %
    ENGAGEMENT = "engagement"

    ALL = (
        PAGE_VIEW, PRODUCT_VIEW, DOWNLOAD, SEARCH,
        CART_ADD, CART_REMOVE, QUOTE_START, QUOTE_SUBMIT,
        CONTACT_SUBMIT, REP_SEARCH,
        MATERIAL_VIEW, PRODUCT_INTERACTION, CATALOG_READ, FILTER,
        ENGAGEMENT,
    )


# Columns added after the table first shipped; create_all() won't add them to
# an existing table, so database/base.py adds them at startup
ANALYTICS_ADDED_COLUMNS = {
    "value": "INTEGER",
    "depth": "INTEGER",
    "country": "VARCHAR(2)",
    "region": "VARCHAR(64)",
    "utm_source": "VARCHAR(100)",
    "utm_medium": "VARCHAR(100)",
    "utm_campaign": "VARCHAR(150)",
    "is_staff": "BOOLEAN NOT NULL DEFAULT FALSE",
}


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True)
    event_type = Column(String(32), nullable=False)

    # Anonymous browser ids: visitor persists in localStorage, session expires
    # after 30 minutes of inactivity
    visitor_id = Column(String(64), nullable=False)
    session_id = Column(String(64), nullable=False)

    path = Column(String(512), nullable=True)
    referrer = Column(String(255), nullable=True)  # external referrer host only
    device = Column(String(16), nullable=True)  # mobile | tablet | desktop

    # What the event is about: a product for product_view, a document for
    # download (product_id set when the file belongs to a product)
    product_id = Column(Integer, nullable=True)
    resource_type = Column(String(32), nullable=True)  # catalog, spec_sheet, cad, guide, image, ...
    resource_url = Column(String(512), nullable=True)
    label = Column(String(255), nullable=True)  # human-readable name / search query

    # Event-specific number: search result count, cart quantity, catalog
    # reading seconds, engaged seconds
    value = Column(Integer, nullable=True)
    depth = Column(Integer, nullable=True)  # engagement: max scroll depth, 0-100

    # Coarse location from the request (never the IP itself)
    country = Column(String(2), nullable=True)
    region = Column(String(64), nullable=True)

    # Campaign tags from the session's landing URL
    utm_source = Column(String(100), nullable=True)
    utm_medium = Column(String(100), nullable=True)
    utm_campaign = Column(String(150), nullable=True)

    # Sent from a browser logged into the admin panel; left out of reports
    # unless asked for
    is_staff = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index("ix_analytics_events_type_created", "event_type", "created_at"),
        Index("ix_analytics_events_created", "created_at"),
        Index("ix_analytics_events_product", "product_id", "event_type"),
        Index("ix_analytics_events_session", "session_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AnalyticsEvent(id={self.id}, type={self.event_type}, path={self.path})>"
