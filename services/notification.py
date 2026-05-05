"""
Serviço de notificação — envia lembretes por email e WhatsApp.

Canais:
- Email: Resend API (HTTP) — funciona em qualquer hospedagem (Render, Vercel, Railway)
- WhatsApp: Evolution API (requer servidor + QR Code)
"""

from datetime import datetime, timezone

import requests

from core.config import settings
from core.database import SessionLocal
from models.notification import Notification


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Envia email via Resend API (HTTP).

    Por que Resend e não SMTP?
    O Render Free (e muitos providers gratuitos) BLOQUEIAM portas SMTP (587/465).
    Resend usa API HTTP, então funciona em qualquer hospedagem.

    Plano gratuito: 3.000 emails/mês.
    Configurar:
    - RESEND_API_KEY=re_XXXX (criar em https://resend.com/api-keys)
    - EMAIL_FROM=onboarding@resend.dev (ou seu domínio verificado)
    """
    api_key = getattr(settings, "RESEND_API_KEY", "") or ""
    email_from = getattr(settings, "EMAIL_FROM", "") or "onboarding@resend.dev"

    if not api_key:
        # Fallback: modo simulação se Resend não configurado
        print(f"  [EMAIL] Simulando envio para {to_email}: {subject}")
        return True

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": f"{settings.EMPRESA_NOME} <{email_from}>",
                "to": [to_email],
                "subject": subject,
                "html": body,
            },
            timeout=15,
        )

        if response.status_code in (200, 201, 202):
            print(f"  [EMAIL] Enviado via Resend para {to_email}: {subject}")
            return True
        else:
            print(f"  [EMAIL] Falha Resend ({response.status_code}) para {to_email}: {response.text[:200]}")
            return False
    except requests.exceptions.Timeout:
        print(f"  [EMAIL] Timeout ao enviar para {to_email}")
        return False
    except Exception as e:
        print(f"  [EMAIL] Erro ao enviar para {to_email}: {e}")
        return False


def send_whatsapp(phone: str, message: str) -> bool:
    """Envia mensagem via WhatsApp (Evolution API)."""
    evolution_url = getattr(settings, "EVOLUTION_API_URL", "")
    evolution_key = getattr(settings, "EVOLUTION_API_KEY", "")
    evolution_instance = getattr(settings, "EVOLUTION_INSTANCE", "")

    if not evolution_url or not evolution_key:
        print(f"  [WHATSAPP] Simulando envio para {phone}: {message[:50]}...")
        return True

    try:
        clean_phone = phone.replace("(", "").replace(")", "").replace(" ", "").replace("-", "")
        if not clean_phone.startswith("55"):
            clean_phone = "55" + clean_phone

        url = f"{evolution_url}/message/sendText/{evolution_instance}"
        headers = {"apikey": evolution_key, "Content-Type": "application/json"}
        payload = {"number": clean_phone, "text": message}

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()

        print(f"  [WHATSAPP] Enviado para {phone}")
        return True
    except Exception as e:
        print(f"  [WHATSAPP] Erro ao enviar para {phone}: {e}")
        return False


def register_notification(appointment_id: int, notification_type: str, channel: str, success: bool):
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
                           date_str: str, time_str: str,
                           confirm_link: str | None = None,
                           cancel_link: str | None = None) -> dict:
    """Monta mensagens de lembrete para email e WhatsApp.

    Se confirm_link e cancel_link forem fornecidos, inclui botões de ação no email.
    """
    # Botões HTML (apenas se links fornecidos)
    action_buttons_email = ""
    action_text_whatsapp = ""

    if confirm_link and cancel_link:
        action_buttons_email = f"""
        <div style="text-align: center; margin: 24px 0;">
            <a href="{confirm_link}" style="display: inline-block; background: #22c55e; color: white;
                text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 4px 8px;
                font-weight: bold;">
                ✅ CONFIRMAR PRESENÇA
            </a>
            <a href="{cancel_link}" style="display: inline-block; background: #ef4444; color: white;
                text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 4px 8px;
                font-weight: bold;">
                ❌ PRECISO CANCELAR
            </a>
        </div>
        <p style="color: #64748b; font-size: 13px; text-align: center;">
            Confirme sua presença para garantir o horário.
            Se não puder ir, cancele para liberarmos o horário para outro cliente.
        </p>
        """
        action_text_whatsapp = (
            f"\n*Confirme ou cancele:*\n"
            f"✅ Confirmar: {confirm_link}\n"
            f"❌ Cancelar: {cancel_link}\n"
        )

    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🕐 Lembrete — {settings.EMPRESA_NOME}</h2>
        <p>Olá <strong>{client_name}</strong>,</p>
        <p>Lembrete do seu agendamento amanhã:</p>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;">📋 <strong>Serviço:</strong> {service_name}</p>
            <p style="margin: 4px 0;">👤 <strong>Profissional:</strong> {professional_name}</p>
            <p style="margin: 4px 0;">📅 <strong>Data:</strong> {date_str}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horário:</strong> {time_str}</p>
        </div>
        {action_buttons_email}
        <p style="color: #94a3b8; font-size: 12px;">{settings.EMPRESA_NOME} — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"🕐 *Lembrete — {settings.EMPRESA_NOME}*\n\n"
        f"Olá {client_name}!\n\n"
        f"Lembrete do seu agendamento amanhã:\n"
        f"📋 *Serviço:* {service_name}\n"
        f"👤 *Profissional:* {professional_name}\n"
        f"📅 *Data:* {date_str}\n"
        f"⏰ *Horário:* {time_str}\n"
        f"{action_text_whatsapp}\n"
        f"_{settings.EMPRESA_NOME} — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}


def build_confirmation_message(client_name: str, service_name: str, professional_name: str,
                                date_str: str, time_str: str,
                                client_password: str | None = None,
                                client_email: str | None = None) -> dict:
    """Monta mensagens de confirmação. Se client_password, inclui credenciais de acesso."""

    # Bloco de credenciais (só para novos clientes)
    credentials_email = ""
    credentials_whatsapp = ""
    if client_password and client_email:
        credentials_email = f"""
        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; font-weight: bold; color: #92400e;">🔑 Seus dados de acesso</p>
            <p style="margin: 4px 0; color: #78350f;">Email: <strong>{client_email}</strong></p>
            <p style="margin: 4px 0; color: #78350f;">Senha: <strong>{client_password}</strong></p>
            <p style="margin: 8px 0 0; font-size: 12px; color: #92400e;">
                Use para acompanhar seus agendamentos. Você pode alterar a senha quando quiser.
            </p>
        </div>
        """
        credentials_whatsapp = (
            f"\n🔑 *Seus dados de acesso:*\n"
            f"📧 Email: {client_email}\n"
            f"🔒 Senha: {client_password}\n"
            f"_Use para acompanhar seus agendamentos._\n"
        )

    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #22c55e;">✅ Agendamento Confirmado — {settings.EMPRESA_NOME}</h2>
        <p>Olá <strong>{client_name}</strong>,</p>
        <p>Seu agendamento foi confirmado!</p>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;">📋 <strong>Serviço:</strong> {service_name}</p>
            <p style="margin: 4px 0;">👤 <strong>Profissional:</strong> {professional_name}</p>
            <p style="margin: 4px 0;">📅 <strong>Data:</strong> {date_str}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horário:</strong> {time_str}</p>
        </div>
        {credentials_email}
        <p style="color: #94a3b8; font-size: 12px;">{settings.EMPRESA_NOME} — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"✅ *Agendamento Confirmado — {settings.EMPRESA_NOME}*\n\n"
        f"Olá {client_name}!\n\n"
        f"Seu agendamento foi confirmado:\n"
        f"📋 *Serviço:* {service_name}\n"
        f"👤 *Profissional:* {professional_name}\n"
        f"📅 *Data:* {date_str}\n"
        f"⏰ *Horário:* {time_str}\n"
        f"{credentials_whatsapp}\n"
        f"_{settings.EMPRESA_NOME} — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}


def build_professional_notification(professional_name: str, client_name: str,
                                     service_name: str, date_str: str, time_str: str) -> dict:
    """Monta mensagens para o profissional quando recebe novo agendamento."""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #2563eb;">📅 Novo Agendamento — {settings.EMPRESA_NOME}</h2>
        <p>Olá <strong>{professional_name}</strong>,</p>
        <p>Novo agendamento na sua agenda:</p>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;">👤 <strong>Cliente:</strong> {client_name}</p>
            <p style="margin: 4px 0;">📋 <strong>Serviço:</strong> {service_name}</p>
            <p style="margin: 4px 0;">📅 <strong>Data:</strong> {date_str}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horário:</strong> {time_str}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">{settings.EMPRESA_NOME} — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"📅 *Novo Agendamento — {settings.EMPRESA_NOME}*\n\n"
        f"Olá {professional_name}!\n\n"
        f"Novo agendamento:\n"
        f"👤 *Cliente:* {client_name}\n"
        f"📋 *Serviço:* {service_name}\n"
        f"📅 *Data:* {date_str}\n"
        f"⏰ *Horário:* {time_str}\n\n"
        f"_{settings.EMPRESA_NOME} — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}


def build_review_request_message(client_name: str, professional_name: str,
                                  service_name: str, date_str: str,
                                  review_url: str) -> dict:
    """Monta mensagem pedindo avaliação após atendimento."""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">⭐ Como foi seu atendimento? — {settings.EMPRESA_NOME}</h2>
        <p>Olá <strong>{client_name}</strong>,</p>
        <p>Seu atendimento com <strong>{professional_name}</strong> foi concluído!</p>
        <div style="background: #fffbeb; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;">📋 <strong>Serviço:</strong> {service_name}</p>
            <p style="margin: 4px 0;">📅 <strong>Data:</strong> {date_str}</p>
        </div>
        <p>Sua opinião é muito importante para nós! Avalie o atendimento:</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="{review_url}" style="background: #f59e0b; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: bold; display: inline-block;">
                ⭐ Avaliar Atendimento
            </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">{settings.EMPRESA_NOME} — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"⭐ *Como foi seu atendimento?*\n\n"
        f"Olá {client_name}!\n\n"
        f"Seu atendimento com *{professional_name}* ({service_name}) foi concluído.\n\n"
        f"Avalie de 1 a 5 estrelas:\n"
        f"{review_url}\n\n"
        f"_{settings.EMPRESA_NOME} — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}


def build_password_reset_message(client_name: str, new_password: str) -> dict:
    """Monta mensagem de recuperação de senha (forgot-password)."""
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🔑 Sua nova senha — {settings.EMPRESA_NOME}</h2>
        <p>Olá <strong>{client_name}</strong>,</p>
        <p>Você solicitou uma nova senha de acesso ao sistema.</p>
        <p>Aqui está sua <strong>nova senha</strong>:</p>
        <div style="background: #fef3c7; border: 2px solid #fbbf24; border-radius: 12px; padding: 24px; margin: 16px 0; text-align: center;">
            <p style="margin: 0 0 8px; font-weight: bold; color: #92400e; font-size: 13px;">🔒 NOVA SENHA</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #78350f; letter-spacing: 3px; font-family: 'Courier New', monospace;">
                {new_password}
            </p>
        </div>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; font-weight: bold; color: #475569;">💡 Próximos passos:</p>
            <ol style="margin: 0; padding-left: 20px; color: #64748b;">
                <li style="margin-bottom: 4px;">Acesse o sistema e faça login com essa senha</li>
                <li style="margin-bottom: 4px;">Vá em "Meu Perfil" e altere para uma senha pessoal</li>
                <li>Pronto, sua conta está segura novamente</li>
            </ol>
        </div>
        <p style="color: #64748b; font-size: 13px;">
            Se você não solicitou essa recuperação, ignore este email. Sua senha anterior continuará válida apenas se ninguém tiver acesso a este email.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">{settings.EMPRESA_NOME} — HoraCerta</p>
    </div>
    """

    whatsapp_msg = (
        f"🔑 *Nova senha — {settings.EMPRESA_NOME}*\n\n"
        f"Olá {client_name}!\n\n"
        f"Você solicitou recuperação de senha.\n\n"
        f"🔒 *Sua nova senha:* `{new_password}`\n\n"
        f"_Recomendamos alterar para uma senha pessoal nas configurações._\n\n"
        f"_{settings.EMPRESA_NOME} — HoraCerta_"
    )

    return {"email": email_body, "whatsapp": whatsapp_msg}