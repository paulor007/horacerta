"""
Endpoints de agendamento — coração do sistema.

Fluxo:
1. Cliente consulta horários disponíveis (GET /available)
2. Cliente agenda (POST /)
3. Sistema valida conflito e horário comercial
4. Profissional vê agenda do dia (GET /today)
5. Profissional marca concluído ou no-show
"""
import asyncio

from datetime import datetime, timedelta
from datetime import date as date_type
from datetime import time as time_type
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user, require_role
from models.user import User
from models.professional import Professional
from models.service import Service
from models.appointment import Appointment
from schemas.appointment import (
    AppointmentCreate,
    AppointmentReschedule,
    AppointmentResponse,
    AvailabilityResponse,
    TimeSlot,
)
from services.availability import get_available_slots, check_conflict
from websocket.manager import ws_manager

router = APIRouter(prefix="/api/v1/appointments", tags=["Agendamentos"])


def _enrich_appointment(apt: Appointment, db: Session) -> AppointmentResponse:
    """Adiciona nomes de cliente, profissional e serviço ao response."""
    data = AppointmentResponse.model_validate(apt)
    if apt.client:
        data.client_name = apt.client.name
    if apt.professional and apt.professional.user:
        data.professional_name = apt.professional.user.name
    if apt.service:
        data.service_name = apt.service.name
        data.service_price = apt.service.price
        data.service_duration = apt.service.duration_min
    return data


# ── Disponibilidade ──

@router.get("/available", response_model=AvailabilityResponse)
def get_availability(
    professional_id: int = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    service_id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Horários disponíveis para um profissional em uma data."""
    try:
        target_date = date_type.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use YYYY-MM-DD")

    prof = db.query(Professional).filter(Professional.id == professional_id).first()
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


# ── Agendar ──

@router.post("/", response_model=AppointmentResponse, status_code=201)
def create_appointment(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Agendar horário.

    Validações:
    - Profissional existe e está ativo
    - Serviço existe e está ativo
    - Profissional trabalha neste dia
    - Horário dentro do expediente
    - Sem conflito com outro agendamento
    - Não permite agendar no passado
    """
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

    # Verificar se end_time ultrapassa expediente
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

    # Dispara notificação em background (Celery)
    try:
        from tasks.reminders import notify_new_appointment
        notify_new_appointment.delay(appointment.id)
    except Exception:
        # Se Celery não estiver rodando, ignora (não impede agendamento)
        pass

    # Broadcast WebSocket (tempo real)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast_appointment_event(
                "new",
                appointment.professional_id,
                {
                    "id": appointment.id,
                    "client_name": user.name,
                    "service": service.name,
                    "date": str(appointment.date),
                    "start_time": str(appointment.start_time),
                    "end_time": str(appointment.end_time),
                },
            ))
    except Exception:
        # Se WebSocket falhar, ignora (não impede agendamento)
        pass

    return _enrich_appointment(appointment, db)


# ── Cancelar ──

@router.delete("/{appointment_id}")
def cancel_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Cancelar agendamento.

    Regras:
    - Cliente só cancela os próprios
    - Admin/professional pode cancelar qualquer um
    - Deve ser até 2h antes do horário
    """
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    # Verificar permissão
    if user.role == "client" and apt.client_id != user.id:
        raise HTTPException(status_code=403, detail="Só pode cancelar seus próprios agendamentos")

    # Verificar status
    if apt.status not in ("scheduled", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Agendamento com status '{apt.status}' não pode ser cancelado")

    # Verificar política de 2h (apenas para clientes)
    if user.role == "client":
        apt_datetime = datetime.combine(apt.date, apt.start_time)
        if datetime.now() > apt_datetime - timedelta(hours=2):
            raise HTTPException(status_code=400, detail="Cancelamento permitido até 2h antes do horário")

    apt.status = "cancelled"
    db.commit()

    # Broadcast WebSocket
    try:
        asyncio.ensure_future(ws_manager.broadcast_appointment_event(
            "cancelled",
            apt.professional_id,
            {"id": appointment_id},
        ))
    except Exception:
        # Se WebSocket falhar, ignora (não impede agendamento)
        pass

    return {"message": "Agendamento cancelado", "id": appointment_id}


# ── Reagendar ──

@router.put("/{appointment_id}", response_model=AppointmentResponse)
def reschedule_appointment(
    appointment_id: int,
    data: AppointmentReschedule,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reagendar para nova data/horário."""
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    if user.role == "client" and apt.client_id != user.id:
        raise HTTPException(status_code=403, detail="Só pode reagendar seus próprios agendamentos")

    if apt.status not in ("scheduled", "confirmed"):
        raise HTTPException(status_code=400, detail="Agendamento não pode ser reagendado")

    # Buscar serviço para calcular end_time
    service = db.query(Service).filter(Service.id == apt.service_id).first()
    start_dt = datetime.combine(data.date, data.start_time)
    end_dt = start_dt + timedelta(minutes=service.duration_min)
    end_time = end_dt.time()

    # Validar profissional trabalha neste dia
    prof = db.query(Professional).filter(Professional.id == apt.professional_id).first()
    weekday = data.date.isoweekday()
    if str(weekday) not in prof.work_days.split(","):
        raise HTTPException(status_code=400, detail="Profissional não trabalha neste dia")

    if data.start_time < prof.work_start or end_time > prof.work_end:
        raise HTTPException(status_code=400, detail="Horário fora do expediente")

    # Verificar conflito (excluindo o próprio agendamento)
    if check_conflict(db, apt.professional_id, data.date, data.start_time, end_time, exclude_appointment_id=appointment_id):
        raise HTTPException(status_code=409, detail="Novo horário já ocupado")

    apt.date = data.date
    apt.start_time = data.start_time
    apt.end_time = end_time
    db.commit()
    db.refresh(apt)

    return _enrich_appointment(apt, db)


# ── Listar (cliente) ──

@router.get("/my", response_model=list[AppointmentResponse])
def my_appointments(
    status: str | None = Query(None, description="Filtrar por status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Meus agendamentos (cliente logado)."""
    query = db.query(Appointment).filter(Appointment.client_id == user.id)
    if status:
        query = query.filter(Appointment.status == status)
    query = query.order_by(Appointment.date.desc(), Appointment.start_time.desc())

    return [_enrich_appointment(apt, db) for apt in query.limit(50).all()]


# ── Listar (profissional) ──

@router.get("/today", response_model=list[AppointmentResponse])
def today_appointments(
    date: str | None = Query(None, description="YYYY-MM-DD (padrão: hoje)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Agenda do dia do profissional logado (ou data específica)."""
    from datetime import date as date_type

    # Determinar data
    if date:
        try:
            target_date = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Data inválida")
    else:
        target_date = date_type.today()

    # Se é profissional, filtra pela sua agenda
    if user.role == "professional":
        prof = db.query(Professional).filter(Professional.user_id == user.id).first()
        if not prof:
            raise HTTPException(status_code=404, detail="Perfil profissional não encontrado")
        query = db.query(Appointment).filter(
            Appointment.professional_id == prof.id,
            Appointment.date == target_date,
        )
    elif user.role == "admin":
        # Admin vê todos
        query = db.query(Appointment).filter(Appointment.date == target_date)
    else:
        raise HTTPException(status_code=403, detail="Apenas profissional ou admin")

    query = query.order_by(Appointment.start_time)
    return [_enrich_appointment(apt, db) for apt in query.all()]


# ── Marcar concluído ──

@router.put("/{appointment_id}/complete", response_model=AppointmentResponse)
def complete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "professional")),
):
    """Marcar agendamento como concluído."""
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    if apt.status not in ("scheduled", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Status '{apt.status}' não pode ser concluído")

    apt.status = "completed"
    db.commit()
    db.refresh(apt)

    # Broadcast WebSocket
    try:
        import asyncio
        asyncio.ensure_future(ws_manager.broadcast_appointment_event(
            "completed",
            apt.professional_id,
            {"id": appointment_id},
        ))
    except Exception:
        pass

    return _enrich_appointment(apt, db)


# ── Marcar no-show ──

@router.put("/{appointment_id}/no-show", response_model=AppointmentResponse)
def noshow_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "professional")),
):
    """Marcar agendamento como falta (no-show)."""
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    if apt.status not in ("scheduled", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Status '{apt.status}' não pode ser marcado como falta")

    apt.status = "no_show"
    db.commit()
    db.refresh(apt)

    # Broadcast WebSocket
    try:
        import asyncio
        asyncio.ensure_future(ws_manager.broadcast_appointment_event(
            "no_show",
            apt.professional_id,
            {"id": appointment_id},
        ))
    except Exception:
        pass

    return _enrich_appointment(apt, db)

# ── Teste de notificação (dev) ──

@router.post("/{appointment_id}/notify")
def test_notify(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """
    (Dev) Dispara notificação manualmente para um agendamento.
    Útil para testar email/WhatsApp sem esperar o Celery Beat.
    """
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    try:
        from tasks.reminders import notify_new_appointment
        result = notify_new_appointment(appointment_id)  # Síncrono (sem .delay)
        return {"message": "Notificação enviada", "result": result}
    except Exception as e:
        return {"message": "Erro ao notificar", "error": str(e)}