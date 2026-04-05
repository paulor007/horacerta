"""Modelo Professional — vinculado a um User com role='professional'."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Time
from sqlalchemy.orm import relationship

from core.database import Base

class Professional(Base):
    __tablename__ = 'professionals'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    specialty = Column(String(100), nullable=True)
    bio = Column(String(500), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)  # 1 para ativo, 0 para inativo
    work_start = Column(Time, nullable=False)  # ex: 09:00
    work_end = Column(Time, nullable=False) # ex: 18:00
    work_days = Column(String(20), nullable=False) # ex: "1,2,3,4,5,6" (seg=1, sab=6)
    created_at = Column(DateTime, default=lambda:datetime.now(timezone.utc))

    user = relationship("User", backref="professional_profile")