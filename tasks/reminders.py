"""
Tasks do Celery — rodam em background.

Tasks agendadas (Celery Beat):
- send_pending_reminders: a cada 30min, envia lembretes para agendamentos das próximas 24h
- mark_noshows: às 22h, marca como no_show quem não compareceu
- close_monthly_snapshot: dia 1 às 2h, gera snapshot do mês anterior
- auto_cleanup: às 3h, apaga histórico antigo (após gerar snapshots)

Tasks sob demanda:
- notify_new_appointment: envia confirmação ao cliente + aviso ao profissional
- notify_review_request: envia pedido de avaliação após atendimento concluído
"""

from datetime import date, datetime, timedelta, timezone
from tasks.celery_app import celery_app
from core.database import SessionLocal
from models.appointment import Appointment
from models.notification import Notification
from models.professional import Professional
from models.user import User
from services.notification import (
    send_email,
    send_whatsapp,
    register_notification,
    build_reminder_message,
    build_confirmation_message,
    build_professional_notification,
    build_review_request_message,
)


@celery_app.task(name="tasks.reminders.send_pending_reminders")
def send_pending_reminders():
    """Verifica agendamentos das próximas 24h e envia lembrete."""
    db = SessionLocal()
    try:
        now = datetime.now()
        tomorrow = now + timedelta(hours=24)

        appointments = (
            db.query(Appointment)
            .filter(
                Appointment.date == tomorrow.date(),
                Appointment.status.in_(["scheduled", "confirmed"]),
            )
            .all()
        )

        sent_count = 0
        for apt in appointments:
            existing = (
                db.query(Notification)
                .filter(
                    Notification.appointment_id == apt.id,
                    Notification.type == "reminder",
                    Notification.status == "sent",
                )
                .first()
            )
            if existing:
                continue

            client = db.query(User).filter(User.id == apt.client_id).first()
            prof = db.query(Professional).filter(Professional.id == apt.professional_id).first()
            prof_user = db.query(User).filter(User.id == prof.user_id).first() if prof else None

            if not client or not prof_user:
                continue

            service_name = apt.service.name if apt.service else "Serviço"
            date_str = apt.date.strftime("%d/%m/%Y")
            time_str = apt.start_time.strftime("%H:%M")

            messages = build_reminder_message(
                client_name=client.name,
                service_name=service_name,
                professional_name=prof_user.name,
                date_str=date_str,
                time_str=time_str,
            )

            email_ok = send_email(client.email, "Lembrete de Agendamento — HoraCerta", messages["email"])
            register_notification(apt.id, "reminder", "email", email_ok)

            if client.phone:
                wp_ok = send_whatsapp(client.phone, messages["whatsapp"])
                register_notification(apt.id, "reminder", "whatsapp", wp_ok)

            sent_count += 1

        print(f"  [REMINDERS] {sent_count} lembretes enviados")
        return {"sent": sent_count}

    except Exception as e:
        print(f"  [REMINDERS] Erro: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="tasks.reminders.mark_noshows")
def mark_noshows():
    """Marca como no_show agendamentos passados que não foram concluídos."""
    db = SessionLocal()
    try:
        today = date.today()
        now_time = datetime.now().time()

        noshows = (
            db.query(Appointment)
            .filter(
                Appointment.date <= today,
                Appointment.end_time < now_time,
                Appointment.status.in_(["scheduled", "confirmed"]),
            )
            .all()
        )

        count = 0
        for apt in noshows:
            apt.status = "no_show"
            count += 1

        db.commit()
        print(f"  [NO-SHOW] {count} agendamentos marcados como falta")
        return {"marked": count}

    except Exception as e:
        db.rollback()
        print(f"  [NO-SHOW] Erro: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="tasks.reminders.notify_new_appointment")
def notify_new_appointment(appointment_id: int, client_password: str | None = None):
    """
    Envia confirmação ao cliente + aviso ao profissional.
    Se client_password for fornecido, inclui credenciais de acesso na mensagem.
    """
    db = SessionLocal()
    try:
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            return {"error": "Appointment not found"}

        client = db.query(User).filter(User.id == apt.client_id).first()
        prof = db.query(Professional).filter(Professional.id == apt.professional_id).first()
        prof_user = db.query(User).filter(User.id == prof.user_id).first() if prof else None

        if not client or not prof_user:
            return {"error": "Missing user data"}

        service_name = apt.service.name if apt.service else "Serviço"
        date_str = apt.date.strftime("%d/%m/%Y")
        time_str = apt.start_time.strftime("%H:%M")

        # ── Notificar CLIENTE (confirmação + senha se novo) ──
        client_msgs = build_confirmation_message(
            client_name=client.name,
            service_name=service_name,
            professional_name=prof_user.name,
            date_str=date_str,
            time_str=time_str,
            client_password=client_password,
            client_email=client.email if client_password else None,
        )

        subject = "Agendamento Confirmado — HoraCerta"
        if client_password:
            subject = "Agendamento Confirmado + Seus Dados de Acesso — HoraCerta"

        email_ok = send_email(client.email, subject, client_msgs["email"])
        register_notification(apt.id, "confirmation", "email", email_ok)

        if client.phone:
            wp_ok = send_whatsapp(client.phone, client_msgs["whatsapp"])
            register_notification(apt.id, "confirmation", "whatsapp", wp_ok)

        # ── Notificar PROFISSIONAL (novo agendamento) ──
        prof_msgs = build_professional_notification(
            professional_name=prof_user.name,
            client_name=client.name,
            service_name=service_name,
            date_str=date_str,
            time_str=time_str,
        )

        send_email(prof_user.email, "Novo Agendamento — HoraCerta", prof_msgs["email"])
        register_notification(apt.id, "new_appointment", "email", True)

        if prof_user.phone:
            send_whatsapp(prof_user.phone, prof_msgs["whatsapp"])
            register_notification(apt.id, "new_appointment", "whatsapp", True)

        return {
            "client_notified": True,
            "professional_notified": True,
            "password_sent": bool(client_password),
        }

    except Exception as e:
        print(f"  [NOTIFY] Erro: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="tasks.reminders.notify_review_request")
def notify_review_request(appointment_id: int, review_token: str):
    """Envia pedido de avaliação ao cliente após atendimento concluído."""
    db = SessionLocal()
    try:
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            return {"error": "Appointment not found"}

        client = db.query(User).filter(User.id == apt.client_id).first()
        prof = db.query(Professional).filter(Professional.id == apt.professional_id).first()
        prof_user = db.query(User).filter(User.id == prof.user_id).first() if prof else None

        if not client or not prof_user:
            return {"error": "Missing user data"}

        service_name = apt.service.name if apt.service else "Serviço"
        date_str = apt.date.strftime("%d/%m/%Y")
        review_url = f"http://localhost:5173/avaliar?token={review_token}"

        messages = build_review_request_message(
            client_name=client.name,
            professional_name=prof_user.name,
            service_name=service_name,
            date_str=date_str,
            review_url=review_url,
        )

        email_ok = send_email(client.email, "Como foi seu atendimento? — HoraCerta", messages["email"])
        register_notification(apt.id, "review_request", "email", email_ok)

        if client.phone:
            wp_ok = send_whatsapp(client.phone, messages["whatsapp"])
            register_notification(apt.id, "review_request", "whatsapp", wp_ok)

        return {"review_sent": True}

    except Exception as e:
        print(f"  [REVIEW] Erro: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="tasks.reminders.close_monthly_snapshot")
def close_monthly_snapshot():
    """
    Roda dia 1 de cada mês às 2h.
    Gera o snapshot do mês anterior (preserva faturamento).
    """
    from services.monthly_snapshots import close_previous_month

    db = SessionLocal()
    try:
        result = close_previous_month(db)
        print(f"  [SNAPSHOT] Mês fechado: {result}")
        return result
    except Exception as e:
        db.rollback()
        print(f"  [SNAPSHOT] Erro: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="tasks.reminders.auto_cleanup")
def auto_cleanup():
    """
    Roda diariamente às 3h.
    ANTES de apagar, garante que snapshots mensais existem para todos os meses afetados.
    Só apaga concluídos/cancelados/no-show mais antigos que cleanup_days.
    """
    from models.system_settings import SystemSettings
    from services.monthly_snapshots import generate_missing_snapshots

    db = SessionLocal()
    try:
        settings = db.query(SystemSettings).first()
        if not settings or not settings.cleanup_enabled:
            print("  [CLEANUP] Limpeza automática desativada")
            return {"skipped": True, "reason": "disabled"}

        # PASSO 1: garantir que todos os snapshots mensais foram gerados
        snapshots_generated = generate_missing_snapshots(db)
        if snapshots_generated:
            print(f"  [CLEANUP] {len(snapshots_generated)} snapshots mensais gerados antes da limpeza")

        # PASSO 2: agora sim, apagar os antigos
        cutoff = date.today() - timedelta(days=settings.cleanup_days)
        deleted = (
            db.query(Appointment)
            .filter(
                Appointment.date < cutoff,
                Appointment.status.in_(["completed", "cancelled", "no_show"]),
            )
            .delete(synchronize_session=False)
        )

        settings.last_cleanup_at = datetime.now(timezone.utc)
        settings.last_cleanup_count = deleted
        db.commit()

        print(
            f"  [CLEANUP] {deleted} agendamentos apagados (antes de {cutoff}) — "
            f"faturamento preservado em snapshots"
        )
        return {
            "deleted": deleted,
            "cutoff": cutoff.isoformat(),
            "snapshots_created": len(snapshots_generated),
        }

    except Exception as e:
        db.rollback()
        print(f"  [CLEANUP] Erro: {e}")
        return {"error": str(e)}
    finally:
        db.close()