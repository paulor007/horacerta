"""Modelo SystemSettings — configurações globais do sistema."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, Boolean

from core.database import Base


class SystemSettings(Base):
    """
    Configurações do sistema (singleton — só uma linha).
    
    cleanup_days: quantos dias manter histórico antes de apagar automaticamente
                  (1=diário, 7=semanal, 15=quinzenal, 30=mensal, 90=padrão)
    cleanup_enabled: se a limpeza automática está ativa
    """
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    cleanup_days = Column(Integer, default=90)
    cleanup_enabled = Column(Boolean, default=False)
    last_cleanup_at = Column(DateTime, nullable=True)
    last_cleanup_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))