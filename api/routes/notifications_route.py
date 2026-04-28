"""
Endpoints de notificações:
- GET /preview/{appointment_id} → retorna a mensagem WhatsApp que SERIA enviada (público, leve)
- GET/POST /cron/check-reminders → endpoint chamado pelo cron-job.org pra enviar lembretes 24h
- GET /cron/ping → healthcheck público
"""

import os
from datetime import datetime, timedelta, timezone
import logging

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import joinedload

from core.database import SessionLocal
from models.appointment import Appointment
from models.notification import Notification
from services.notification import (
    build_confirmation_message,
    build_reminder_message,
    build_professional_notification,
    send_email,
    register_notification,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


# ─────────────────────────────────────────────────────────────
# Endpoint público: PREVIEW de mensagem WhatsApp
# ─────────────────────────────────────────────────────────────

@router.get("/preview/{appointment_id}")
def preview_message(appointment_id: int, kind: str = Query("confirmation")):
    """
    Retorna o texto da mensagem WhatsApp que SERIA enviada para um agendamento.

    Usado pelo modal "Preview WhatsApp" do frontend pra mostrar visualmente
    a mensagem sem realmente enviar. Não requer autenticação porque a mensagem
    é gerada a partir de dados públicos do agendamento.

    Tipos suportados:
    - confirmation (default): confirmação para o cliente
    - reminder: lembrete 24h antes
    - new_booking: notificação para o profissional
    """
    db = SessionLocal()
    try:
        apt = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.client),
                joinedload(Appointment.service),
                joinedload(Appointment.professional),
            )
            .filter(Appointment.id == appointment_id)
            .first()
        )
        if not apt:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")

        client_name = apt.client.name if apt.client else "Cliente"
        client_phone = apt.client.phone if apt.client else ""
        service_name = apt.service.name if apt.service else "Serviço"

        prof_name = "Profissional"
        prof_phone = ""
        if apt.professional and apt.professional.user_id:
            from models.user import User
            prof_user = db.query(User).filter(User.id == apt.professional.user_id).first()
            if prof_user:
                prof_name = prof_user.name
                prof_phone = prof_user.phone or ""

        date_str = apt.date.strftime("%d/%m/%Y")
        time_str = apt.start_time.strftime("%H:%M")

        if kind == "reminder":
            msg = build_reminder_message(client_name, service_name, prof_name, date_str, time_str)
            return {
                "kind": "reminder",
                "title": "Lembrete de agendamento",
                "to_phone": client_phone,
                "to_name": client_name,
                "whatsapp_text": msg["whatsapp"],
            }

        if kind == "new_booking":
            msg = build_professional_notification(prof_name, client_name, service_name, date_str, time_str)
            return {
                "kind": "new_booking",
                "title": "Novo agendamento",
                "to_phone": prof_phone,
                "to_name": prof_name,
                "whatsapp_text": msg["whatsapp"],
            }

        # Default: confirmação
        msg = build_confirmation_message(client_name, service_name, prof_name, date_str, time_str)
        return {
            "kind": "confirmation",
            "title": "Confirmação de agendamento",
            "to_phone": client_phone,
            "to_name": client_name,
            "whatsapp_text": msg["whatsapp"],
        }
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Endpoint protegido: CRON de lembretes 24h
# ─────────────────────────────────────────────────────────────

@router.post("/cron/check-reminders")
@router.get("/cron/check-reminders")
def check_reminders(token: str = Query(...)):
    """
    Endpoint chamado pelo cron-job.org a cada hora.

    Busca agendamentos que:
    - Acontecem nas próximas 23-25 horas
    - Ainda não tiveram lembrete enviado
    - Status = "scheduled"

    Envia email de lembrete pra cada um.
    """
    expected = os.getenv("CRON_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Cron desabilitado. Defina CRON_TOKEN.")
    if token != expected:
        raise HTTPException(status_code=403, detail="Token inválido")

    db = SessionLocal()
    sent = 0
    skipped = 0
    failed = 0

    try:
        now = datetime.now(timezone.utc)
        target_min = now + timedelta(hours=23)
        target_max = now + timedelta(hours=25)

        candidates = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.client),
                joinedload(Appointment.service),
                joinedload(Appointment.professional),
            )
            .filter(
                Appointment.status == "scheduled",
                Appointment.date >= target_min.date(),
                Appointment.date <= target_max.date(),
            )
            .all()
        )

        for apt in candidates:
            apt_dt = datetime.combine(apt.date, apt.start_time, tzinfo=timezone.utc)
            if not (target_min <= apt_dt <= target_max):
                continue

            already_sent = (
                db.query(Notification)
                .filter(
                    Notification.appointment_id == apt.id,
                    Notification.type == "reminder",
                    Notification.status == "sent",
                )
                .first()
            )
            if already_sent:
                skipped += 1
                continue

            client_name = apt.client.name if apt.client else "Cliente"
            client_email = apt.client.email if apt.client else ""
            service_name = apt.service.name if apt.service else "Serviço"

            prof_name = "Profissional"
            if apt.professional and apt.professional.user_id:
                from models.user import User
                prof_user = db.query(User).filter(User.id == apt.professional.user_id).first()
                if prof_user:
                    prof_name = prof_user.name

            date_str = apt.date.strftime("%d/%m/%Y")
            time_str = apt.start_time.strftime("%H:%M")

            msg = build_reminder_message(client_name, service_name, prof_name, date_str, time_str)

            ok = False
            if client_email:
                ok = send_email(
                    client_email,
                    f"Lembrete do seu agendamento — {date_str} às {time_str}",
                    msg["email"],
                )

            register_notification(apt.id, "reminder", "email", ok)

            if ok:
                sent += 1
            else:
                failed += 1
                logger.warning("Falha ao enviar lembrete pra %s", client_email)

        return {
            "status": "ok",
            "checked_at": now.isoformat(),
            "candidates_found": len(candidates),
            "sent": sent,
            "skipped_already_sent": skipped,
            "failed": failed,
        }

    except Exception as e:
        logger.exception("Erro no cron de lembretes")
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Healthcheck público pro cron-job.org
# ─────────────────────────────────────────────────────────────

@router.get("/cron/ping")
def cron_ping():
    """Endpoint público para verificar se o serviço está vivo."""
    return {
        "status": "ok",
        "service": "horacerta-cron",
        "time": datetime.now(timezone.utc).isoformat(),
    }