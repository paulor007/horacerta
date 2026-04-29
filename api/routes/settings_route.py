"""Endpoints de configuração do sistema (admin)."""

import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.database import get_db
from api.deps import require_role
from models.user import User
from models.appointment import Appointment
from models.system_settings import SystemSettings
from services.monthly_snapshots import generate_missing_snapshots

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/system", tags=["Sistema (Admin)"])


VALID_CLEANUP_DAYS = [1, 7, 15, 30, 90]


class CleanupConfig(BaseModel):
    cleanup_days: int
    cleanup_enabled: bool


class BookingPolicyConfig(BaseModel):
    max_active_appointments: int = Field(ge=1, le=10)
    min_days_between_bookings: int = Field(ge=0, le=365)
    client_cancel_hours: int = Field(ge=1, le=168)  # 1h a 7 dias


class SettingsResponse(BaseModel):
    cleanup_days: int
    cleanup_enabled: bool
    last_cleanup_at: datetime | None
    last_cleanup_count: int
    max_active_appointments: int
    min_days_between_bookings: int
    client_cancel_hours: int

    model_config = {"from_attributes": True}


def _get_or_create_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(
            cleanup_days=90,
            cleanup_enabled=False,
            max_active_appointments=1,
            min_days_between_bookings=15,
            client_cancel_hours=24,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    # Compatibilidade: se settings antigo não tem os novos campos, usa defaults
    if settings.max_active_appointments is None:
        settings.max_active_appointments = 1
    if settings.min_days_between_bookings is None:
        settings.min_days_between_bookings = 15
    if settings.client_cancel_hours is None:
        settings.client_cancel_hours = 24
    db.commit()
    return settings


@router.get("/settings", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    return _get_or_create_settings(db)


@router.put("/settings", response_model=SettingsResponse)
def update_settings(
    data: CleanupConfig,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Atualiza configs de limpeza automática."""
    if data.cleanup_days not in VALID_CLEANUP_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Período inválido. Use: {', '.join(map(str, VALID_CLEANUP_DAYS))} dias",
        )

    settings = _get_or_create_settings(db)
    settings.cleanup_days = data.cleanup_days
    settings.cleanup_enabled = data.cleanup_enabled
    settings.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings)
    return settings


@router.put("/settings/booking-policy", response_model=SettingsResponse)
def update_booking_policy(
    data: BookingPolicyConfig,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Atualiza política de agendamento (anti-flood, cancelamento)."""
    settings = _get_or_create_settings(db)
    settings.max_active_appointments = data.max_active_appointments
    settings.min_days_between_bookings = data.min_days_between_bookings
    settings.client_cancel_hours = data.client_cancel_hours
    settings.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings)
    logger.info(
        "Booking policy updated: max=%d, min_days=%d, cancel_hours=%d",
        data.max_active_appointments,
        data.min_days_between_bookings,
        data.client_cancel_hours,
    )
    return settings


@router.post("/cleanup-now")
def cleanup_now(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Limpa agora. Antes, gera snapshots mensais pra preservar faturamento."""
    settings = _get_or_create_settings(db)
    snapshots_created = generate_missing_snapshots(db)
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
    return {
        "message": f"{deleted} agendamentos antigos removidos. Faturamento preservado em {len(snapshots_created)} snapshots.",
        "deleted": deleted,
        "snapshots_created": len(snapshots_created),
    }