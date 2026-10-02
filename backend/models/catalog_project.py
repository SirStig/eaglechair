"""
Catalog Builder projects

A saved catalog layout: settings plus an ordered list of pages (see
backend/api/v1/schemas/catalog_builder.py for the document shape). Pages
refer to products / variations by id, so exports always use current data.
"""

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text

from backend.database.base import Base


class CatalogProject(Base):
    __tablename__ = "catalog_projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    document = Column(JSON, nullable=False, default=dict)

    created_by_id = Column(Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    last_exported_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<CatalogProject(id={self.id}, name={self.name})>"
