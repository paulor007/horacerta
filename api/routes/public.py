"""
Endpoints públicos — agendamento sem login.

Link compartilhável: o dono da barbearia envia o link para clientes.
O cliente agenda informando apenas nome, telefone e email.
Não precisa de conta nem JWT.

Segurança:
- Rate limit geral: 60 req/min por IP
- Rate limit booking: 5 agendamentos/hora por IP
"""

import logging
import secrets
from datetime import datetime, timedelta
from datetime import date as date_type
from datetime import time as time_type

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session, joinedload

from core.config import settings
from core.database import get_db
from core.security import hash_password
from models.user import User
from models.professional import Professional
from models.service import Service
from models.appointment import Appointment
from schemas.appointment import AvailabilityResponse, TimeSlot
from schemas.professional import ProfessionalResponse
from schemas.service import ServiceResponse
from services.availability import get_available_slots, check_conflict
from services.rate_limit import check_rate_limit, check_booking_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["Agendamento Público"])


# ── Schemas ──

class PublicBookingRequest(BaseModel):
    client_name: str
    client_phone: str
    client_email: EmailStr
    professional_id: int
    service_id: int
    date: date_type
    start_time: time_type

    @field_validator("client_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Nome é obrigatório")
        return v.strip()

    @field_validator("client_phone")
    @classmethod
    def phone_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Telefone é obrigatório")
        return v.strip()


class PublicBookingResponse(BaseModel):
    id: int
    client_name: str
    professional_name: str
    service_name: str
    date: date_type
    start_time: time_type
    end_time: time_type
    message: str


class PublicInfoResponse(BaseModel):
    name: str
    professionals_count: int
    services_count: int


# ── Endpoints (todos com rate limit) ──

@router.get("/info", response_model=PublicInfoResponse)
def public_info(
    request: Request,
    db: Session = Depends(get_db),
):
    check_rate_limit(request)
    profs = db.query(Professional).filter(Professional.is_active.is_(True)).count()
    svcs = db.query(Service).filter(Service.is_active.is_(True)).count()
    return PublicInfoResponse(
        name=settings.EMPRESA_NOME,
        professionals_count=profs,
        services_count=svcs,
    )


@router.get("/professionals", response_model=list[ProfessionalResponse])
def public_professionals(
    request: Request,
    db: Session = Depends(get_db),
):
    check_rate_limit(request)
    profs = (
        db.query(Professional)
        .options(joinedload(Professional.user))
        .filter(Professional.is_active.is_(True))
        .all()
    )
    result = []
    for p in profs:
        data = ProfessionalResponse.model_validate(p)
        data.user_name = p.user.name if p.user else None
        result.append(data)
    return result


@router.get("/services", response_model=list[ServiceResponse])
def public_services(
    request: Request,
    db: Session = Depends(get_db),
):
    check_rate_limit(request)
    return db.query(Service).filter(Service.is_active.is_(True)).all()


@router.get("/availability", response_model=AvailabilityResponse)
def public_availability(
    request: Request,
    professional_id: int = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    service_id: int = Query(...),
    db: Session = Depends(get_db),
):
    check_rate_limit(request)

    try:
        target_date = date_type.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use YYYY-MM-DD")

    prof = (
        db.query(Professional)
        .options(joinedload(Professional.user))
        .filter(Professional.id == professional_id)
        .first()
    )
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado")

    raw_slots = get_available_slots(db, professional_id, target_date, service_id)

    slots = []
    for s in raw_slots:
        h, m = map(int, s["time"].split(":"))
        slots.append(TimeSlot(time=time_type(h, m), available=s["available"]))

    return AvailabilityResponse(
        professional_id=professional_id,
        professional_name=prof.user.name if prof.user else f"Prof #{professional_id}",
        date=target_date,
        slots=slots,
    )


@router.post("/book", response_model=PublicBookingResponse, status_code=201)
def public_book(
    data: PublicBookingRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    # Rate limits: geral + booking específico
    check_rate_limit(request)
    check_booking_rate_limit(request)

    # Buscar ou criar cliente
    user = db.query(User).filter(User.email == data.client_email).first()

    if not user:
        user = User(
            name=data.client_name,
            email=data.client_email,
            phone=data.client_phone,
            hashed_password=hash_password(secrets.token_urlsafe(16)),
            role="client",
        )
        db.add(user)
        db.flush()
        logger.info("Novo cliente via booking público: %s", data.client_email)
    else:
        user.name = data.client_name
        user.phone = data.client_phone

    # Validar profissional
    prof = db.query(Professional).filter(
        Professional.id == data.professional_id,
        Professional.is_active.is_(True),
    ).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado ou inativo")

    # Validar serviço
    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.is_active.is_(True),
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado ou inativo")

    # Verificar dia da semana
    weekday = data.date.isoweekday()
    if str(weekday) not in prof.work_days.split(","):
        raise HTTPException(status_code=400, detail="Profissional não trabalha neste dia")

    # Verificar horário comercial
    if data.start_time < prof.work_start or data.start_time >= prof.work_end:
        raise HTTPException(status_code=400, detail="Horário fora do expediente")

    # Calcular end_time
    start_dt = datetime.combine(data.date, data.start_time)
    end_dt = start_dt + timedelta(minutes=service.duration_min)
    end_time = end_dt.time()

    if end_time > prof.work_end:
        raise HTTPException(status_code=400, detail="Serviço ultrapassa horário de trabalho")

    # Verificar passado
    now = datetime.now()
    if data.date < now.date() or (data.date == now.date() and data.start_time <= now.time()):
        raise HTTPException(status_code=400, detail="Não é possível agendar no passado")

    # Verificar conflito
    if check_conflict(db, data.professional_id, data.date, data.start_time, end_time):
        raise HTTPException(status_code=409, detail="Horário já ocupado")

    # Criar agendamento
    appointment = Appointment(
        client_id=user.id,
        professional_id=data.professional_id,
        service_id=data.service_id,
        date=data.date,
        start_time=data.start_time,
        end_time=end_time,
        status="scheduled",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    try:
        from tasks.reminders import notify_new_appointment
        notify_new_appointment.delay(appointment.id)
    except Exception:
        logger.debug("Celery indisponível — notificação ignorada")

    prof_name = prof.user.name if prof.user else f"Prof #{prof.id}"

    logger.info("Booking público: %s agendou %s com %s em %s %s",
                data.client_name, service.name, prof_name, data.date, data.start_time)

    return PublicBookingResponse(
        id=appointment.id,
        client_name=data.client_name,
        professional_name=prof_name,
        service_name=service.name,
        date=data.date,
        start_time=data.start_time,
        end_time=end_time,
        message="Agendamento confirmado! Você receberá um lembrete por email e WhatsApp.",
    )