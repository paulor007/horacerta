"""
Engine de disponibilidade — calcula horários livres.

Lógica:
1. Pega horário de trabalho do profissional (ex: 9h-18h)
2. Gera todos os slots possíveis com intervalo de 30min
3. Remove slots que conflitam com agendamentos existentes
4. Remove slots que ultrapassariam o horário de trabalho (considerando duração do serviço)
5. Retorna lista de slots com status (livre/ocupado)
"""

from datetime import date, time, timedelta, datetime
from sqlalchemy.orm import Session

from models.professional import Professional
from models.appointment import Appointment
from models.service import Service


def get_available_slots(
    db: Session,
    professional_id: int,
    target_date: date,
    service_id: int,
    interval_min: int = 30,
) -> list[dict]:
    """
    Retorna horários disponíveis para um profissional em uma data.

    Args:
        db: Sessão do banco
        professional_id: ID do profissional
        target_date: Data desejada
        service_id: ID do serviço (para saber duração)
        interval_min: Intervalo entre slots (padrão 30min)

    Returns:
        Lista de {"time": "09:00", "available": True/False}
    """
    # Buscar profissional
    prof = db.query(Professional).filter(Professional.id == professional_id).first()
    if not prof or not prof.is_active:
        return []

    # Verificar se profissional trabalha neste dia da semana
    weekday = target_date.isoweekday()  # 1=seg, 7=dom
    if str(weekday) not in prof.work_days.split(","):
        return []

    # Buscar serviço (para saber duração)
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        return []

    duration_min = service.duration_min

    # Buscar agendamentos existentes neste dia para este profissional
    existing = (
        db.query(Appointment)
        .filter(
            Appointment.professional_id == professional_id,
            Appointment.date == target_date,
            Appointment.status.in_(["scheduled", "confirmed"]),
        )
        .all()
    )

    # Gerar todos os slots possíveis
    slots = []
    current = datetime.combine(target_date, prof.work_start)
    work_end = datetime.combine(target_date, prof.work_end)

    while current + timedelta(minutes=duration_min) <= work_end:
        slot_start = current.time()
        slot_end = (current + timedelta(minutes=duration_min)).time()

        # Verificar conflito com agendamentos existentes
        conflict = False
        for apt in existing:
            # Conflito: o novo slot começa antes do fim de outro E termina depois do início
            if slot_start < apt.end_time and slot_end > apt.start_time:
                conflict = True
                break

        # Não permitir agendar no passado
        now = datetime.now()
        if target_date == now.date() and slot_start <= now.time():
            conflict = True

        slots.append({
            "time": slot_start.strftime("%H:%M"),
            "available": not conflict,
        })

        current += timedelta(minutes=interval_min)

    return slots


def check_conflict(
    db: Session,
    professional_id: int,
    target_date: date,
    start_time: time,
    end_time: time,
    exclude_appointment_id: int | None = None,
) -> bool:
    """
    Verifica se há conflito de horário.

    Returns:
        True se há conflito, False se está livre.
    """
    query = (
        db.query(Appointment)
        .filter(
            Appointment.professional_id == professional_id,
            Appointment.date == target_date,
            Appointment.status.in_(["scheduled", "confirmed"]),
            Appointment.start_time < end_time,
            Appointment.end_time > start_time,
        )
    )

    if exclude_appointment_id:
        query = query.filter(Appointment.id != exclude_appointment_id)

    return query.count() > 0