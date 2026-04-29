"""Modelo SystemSettings — configurações globais do sistema."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, Boolean

from core.database import Base


class SystemSettings(Base):
    """
    Configurações do sistema (singleton — só uma linha).

    Limpeza automática:
    - cleanup_days: quantos dias manter histórico antes de apagar
    - cleanup_enabled: se a limpeza automática está ativa

    Política de agendamento (cliente público):
    - max_active_appointments: agendamentos ativos por cliente (default 1)
    - min_days_between_bookings: dias mínimos entre agendamentos (default 15)
    - client_cancel_hours: até quantas horas antes cliente pode cancelar (default 24)
    """
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Limpeza automática
    cleanup_days = Column(Integer, default=90)
    cleanup_enabled = Column(Boolean, default=False)
    last_cleanup_at = Column(DateTime, nullable=True)
    last_cleanup_count = Column(Integer, default=0)

    # Política de agendamento (NOVOS)
    max_active_appointments = Column(Integer, default=1)
    min_days_between_bookings = Column(Integer, default=15)
    client_cancel_hours = Column(Integer, default=24)

    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))