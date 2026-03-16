"""
AI Chat Models

Database models for the admin AI chat feature:
- AIChatSession: A conversation session
- AIChatMessage: Individual messages in a session
- AIMemory: Persistent AI memory across sessions
- AITrainingDocument: Documents used for AI training/RAG
- AIUploadedFile: Files uploaded by admin for AI to analyze
"""

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
    JSON,
    LargeBinary,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from backend.database.base import Base


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class TrainingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AIFileType(str, enum.Enum):
    PDF = "pdf"
    CSV = "csv"
    IMAGE = "image"
    TEXT = "text"
    EXCEL = "excel"
    OTHER = "other"


class AIChatSession(Base):
    """A chat session between the admin and AI. Scoped per admin user."""

    __tablename__ = "ai_chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    admin_user_id = Column(Integer, ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=True, index=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    message_count = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    pinned = Column(Boolean, default=False, nullable=False)
    tags = Column(JSON, default=list)

    # Relationships
    messages = relationship(
        "AIChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AIChatMessage.created_at",
    )
    files = relationship(
        "AIUploadedFile",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class AIChatMessage(Base):
    """A single message in an AI chat session"""

    __tablename__ = "ai_chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Metadata
    tokens_used = Column(Integer, default=0)
    model_used = Column(String(100), nullable=True)

    # Research / tool call metadata stored as JSON
    tool_calls = Column(JSON, default=list)  # List of tool calls made
    web_sources = Column(JSON, default=list)  # Web sources referenced
    suggested_edits = Column(JSON, default=list)  # Edits proposed by AI, pending admin approval
    thinking_summary = Column(Text, nullable=True)  # Summary of thinking process

    # File attachments
    file_ids = Column(JSON, default=list)  # List of AIUploadedFile IDs

    # Relationships
    session = relationship("AIChatSession", back_populates="messages")


class AIMemory(Base):
    """Persistent AI memory that persists across chat sessions. Scoped per admin user."""

    __tablename__ = "ai_memory"
    __table_args__ = (UniqueConstraint("admin_user_id", "key", name="uq_ai_memory_admin_key"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_user_id = Column(Integer, ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=True, index=True)
    key = Column(String(255), nullable=False, index=True)
    value = Column(Text, nullable=False)
    category = Column(String(100), default="general")
    importance = Column(Float, default=0.5)  # 0.0 to 1.0
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    source_session_id = Column(String(36), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class AITrainingDocument(Base):
    """Documents used for training the AI (RAG-style knowledge base)"""

    __tablename__ = "ai_training_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_type = Column(Enum(AIFileType), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=True)
    file_size = Column(Integer, nullable=True)  # bytes

    # Processed content
    status = Column(Enum(TrainingStatus), default=TrainingStatus.PENDING, nullable=False)
    processed_content = Column(Text, nullable=True)  # Markdown/text version
    summary = Column(Text, nullable=True)  # AI-generated summary
    key_facts = Column(JSON, default=list)  # AI-extracted key facts (retain all)
    structured_data = Column(Text, nullable=True)  # Full tables/pricing in markdown
    embeddings_count = Column(Integer, default=0)  # Number of chunks stored

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    # Error info
    error_message = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    is_active = Column(Boolean, default=True, nullable=False)


class AIUploadedFile(Base):
    """Files uploaded by admin during a chat session for AI to analyze"""

    __tablename__ = "ai_uploaded_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(Enum(AIFileType), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(200), nullable=True)

    # Processed content cached here
    processed_content = Column(Text, nullable=True)
    is_processed = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    session = relationship("AIChatSession", back_populates="files")
