"""Modelo Service — serviços oferecidos (Corte, Barba, etc.)."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric

from core.database import Base

class Service(Base):
    __tablename__ = 'services'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    duration_min = Column(Integer, nullable=False)       # duração em minutos
    price = Column(Numeric(10, 2), nullable=False)       # preço em R$
    description = Column(String(300), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))