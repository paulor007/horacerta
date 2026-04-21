"""Modelo RecurringAppointment — agendamentos recorrentes."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Date, Time, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from core.database import Base


class RecurringAppointment(Base):
    """
    Agendamento recorrente.
    
    Exemplo: "A cada 14 dias (2 semanas), todo sábado às 10:00, corte + barba"
    
    interval_days: intervalo em dias entre agendamentos (7, 14, 21, 28)
    weekday: dia da semana (1=seg, 7=dom) — usado pra validar próximas datas
    start_date: primeira data da recorrência
    end_date: data limite (opcional — se None, roda indefinidamente)
    """
    __tablename__ = "recurring_appointments"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    professional_id = Column(Integer, ForeignKey("professionals.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    
    interval_days = Column(Integer, nullable=False)  # 7, 14, 21, 28
    weekday = Column(Integer, nullable=False)  # 1-7 (isoweekday)
    start_time = Column(Time, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # None = indefinido
    
    is_active = Column(Boolean, default=True)
    last_generated_date = Column(Date, nullable=True)  # última data já gerada
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    client = relationship("User", backref="recurring_appointments")
    professional = relationship("Professional", backref="recurring_appointments")
    service = relationship("Service", backref="recurring_appointments")