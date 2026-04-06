"""
Tasks do Celery — rodam em background.

Tasks:
1. send_pending_reminders: a cada 30min, verifica agendamentos das próximas 24h
2. mark_noshows: às 22h, marca como no_show quem não compareceu
3. notify_new_appointment: envia confirmação ao cliente + aviso ao profissional
"""

from datetime import date, datetime, timedelta
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
)


@celery_app.task(name="tasks.reminders.send_pending_reminders")
def send_pending_reminders():
    """
    Verifica agendamentos das próximas 24h e envia lembrete.
    Roda a cada 30 minutos via Celery Beat.
    """
    db = SessionLocal()
    try:
        now = datetime.now()
        tomorrow = now + timedelta(hours=24)

        # Buscar agendamentos entre agora e 24h que ainda não receberam lembrete
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
            # Verificar se já enviou lembrete
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

            # Buscar dados
            client = db.query(User).filter(User.id == apt.client_id).first()
            prof = db.query(Professional).filter(Professional.id == apt.professional_id).first()
            prof_user = db.query(User).filter(User.id == prof.user_id).first() if prof else None

            if not client or not prof_user:
                continue

            service_name = apt.service.name if apt.service else "Serviço"
            date_str = apt.date.strftime("%d/%m/%Y")
            time_str = apt.start_time.strftime("%H:%M")

            # Montar mensagem
            messages = build_reminder_message(
                client_name=client.name,
                service_name=service_name,
                professional_name=prof_user.name,
                date_str=date_str,
                time_str=time_str,
            )

            # Enviar email
            email_ok = send_email(client.email, "Lembrete de Agendamento — HoraCerta", messages["email"])
            register_notification(apt.id, "reminder", "email", email_ok)

            # Enviar WhatsApp (se tiver telefone)
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
    """
    Marca como no_show agendamentos passados que não foram concluídos.
    Roda diariamente às 22h via Celery Beat.
    """
    db = SessionLocal()
    try:
        today = date.today()
        now_time = datetime.now().time()

        # Agendamentos de hoje que já passaram e ainda estão scheduled
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
def notify_new_appointment(appointment_id: int):
    """
    Envia confirmação ao cliente + aviso ao profissional.
    Chamada imediatamente após criar agendamento.
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

        # ── Notificar CLIENTE (confirmação) ──
        client_msgs = build_confirmation_message(
            client_name=client.name,
            service_name=service_name,
            professional_name=prof_user.name,
            date_str=date_str,
            time_str=time_str,
        )

        email_ok = send_email(client.email, "Agendamento Confirmado — HoraCerta", client_msgs["email"])
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

        email_ok = send_email(prof_user.email, "Novo Agendamento — HoraCerta", prof_msgs["email"])
        register_notification(apt.id, "new_appointment", "email", email_ok)

        if prof_user.phone:
            wp_ok = send_whatsapp(prof_user.phone, prof_msgs["whatsapp"])
            register_notification(apt.id, "new_appointment", "whatsapp", wp_ok)

        return {"client_notified": True, "professional_notified": True}

    except Exception as e:
        print(f"  [NOTIFY] Erro: {e}")
        return {"error": str(e)}
    finally:
        db.close()

