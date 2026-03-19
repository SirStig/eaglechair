from sqlalchemy import Column, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import relationship

from backend.database.base import Base


class AdminPasskeyCredential(Base):
    __tablename__ = "admin_passkey_credentials"

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)

    credential_id = Column(LargeBinary, unique=True, nullable=False, index=True)
    public_key = Column(LargeBinary, nullable=False)
    sign_count = Column(Integer, default=0, nullable=False)
    device_name = Column(String(255), nullable=True)
