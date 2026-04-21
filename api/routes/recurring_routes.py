"""
Endpoints de agendamento recorrente.

Fluxo:
1. Cliente configura recorrência (a cada X dias, dia da semana, horário, serviço)
2. Sistema gera os próximos N agendamentos automaticamente
3. Cliente pode pausar/cancelar a recorrência a qualquer momento
4. Task periódica gera novos agendamentos quando falta 30 dias
"""

import logging
from datetime import date as date_type
from datetime import time as time_type
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from api.deps import get_current_user
from models.user import User
from models.professional import Professional
from models.service import Service
from models.appointment import Appointment
from models.recurring import RecurringAppointment
from services.availability import check_conflict

logger = logging.getLogger(__name__)


def _naive_time(t: time_type) -> time_type:
    """Remove timezone de um time (se tiver) para evitar comparação tz-aware vs tz-naive."""
    if t.tzinfo is not None:
        return t.replace(tzinfo=None)
    return t

router = APIRouter(prefix="/api/v1/recurring", tags=["Agendamento Recorrente"])


# ── Schemas ──

class RecurringCreate(BaseModel):
    professional_id: int
    service_id: int
    interval_days: int  # 7, 14, 21, 28
    weekday: int  # 1-7 (isoweekday)
    start_time: time_type
    start_date: date_type
    end_date: date_type | None = None

    @field_validator("interval_days")
    @classmethod
    def valid_interval(cls, v: int) -> int:
        if v not in (7, 14, 21, 28):
            raise ValueError("Intervalo deve ser 7, 14, 21 ou 28 dias")
        return v

    @field_validator("weekday")
    @classmethod
    def valid_weekday(cls, v: int) -> int:
        if v < 1 or v > 7:
            raise ValueError("Dia da semana deve ser entre 1 (segunda) e 7 (domingo)")
        return v


class RecurringResponse(BaseModel):
    id: int
    professional_id: int
    service_id: int
    interval_days: int
    weekday: int
    start_time: time_type
    start_date: date_type
    end_date: date_type | None
    is_active: bool
    last_generated_date: date_type | None

    professional_name: str | None = None
    service_name: str | None = None
    next_date: date_type | None = None
    generated_count: int = 0

    model_config = {"from_attributes": True}


# ── Helpers ──

WEEKDAY_NAMES = {1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta",
                 5: "Sexta", 6: "Sábado", 7: "Domingo"}


def _compute_dates(start_date: date_type, interval_days: int,
                   weekday: int, end_date: date_type | None,
                   horizon_months: int = 3) -> list[date_type]:
    """
    Gera as próximas datas da recorrência.
    
    Ajusta start_date para o próximo dia da semana correto,
    depois incrementa interval_days a cada iteração.
    """
    # Ajustar primeira data para o weekday correto
    first = start_date
    while first.isoweekday() != weekday:
        first += timedelta(days=1)

    # Limite de horizonte (padrão: próximos 3 meses)
    horizon = date_type.today() + timedelta(days=horizon_months * 30)
    if end_date:
        horizon = min(horizon, end_date)

    dates = []
    current = first
    while current <= horizon:
        dates.append(current)
        current += timedelta(days=interval_days)

    return dates


def _generate_appointments_for(recurring: RecurringAppointment, db: Session,
                               horizon_months: int = 3) -> dict:
    """
    Gera agendamentos da recorrência até o horizonte.
    Pula datas onde já existe conflito (outro agendamento no mesmo slot).
    """
    prof = db.query(Professional).filter(Professional.id == recurring.professional_id).first()
    service = db.query(Service).filter(Service.id == recurring.service_id).first()

    if not prof or not service:
        return {"error": "Profissional ou serviço não encontrado"}

    # Gerar datas
    start = recurring.last_generated_date or recurring.start_date
    if recurring.last_generated_date:
        start = start + timedelta(days=recurring.interval_days)

    dates = _compute_dates(start, recurring.interval_days, recurring.weekday,
                           recurring.end_date, horizon_months)

    created = 0
    skipped = 0
    conflicts = []

    for target_date in dates:
        # Verificar work_days
        weekday_str = str(target_date.isoweekday())
        if weekday_str not in prof.work_days.split(","):
            skipped += 1
            continue

        # Calcular end_time (com horário normalizado)
        rec_start = _naive_time(recurring.start_time)
        start_dt = datetime.combine(target_date, rec_start)
        end_dt = start_dt + timedelta(minutes=service.duration_min)
        end_time = end_dt.time()

        # Verificar conflito
        if check_conflict(db, recurring.professional_id, target_date,
                         rec_start, end_time):
            conflicts.append(target_date.isoformat())
            skipped += 1
            continue

        # Criar agendamento
        apt = Appointment(
            client_id=recurring.client_id,
            professional_id=recurring.professional_id,
            service_id=recurring.service_id,
            date=target_date,
            start_time=rec_start,
            end_time=end_time,
            status="scheduled",
        )
        db.add(apt)
        created += 1
        recurring.last_generated_date = target_date

    db.commit()
    return {"created": created, "skipped": skipped, "conflicts": conflicts}


def _enrich(recurring: RecurringAppointment, db: Session) -> RecurringResponse:
    data = RecurringResponse.model_validate(recurring)

    prof = (db.query(Professional).options(joinedload(Professional.user))
            .filter(Professional.id == recurring.professional_id).first())
    svc = db.query(Service).filter(Service.id == recurring.service_id).first()

    data.professional_name = prof.user.name if prof and prof.user else None
    data.service_name = svc.name if svc else None

    # Próxima data
    if recurring.last_generated_date:
        data.next_date = recurring.last_generated_date + timedelta(days=recurring.interval_days)
    else:
        data.next_date = recurring.start_date

    # Contagem de agendamentos gerados
    data.generated_count = (
        db.query(Appointment)
        .filter(
            Appointment.client_id == recurring.client_id,
            Appointment.professional_id == recurring.professional_id,
            Appointment.service_id == recurring.service_id,
            Appointment.date >= recurring.start_date,
        )
        .count()
    )
    return data


# ── Endpoints ──

@router.post("", response_model=RecurringResponse, status_code=201)
def create_recurring(
    data: RecurringCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Criar agendamento recorrente e gerar os próximos 3 meses.
    
    Exemplo: "A cada 14 dias, sábado, 10:00, corte + barba, a partir de hoje"
    """
    # Validar profissional
    prof = db.query(Professional).filter(
        Professional.id == data.professional_id,
        Professional.is_active.is_(True),
    ).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado")

    # Validar serviço
    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.is_active.is_(True),
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")

    # Validar que weekday é dia de trabalho
    if str(data.weekday) not in prof.work_days.split(","):
        raise HTTPException(
            status_code=400,
            detail=f"Profissional não trabalha na {WEEKDAY_NAMES[data.weekday]}",
        )

    # Normalizar start_time (remover timezone se veio com offset)
    start_time = _naive_time(data.start_time)
    work_start = _naive_time(prof.work_start)
    work_end = _naive_time(prof.work_end)

    # Validar horário comercial
    if start_time < work_start or start_time >= work_end:
        raise HTTPException(status_code=400, detail="Horário fora do expediente")

    # Validar serviço cabe no expediente
    start_dt = datetime.combine(data.start_date, start_time)
    end_dt = start_dt + timedelta(minutes=service.duration_min)
    if end_dt.time() > work_end:
        raise HTTPException(status_code=400, detail="Serviço ultrapassa horário de trabalho")

    # Validar não recorrência no passado
    if data.start_date < date_type.today():
        raise HTTPException(status_code=400, detail="Data de início não pode ser no passado")

    # Criar recorrência
    recurring = RecurringAppointment(
        client_id=user.id,
        professional_id=data.professional_id,
        service_id=data.service_id,
        interval_days=data.interval_days,
        weekday=data.weekday,
        start_time=start_time,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(recurring)
    db.commit()
    db.refresh(recurring)

    # Gerar agendamentos iniciais
    result = _generate_appointments_for(recurring, db)
    logger.info("Recorrência criada: id=%d, %d agendamentos gerados, %d conflitos",
                recurring.id, result.get("created", 0), len(result.get("conflicts", [])))

    db.refresh(recurring)
    return _enrich(recurring, db)


@router.get("/my", response_model=list[RecurringResponse])
def my_recurring(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Minhas recorrências ativas."""
    recurrings = (
        db.query(RecurringAppointment)
        .filter(RecurringAppointment.client_id == user.id)
        .order_by(RecurringAppointment.created_at.desc())
        .all()
    )
    return [_enrich(r, db) for r in recurrings]


@router.put("/{recurring_id}/toggle")
def toggle_recurring(
    recurring_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pausar/reativar recorrência."""
    recurring = db.query(RecurringAppointment).filter(
        RecurringAppointment.id == recurring_id
    ).first()
    if not recurring:
        raise HTTPException(status_code=404, detail="Recorrência não encontrada")

    if recurring.client_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")

    recurring.is_active = not recurring.is_active
    db.commit()
    status = "ativada" if recurring.is_active else "pausada"
    return {"message": f"Recorrência {status}", "is_active": recurring.is_active}


@router.delete("/{recurring_id}")
def delete_recurring(
    recurring_id: int,
    cancel_future: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Cancelar recorrência.
    
    cancel_future=True: cancela também os agendamentos futuros já criados.
    cancel_future=False: mantém os agendamentos, só remove a recorrência.
    """
    recurring = db.query(RecurringAppointment).filter(
        RecurringAppointment.id == recurring_id
    ).first()
    if not recurring:
        raise HTTPException(status_code=404, detail="Recorrência não encontrada")

    if recurring.client_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")

    cancelled_count = 0
    if cancel_future:
        # Cancelar agendamentos futuros da mesma configuração
        today = date_type.today()
        future_apts = (
            db.query(Appointment)
            .filter(
                Appointment.client_id == recurring.client_id,
                Appointment.professional_id == recurring.professional_id,
                Appointment.service_id == recurring.service_id,
                Appointment.date >= today,
                Appointment.status == "scheduled",
                Appointment.start_time == _naive_time(recurring.start_time),
            )
            .all()
        )
        for apt in future_apts:
            apt.status = "cancelled"
            cancelled_count += 1

    db.delete(recurring)
    db.commit()

    return {
        "message": "Recorrência cancelada",
        "future_appointments_cancelled": cancelled_count,
    }


@router.post("/{recurring_id}/regenerate")
def regenerate_recurring(
    recurring_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Regenera agendamentos de uma recorrência (útil se houve conflitos antes)."""
    recurring = db.query(RecurringAppointment).filter(
        RecurringAppointment.id == recurring_id
    ).first()
    if not recurring:
        raise HTTPException(status_code=404, detail="Recorrência não encontrada")

    if recurring.client_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")

    if not recurring.is_active:
        raise HTTPException(status_code=400, detail="Recorrência pausada. Reative primeiro.")

    result = _generate_appointments_for(recurring, db)
    return {"message": "Agendamentos regenerados", **result}