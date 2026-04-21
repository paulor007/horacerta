"""Endpoints de snapshots mensais (admin)."""

import logging
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from api.deps import require_role
from models.user import User
from models.professional import Professional
from models.monthly_snapshot import MonthlySnapshot
from services.monthly_snapshots import (
    generate_snapshot_for_month,
    generate_missing_snapshots,
    close_previous_month,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/snapshots", tags=["Snapshots Mensais (Admin)"])


class SnapshotResponse(BaseModel):
    id: int
    year: int
    month: int
    professional_id: int | None
    professional_name: str | None = None
    total_completed: int
    total_cancelled: int
    total_no_show: int
    total_revenue: Decimal
    unique_clients: int
    generated_at: datetime | None

    model_config = {"from_attributes": True}


class YearlyRevenueItem(BaseModel):
    year: int
    month: int
    total_revenue: Decimal
    total_completed: int


@router.get("", response_model=list[SnapshotResponse])
def list_snapshots(
    year: int | None = Query(None),
    professional_id: int | None = Query(None, description="null=geral do mês"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Lista snapshots. Se não passar professional_id, retorna só os gerais (professional_id=NULL)."""
    query = db.query(MonthlySnapshot)

    if year:
        query = query.filter(MonthlySnapshot.year == year)

    if professional_id is not None:
        query = query.filter(MonthlySnapshot.professional_id == professional_id)
    else:
        query = query.filter(MonthlySnapshot.professional_id.is_(None))

    snapshots = query.order_by(
        MonthlySnapshot.year.desc(),
        MonthlySnapshot.month.desc(),
    ).all()

    result = []
    for s in snapshots:
        data = SnapshotResponse.model_validate(s)
        if s.professional_id:
            prof = (
                db.query(Professional)
                .options(joinedload(Professional.user))
                .filter(Professional.id == s.professional_id)
                .first()
            )
            data.professional_name = prof.user.name if prof and prof.user else None
        result.append(data)

    return result


@router.get("/yearly-revenue")
def yearly_revenue(
    year: int = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Faturamento anual (12 meses) consolidado."""
    snapshots = (
        db.query(MonthlySnapshot)
        .filter(
            MonthlySnapshot.year == year,
            MonthlySnapshot.professional_id.is_(None),
        )
        .order_by(MonthlySnapshot.month)
        .all()
    )

    # Inicializa 12 meses com 0
    months = {i: {"month": i, "total_revenue": 0, "total_completed": 0} for i in range(1, 13)}

    for s in snapshots:
        months[s.month] = {
            "month": s.month,
            "total_revenue": float(s.total_revenue),
            "total_completed": s.total_completed,
        }

    total_year = sum(m["total_revenue"] for m in months.values())
    total_completed = sum(m["total_completed"] for m in months.values())

    return {
        "year": year,
        "total_revenue": total_year,
        "total_completed": total_completed,
        "months": list(months.values()),
    }


@router.post("/generate")
def generate_snapshot(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    overwrite: bool = Query(False),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Gera snapshot de um mês específico manualmente."""
    result = generate_snapshot_for_month(db, year, month, overwrite=overwrite)
    return result


@router.post("/generate-missing")
def generate_missing(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Gera snapshots de todos os meses faltantes."""
    results = generate_missing_snapshots(db)
    return {"generated": len(results), "snapshots": results}


@router.post("/close-previous-month")
def close_prev_month(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Fecha o mês anterior (útil pra testes ou se o cron não rodou)."""
    return close_previous_month(db)