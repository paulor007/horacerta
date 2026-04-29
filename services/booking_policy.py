"""
Validações de política de agendamento (anti-flood).

Regras configuráveis no admin:
- max_active_appointments: limite de agendamentos ativos por cliente
- min_days_between_bookings: dias mínimos entre agendamentos do mesmo cliente
- client_cancel_hours: até quantas horas antes cliente pode cancelar
"""

from datetime import date as date_type, datetime, timedelta
from sqlalchemy.orm import Session

from models.appointment import Appointment
from models.system_settings import SystemSettings


def get_booking_policy(db: Session) -> dict:
    """Retorna a política atual com defaults se settings não existir."""
    settings = db.query(SystemSettings).first()
    if not settings:
        return {
            "max_active_appointments": 1,
            "min_days_between_bookings": 15,
            "client_cancel_hours": 24,
        }
    return {
        "max_active_appointments": settings.max_active_appointments or 1,
        "min_days_between_bookings": settings.min_days_between_bookings or 15,
        "client_cancel_hours": settings.client_cancel_hours or 24,
    }


def validate_can_book(
    db: Session,
    client_id: int,
    target_date: date_type,
) -> tuple[bool, str]:
    """
    Verifica se o cliente pode criar um novo agendamento.

    Retorna (pode_agendar: bool, mensagem_erro: str).
    Mensagem vazia se pode agendar.
    """
    policy = get_booking_policy(db)

    # 1. Conta agendamentos ATIVOS (futuros, não cancelados)
    today = date_type.today()
    active_count = (
        db.query(Appointment)
        .filter(
            Appointment.client_id == client_id,
            Appointment.date >= today,
            Appointment.status.in_(["scheduled", "confirmed"]),
        )
        .count()
    )

    if active_count >= policy["max_active_appointments"]:
        if policy["max_active_appointments"] == 1:
            return False, (
                "Você já tem um agendamento ativo. "
                "Para agendar outro, conclua ou cancele o atual."
            )
        return False, (
            f"Limite de {policy['max_active_appointments']} agendamentos ativos atingido. "
            "Cancele algum para criar outro."
        )

    # 2. Verifica intervalo mínimo desde o último agendamento concluído ou agendado
    if policy["min_days_between_bookings"] > 0:
        # Pega o último agendamento (ativo ou concluído) do cliente
        last_apt = (
            db.query(Appointment)
            .filter(
                Appointment.client_id == client_id,
                Appointment.status.in_(["scheduled", "confirmed", "completed"]),
            )
            .order_by(Appointment.date.desc())
            .first()
        )
        if last_apt:
            min_next_date = last_apt.date + timedelta(days=policy["min_days_between_bookings"])
            if target_date < min_next_date:
                (min_next_date - target_date).days
                return False, (
                    f"Você precisa aguardar pelo menos {policy['min_days_between_bookings']} dias "
                    f"entre agendamentos. Próxima data disponível: {min_next_date.strftime('%d/%m/%Y')}."
                )

    return True, ""


def validate_can_cancel(
    db: Session,
    appointment: Appointment,
    is_client: bool,
) -> tuple[bool, str]:
    """
    Verifica se um agendamento pode ser cancelado.

    Admin/profissional: sempre pode (a qualquer hora).
    Cliente: só dentro da janela configurada (client_cancel_hours).
    """
    if appointment.status not in ("scheduled", "confirmed"):
        return False, f"Agendamento com status '{appointment.status}' não pode ser cancelado"

    if not is_client:
        return True, ""

    policy = get_booking_policy(db)
    apt_datetime = datetime.combine(appointment.date, appointment.start_time)
    cancel_deadline = apt_datetime - timedelta(hours=policy["client_cancel_hours"])

    if datetime.now() > cancel_deadline:
        return False, (
            f"Cancelamento permitido até {policy['client_cancel_hours']}h antes do horário. "
            f"Para cancelar agora, entre em contato com o estabelecimento."
        )

    return True, ""