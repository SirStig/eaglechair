"""
Media versions (admin Media Library)

Replacing or editing an uploaded image / document stores the new file under a
new URL (uploads are served as immutable, so a file is never overwritten in
place), points every record at it, and keeps the old file where it was as an
earlier version of the new one. One row per earlier version:

    url           the current file this is a version of (re-pointed on each
                  later replace, so a chain A -> B -> C lists A and B under C)
    version_url   the earlier file, still on disk at its own URL

Restoring a version swaps the two. Earlier versions are hidden from the
library lists unless a record still uses them.
"""

from sqlalchemy import Column, Index, Integer, String

from backend.database.base import Base


class MediaVersion(Base):
    __tablename__ = "media_versions"
    __table_args__ = (Index("ix_media_versions_url", "url"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(16), nullable=False, default="image")  # image | document
    url = Column(String(500), nullable=False)
    version_url = Column(String(500), nullable=False, unique=True)
    # replaced | edited | restored: how the version stopped being current
    action = Column(String(16), nullable=False, default="replaced")
    note = Column(String(255), nullable=True)
    admin_id = Column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<MediaVersion {self.version_url} -> {self.url}>"
