"""
Site analytics events

First-party, anonymous engagement tracking: page views, product views,
document downloads and searches. Visitors are identified only by random ids
generated in the browser (no IP address, no account link), so this table holds
no personal data.
"""

from sqlalchemy import Column, Index, Integer, String

from backend.database.base import Base


class AnalyticsEventType:
    PAGE_VIEW = "page_view"
    PRODUCT_VIEW = "product_view"
    DOWNLOAD = "download"
    SEARCH = "search"

    ALL = (PAGE_VIEW, PRODUCT_VIEW, DOWNLOAD, SEARCH)


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

    __table_args__ = (
        Index("ix_analytics_events_type_created", "event_type", "created_at"),
        Index("ix_analytics_events_created", "created_at"),
        Index("ix_analytics_events_product", "product_id", "event_type"),
    )

    def __repr__(self) -> str:
        return f"<AnalyticsEvent(id={self.id}, type={self.event_type}, path={self.path})>"
