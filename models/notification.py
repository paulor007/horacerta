"""Modelo Notification — registra lembretes enviados."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    type = Column(String(30), nullable=False)     # reminder, confirmation, cancellation
    channel = Column(String(20), nullable=False)   # email, whatsapp
    status = Column(String(20), nullable=False, default="pending")  # pending, sent, failed
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))