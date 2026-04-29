"""
Endpoints públicos de confirmação/cancelamento via token.

Fluxo:
1. Cron-job 24h antes envia email com 2 links:
   - https://app.com/confirmar?token=<token>
   - https://app.com/cancelar?token=<token>
2. Cliente clica → frontend chama endpoint correspondente → status atualiza

O token é gerado com base no ID do agendamento + segredo + timestamp,
então não precisa armazenar nada extra no banco. É um JWT simples.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from jose import jwt, JWTError
from sqlalchemy.orm import joinedload

from core.config import settings
from core.database import SessionLocal
from models.appointment import Appointment
from services.booking_policy import validate_can_cancel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public-actions", tags=["Public Actions"])


# ─────────────────────────────────────────────────────────────
# Helpers de token
# ─────────────────────────────────────────────────────────────

def generate_action_token(appointment_id: int, action: str, hours_valid: int = 48) -> str:
    """Gera token JWT pra confirmar/cancelar agendamento."""
    payload = {
        "apt": appointment_id,
        "action": action,  # "confirm" ou "cancel"
        "exp": datetime.now(timezone.utc) + timedelta(hours=hours_valid),
        "type": "action",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_action_token(token: str, expected_action: str) -> int:
    """Verifica e retorna o appointment_id se válido."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")

    if payload.get("type") != "action":
        raise HTTPException(status_code=400, detail="Tipo de token inválido")
    if payload.get("action") != expected_action:
        raise HTTPException(status_code=400, detail="Ação do token não corresponde")

    return payload["apt"]


# ─────────────────────────────────────────────────────────────
# Endpoint: confirmar presença via token
# ─────────────────────────────────────────────────────────────

@router.post("/confirm")
@router.get("/confirm")
def confirm_appointment_by_token(token: str = Query(...)):
    """
    Cliente confirma presença no agendamento sem precisar logar.
    Muda status de 'scheduled' → 'confirmed'.
    """
    apt_id = verify_action_token(token, "confirm")

    db = SessionLocal()
    try:
        apt = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.client),
                joinedload(Appointment.service),
                joinedload(Appointment.professional),
            )
            .filter(Appointment.id == apt_id)
            .first()
        )
        if not apt:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")

        if apt.status == "confirmed":
            return {
                "status": "already_confirmed",
                "message": "Este agendamento já estava confirmado.",
                "appointment": _serialize_apt(apt),
            }

        if apt.status != "scheduled":
            raise HTTPException(
                status_code=400,
                detail=f"Agendamento com status '{apt.status}' não pode ser confirmado",
            )

        apt.status = "confirmed"
        db.commit()
        db.refresh(apt)

        logger.info("Cliente confirmou agendamento %s via token", apt_id)

        return {
            "status": "confirmed",
            "message": "Presença confirmada! Te esperamos no horário agendado.",
            "appointment": _serialize_apt(apt),
        }
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Endpoint: cancelar via token
# ─────────────────────────────────────────────────────────────

@router.post("/cancel")
@router.get("/cancel")
def cancel_appointment_by_token(token: str = Query(...)):
    """
    Cliente cancela agendamento sem precisar logar.
    Respeita a janela de cancelamento configurada (client_cancel_hours).
    """
    apt_id = verify_action_token(token, "cancel")

    db = SessionLocal()
    try:
        apt = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.client),
                joinedload(Appointment.service),
                joinedload(Appointment.professional),
            )
            .filter(Appointment.id == apt_id)
            .first()
        )
        if not apt:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")

        if apt.status == "cancelled":
            return {
                "status": "already_cancelled",
                "message": "Este agendamento já estava cancelado.",
                "appointment": _serialize_apt(apt),
            }

        # Valida janela de cancelamento (usa settings)
        ok, msg = validate_can_cancel(db, apt, is_client=True)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)

        apt.status = "cancelled"
        db.commit()
        db.refresh(apt)

        # Notifica lista de espera
        try:
            from api.routes.waitlist_routes import notify_waitlist_on_cancel
            notify_waitlist_on_cancel(db, apt.professional_id, apt.date)
        except Exception:
            logger.debug("Waitlist notification failed — continuing")

        logger.info("Cliente cancelou agendamento %s via token", apt_id)

        return {
            "status": "cancelled",
            "message": "Agendamento cancelado com sucesso.",
            "appointment": _serialize_apt(apt),
        }
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Helper de serialização
# ─────────────────────────────────────────────────────────────

def _serialize_apt(apt: Appointment) -> dict:
    """Retorna apenas dados não-sensíveis do agendamento."""
    prof_name = "Profissional"
    if apt.professional and apt.professional.user_id:
        from models.user import User
        from core.database import SessionLocal
        db = SessionLocal()
        try:
            u = db.query(User).filter(User.id == apt.professional.user_id).first()
            if u:
                prof_name = u.name
        finally:
            db.close()

    return {
        "id": apt.id,
        "client_name": apt.client.name if apt.client else "Cliente",
        "service_name": apt.service.name if apt.service else "Serviço",
        "professional_name": prof_name,
        "date": apt.date.isoformat(),
        "start_time": apt.start_time.strftime("%H:%M"),
        "status": apt.status,
    }