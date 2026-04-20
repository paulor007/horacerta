"""Endpoints de relatórios — dashboard do dono."""

from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from api.deps import get_db, require_role
from models.user import User
from models.appointment import Appointment
from models.professional import Professional
from models.service import Service

router = APIRouter(prefix="/api/v1/reports", tags=["Relatórios"])


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Métricas principais do dono."""
    today = date.today()

    # Agendamentos hoje
    today_count = db.query(Appointment).filter(
        Appointment.date == today,
        Appointment.status.in_(["scheduled", "confirmed"]),
    ).count()

    # Total completados este mês
    first_of_month = today.replace(day=1)
    completed_month = db.query(Appointment).filter(
        Appointment.date >= first_of_month,
        Appointment.status == "completed",
    ).count()

    # Faturamento do mês
    revenue_month = (
        db.query(func.sum(Service.price))
        .join(Appointment, Appointment.service_id == Service.id)
        .filter(
            Appointment.date >= first_of_month,
            Appointment.status == "completed",
        )
        .scalar()
    ) or 0

    # No-shows do mês
    noshows_month = db.query(Appointment).filter(
        Appointment.date >= first_of_month,
        Appointment.status == "no_show",
    ).count()

    # Cancelamentos do mês
    cancelled_month = db.query(Appointment).filter(
        Appointment.date >= first_of_month,
        Appointment.status == "cancelled",
    ).count()

    # Total agendamentos do mês (para taxa)
    total_month = db.query(Appointment).filter(
        Appointment.date >= first_of_month,
    ).count()

    # Taxa de ocupação (completados / total, excluindo cancelled)
    active_month = total_month - cancelled_month
    occupancy = round((completed_month / active_month * 100), 1) if active_month > 0 else 0

    return {
        "today_appointments": today_count,
        "completed_month": completed_month,
        "revenue_month": float(revenue_month),
        "noshows_month": noshows_month,
        "cancelled_month": cancelled_month,
        "occupancy_rate": occupancy,
    }


@router.get("/revenue")
def revenue_by_professional(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Faturamento por profissional."""
    first_of_month = date.today().replace(day=1)

    results = (
        db.query(
            Professional.id,
            User.name,
            func.count(Appointment.id).label("total"),
            func.sum(Service.price).label("revenue"),
        )
        .join(Appointment, Appointment.professional_id == Professional.id)
        .join(Service, Appointment.service_id == Service.id)
        .join(User, Professional.user_id == User.id)
        .filter(
            Appointment.date >= first_of_month,
            Appointment.status == "completed",
        )
        .group_by(Professional.id, User.name)
        .order_by(func.sum(Service.price).desc())
        .all()
    )

    return [
        {
            "professional_id": r.id,
            "name": r.name,
            "appointments": r.total,
            "revenue": float(r.revenue or 0),
        }
        for r in results
    ]


@router.get("/occupancy")
def occupancy_by_day(
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Taxa de ocupação por dia (últimos N dias)."""
    today = date.today()
    result = []

    for i in range(days):
        target = today - timedelta(days=i)
        total = db.query(Appointment).filter(Appointment.date == target).count()
        completed = db.query(Appointment).filter(
            Appointment.date == target,
            Appointment.status == "completed",
        ).count()

        result.append({
            "date": target.isoformat(),
            "total": total,
            "completed": completed,
            "rate": round((completed / total * 100), 1) if total > 0 else 0,
        })

    return result

@router.delete("/cleanup")
def cleanup_old_appointments(
    days: int = Query(90, ge=7, le=365, description="Apagar registros mais antigos que X dias"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """
    Limpa agendamentos antigos (concluídos, cancelados, no-show).
    Mantém os 'scheduled' e 'confirmed' intactos.
    Padrão: apaga registros com mais de 90 dias.
    """
    from datetime import timedelta
    cutoff = date.today() - timedelta(days=days)
 
    deleted = (
        db.query(Appointment)
        .filter(
            Appointment.date < cutoff,
            Appointment.status.in_(["completed", "cancelled", "no_show"]),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
 
    return {
        "message": f"{deleted} agendamentos antigos removidos (antes de {cutoff.isoformat()})",
        "deleted": deleted,
        "cutoff_date": cutoff.isoformat(),
    }