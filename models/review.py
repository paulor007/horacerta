"""Modelo Review — avaliação pós-atendimento."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import relationship

from core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    professional_id = Column(Integer, ForeignKey("professionals.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1 a 5
    comment = Column(Text, nullable=True)
    token = Column(String(64), unique=True, nullable=False, index=True)  # token público para avaliar
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating"),
    )

    appointment = relationship("Appointment", backref="review")
    client = relationship("User", backref="reviews_given")
    professional = relationship("Professional", backref="reviews_received")