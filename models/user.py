"""Modelo User — admin (dono), professional (barbeiro), client (cliente)."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime

from core.database import Base

class User(Base):
    """Modelo User."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="client")  # 'admin', 'professional', 'client'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))