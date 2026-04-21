"""Endpoints de configuração do sistema (admin)."""

import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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


class SettingsResponse(BaseModel):
    cleanup_days: int
    cleanup_enabled: bool
    last_cleanup_at: datetime | None
    last_cleanup_count: int

    model_config = {"from_attributes": True}


def _get_or_create_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(cleanup_days=90, cleanup_enabled=False)
        db.add(settings)
        db.commit()
        db.refresh(settings)
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


@router.post("/cleanup-now")
def cleanup_now(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """
    Limpa agora. ANTES, gera snapshots mensais pra preservar faturamento.
    """
    settings = _get_or_create_settings(db)

    # PASSO 1: gerar snapshots mensais antes de apagar
    snapshots_created = generate_missing_snapshots(db)

    # PASSO 2: apagar
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

    logger.info("Manual cleanup: %d appointments deleted, %d snapshots preserved",
                deleted, len(snapshots_created))
    return {
        "message": f"{deleted} agendamentos antigos removidos. Faturamento preservado em {len(snapshots_created)} snapshots mensais.",
        "deleted": deleted,
        "snapshots_created": len(snapshots_created),
        "cutoff_date": cutoff.isoformat(),
        "cleanup_days": settings.cleanup_days,
    }