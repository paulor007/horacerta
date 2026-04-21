"""Modelo MonthlySnapshot — resumo financeiro mensal preservado."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, Numeric, ForeignKey, UniqueConstraint

from core.database import Base


class MonthlySnapshot(Base):
    """
    Snapshot mensal — preservado mesmo após limpeza de histórico.
    
    Gerado automaticamente ao final de cada mês (ou manualmente pelo admin).
    Permite ver faturamento anual mesmo quando agendamentos antigos foram removidos.
    
    Um snapshot por (year, month, professional_id). Se professional_id=NULL,
    é o snapshot geral do mês (soma de todos os profissionais).
    """
    __tablename__ = "monthly_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False)  # 1-12
    professional_id = Column(Integer, ForeignKey("professionals.id"), nullable=True)

    # Totais
    total_completed = Column(Integer, default=0)  # atendimentos concluídos
    total_cancelled = Column(Integer, default=0)
    total_no_show = Column(Integer, default=0)
    total_revenue = Column(Numeric(10, 2), default=0)  # soma dos preços
    unique_clients = Column(Integer, default=0)

    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("year", "month", "professional_id", name="uq_snapshot_ymp"),
    )