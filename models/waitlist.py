"""Modelo Waitlist — lista de espera inteligente."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from core.database import Base


class Waitlist(Base):
    __tablename__ = "waitlist"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    professional_id = Column(Integer, ForeignKey("professionals.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    notified = Column(Boolean, default=False)
    notified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    client = relationship("User", backref="waitlist_entries")
    professional = relationship("Professional", backref="waitlist_entries")
    service = relationship("Service", backref="waitlist_entries")