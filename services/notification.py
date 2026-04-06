"""
Serviço de notificação — envia lembretes por email e WhatsApp.

Canais:
- Email: SMTP (funciona sem configuração extra)
- WhatsApp: Evolution API (requer servidor + QR Code)

Para portfolio, email funciona imediatamente.
WhatsApp fica preparado para ativar.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

import requests

from core.config import settings
from core.database import SessionLocal
from models.notification import Notification


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Envia email via SMTP."""
    if not settings.EMAIL_USER or not settings.EMAIL_PASSWORD:
        print(f"  [EMAIL] Simulando envio para {to_email}: {subject}")
        return True  # Simula sucesso em dev

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.EMAIL_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_USER, to_email, msg.as_string())

        print(f"  [EMAIL] Enviado para {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"  [EMAIL] Erro ao enviar para {to_email}: {e}")
        return False


def send_whatsapp(phone: str, message: str) -> bool:
    """
    Envia mensagem via WhatsApp (Evolution API).

    Requer Evolution API rodando. Em dev, simula o envio.
    Para ativar: configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env
    """
    evolution_url = getattr(settings, "EVOLUTION_API_URL", "")
    evolution_key = getattr(settings, "EVOLUTION_API_KEY", "")
    evolution_instance = getattr(settings, "EVOLUTION_INSTANCE", "")

    if not evolution_url or not evolution_key:
        print(f"  [WHATSAPP] Simulando envio para {phone}: {message[:50]}...")
        return True  # Simula sucesso em dev

    try:
        # Formatar número (remover parênteses, espaços, hífens)
        clean_phone = phone.replace("(", "").replace(")", "").replace(" ", "").replace("-", "")
        if not clean_phone.startswith("55"):
            clean_phone = "55" + clean_phone

        url = f"{evolution_url}/message/sendText/{evolution_instance}"
        headers = {
            "apikey": evolution_key,
            "Content-Type": "application/json",
        }
        payload = {
            "number": clean_phone,
            "text": message,
        }

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()

        print(f"  [WHATSAPP] Enviado para {phone}")
        return True
    except Exception as e:
        print(f"  [WHATSAPP] Erro ao enviar para {phone}: {e}")
        return False


def register_notification(
    appointment_id: int,
    notification_type: str,
    channel: str,
    success: bool,
):
    """Registra notificação no banco."""
    db = SessionLocal()
    try:
        notif = Notification(
            appointment_id=appointment_id,
            type=notification_type,
            channel=channel,
            status="sent" if success else "failed",
            sent_at=datetime.now(timezone.utc) if success else None,
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"  [DB] Erro ao registrar notificação: {e}")
    finally:
        db.close()


def build_reminder_message(client_name: str, service_name: str, professional_name: str,
                           date_str: str, time_str: str) -> dict:
    """Monta mensagens de lembrete para email e WhatsApp."""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🕐 Lembrete — HoraCerta</h2>
        <p>Olá <strong>{client_name}</strong>,</p>
        <p>Lembrete do seu agendamento:</p>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;">📋 <strong>Serviço:</strong> {service_name}</p>
            <p style="margin: 4px 0;">👤 <strong>Profissional:</strong> {professional_name}</p>
            <p style="margin: 4px 0;">📅 <strong>Data:</strong> {date_str}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horário:</strong> {time_str}</p>
        </div>
        <p style="color: #64748b; font-size: 14px;">
            Caso precise cancelar, faça com até 2 horas de antecedência.
        </p>
        <p style="color: #94a3b8; font-size: 12px;">Barbearia Horizonte — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"🕐 *Lembrete — HoraCerta*\n\n"
        f"Olá {client_name}!\n\n"
        f"Lembrete do seu agendamento:\n"
        f"📋 *Serviço:* {service_name}\n"
        f"👤 *Profissional:* {professional_name}\n"
        f"📅 *Data:* {date_str}\n"
        f"⏰ *Horário:* {time_str}\n\n"
        f"Caso precise cancelar, faça com até 2h de antecedência.\n\n"
        f"_Barbearia Horizonte — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}


def build_confirmation_message(client_name: str, service_name: str, professional_name: str,
                                date_str: str, time_str: str) -> dict:
    """Monta mensagens de confirmação para email e WhatsApp."""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #22c55e;">✅ Agendamento Confirmado — HoraCerta</h2>
        <p>Olá <strong>{client_name}</strong>,</p>
        <p>Seu agendamento foi confirmado!</p>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;">📋 <strong>Serviço:</strong> {service_name}</p>
            <p style="margin: 4px 0;">👤 <strong>Profissional:</strong> {professional_name}</p>
            <p style="margin: 4px 0;">📅 <strong>Data:</strong> {date_str}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horário:</strong> {time_str}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">Barbearia Horizonte — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"✅ *Agendamento Confirmado — HoraCerta*\n\n"
        f"Olá {client_name}!\n\n"
        f"Seu agendamento foi confirmado:\n"
        f"📋 *Serviço:* {service_name}\n"
        f"👤 *Profissional:* {professional_name}\n"
        f"📅 *Data:* {date_str}\n"
        f"⏰ *Horário:* {time_str}\n\n"
        f"_Barbearia Horizonte — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}


def build_professional_notification(professional_name: str, client_name: str,
                                     service_name: str, date_str: str, time_str: str) -> dict:
    """Monta mensagens para o profissional quando recebe novo agendamento."""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #2563eb;">📅 Novo Agendamento — HoraCerta</h2>
        <p>Olá <strong>{professional_name}</strong>,</p>
        <p>Novo agendamento na sua agenda:</p>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;">👤 <strong>Cliente:</strong> {client_name}</p>
            <p style="margin: 4px 0;">📋 <strong>Serviço:</strong> {service_name}</p>
            <p style="margin: 4px 0;">📅 <strong>Data:</strong> {date_str}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horário:</strong> {time_str}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">Barbearia Horizonte — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"📅 *Novo Agendamento — HoraCerta*\n\n"
        f"Olá {professional_name}!\n\n"
        f"Novo agendamento:\n"
        f"👤 *Cliente:* {client_name}\n"
        f"📋 *Serviço:* {service_name}\n"
        f"📅 *Data:* {date_str}\n"
        f"⏰ *Horário:* {time_str}\n\n"
        f"_Barbearia Horizonte — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}