"""
Endpoint de estatísticas individuais do profissional.

- Profissional loga e vê suas próprias estatísticas (sem query param)
- Admin pode ver de qualquer profissional via ?professional_id=X
"""

from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from api.deps import get_current_user
from models.user import User
from models.professional import Professional
from models.appointment import Appointment
from models.review import Review


router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.get("/professionals-with-names")
def list_professionals_with_names(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista profissionais com nome/email (pra dropdown admin no MyStats)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")

    profs = (
        db.query(Professional)
        .options(joinedload(Professional.user))
        .filter(Professional.is_active.is_(True))
        .all()
    )

    return [
        {
            "id": p.id,
            "name": p.user.name if p.user else f"Profissional #{p.id}",
            "email": p.user.email if p.user else "",
            "specialty": p.specialty or "",
        }
        for p in profs
    ]


@router.get("/professional-stats")
def get_professional_stats(
    professional_id: int | None = Query(None, description="Admin only - ID do profissional"),
    start_date: date | None = Query(None, description="Data inicial (default: 90 dias atrás)"),
    end_date: date | None = Query(None, description="Data final (default: hoje)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna estatísticas do profissional no período especificado."""

    # ── Determina qual profissional ──
    if professional_id is not None:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Apenas admin pode ver estatísticas de outros profissionais",
            )
        prof = db.query(Professional).filter(Professional.id == professional_id).first()
        if not prof:
            raise HTTPException(status_code=404, detail="Profissional não encontrado")
    else:
        prof = db.query(Professional).filter(Professional.user_id == current_user.id).first()
        if not prof:
            raise HTTPException(
                status_code=403,
                detail="Usuário não é profissional - admin deve passar ?professional_id=X",
            )

    # ── Período (default: últimos 90 dias) ──
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=90)

    # ── Busca agendamentos ──
    apts = (
        db.query(Appointment)
        .filter(
            Appointment.professional_id == prof.id,
            Appointment.date >= start_date,
            Appointment.date <= end_date,
        )
        .all()
    )

    # ── Totais ──
    total = len(apts)
    completed = [a for a in apts if a.status == "completed"]
    cancelled = [a for a in apts if a.status == "cancelled"]
    noshow = [a for a in apts if a.status == "no_show"]
    scheduled = [a for a in apts if a.status == "scheduled"]
    revenue = sum(float(a.service.price) if a.service else 0.0 for a in completed)

    no_show_rate = round((len(noshow) / total * 100), 2) if total > 0 else 0.0
    cancellation_rate = round((len(cancelled) / total * 100), 2) if total > 0 else 0.0
    completion_rate = round((len(completed) / total * 100), 2) if total > 0 else 0.0

    # ── Avaliações ──
    reviews = (
        db.query(Review)
        .filter(
            Review.professional_id == prof.id,
            Review.created_at >= start_date,
        )
        .all()
    )

    rating_count = len(reviews)
    rating_avg = round(sum(r.rating for r in reviews) / rating_count, 2) if rating_count > 0 else 0.0

    rating_dist = {str(i): 0 for i in range(1, 6)}
    for r in reviews:
        rating_dist[str(r.rating)] = rating_dist.get(str(r.rating), 0) + 1

    # ── Faturamento por mês ──
    revenue_by_month_data: dict[str, dict] = {}
    for apt in completed:
        key = apt.date.strftime("%Y-%m")
        if key not in revenue_by_month_data:
            revenue_by_month_data[key] = {"revenue": 0.0, "appointments": 0}
        revenue_by_month_data[key]["revenue"] += float(apt.service.price) if apt.service else 0.0
        revenue_by_month_data[key]["appointments"] += 1

    revenue_by_month = [
        {
            "month": k,
            "month_label": _format_month(k),
            "revenue": round(v["revenue"], 2),
            "appointments": v["appointments"],
        }
        for k, v in sorted(revenue_by_month_data.items())
    ]

    # ── Top serviços ──
    services_data: dict[str, dict] = {}
    for apt in completed:
        if apt.service:
            key = apt.service.name
            if key not in services_data:
                services_data[key] = {"count": 0, "revenue": 0.0}
            services_data[key]["count"] += 1
            services_data[key]["revenue"] += float(apt.service.price)

    top_services = sorted(
        [
            {
                "service_name": k,
                "count": v["count"],
                "revenue": round(v["revenue"], 2),
            }
            for k, v in services_data.items()
        ],
        key=lambda x: x["revenue"],
        reverse=True,
    )[:5]

    # ── Top clientes ──
    clients_data: dict[int, dict] = {}
    for apt in completed:
        if apt.client:
            key = apt.client.id
            if key not in clients_data:
                clients_data[key] = {
                    "client_name": apt.client.name,
                    "count": 0,
                    "revenue": 0.0,
                }
            clients_data[key]["count"] += 1
            clients_data[key]["revenue"] += float(apt.service.price) if apt.service else 0.0

    top_clients = sorted(
        [
            {
                "client_name": v["client_name"],
                "appointments": v["count"],
                "revenue": round(v["revenue"], 2),
            }
            for v in clients_data.values()
        ],
        key=lambda x: x["appointments"],
        reverse=True,
    )[:5]

    # ── Info do profissional ──
    prof_user = db.query(User).filter(User.id == prof.user_id).first()

    return {
        "professional": {
            "id": prof.id,
            "name": prof_user.name if prof_user else "Desconhecido",
            "email": prof_user.email if prof_user else "",
            "avatar_url": getattr(prof_user, "avatar_url", None) if prof_user else None,
        },
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": (end_date - start_date).days,
        },
        "totals": {
            "appointments_total": total,
            "appointments_completed": len(completed),
            "appointments_cancelled": len(cancelled),
            "appointments_no_show": len(noshow),
            "appointments_scheduled": len(scheduled),
            "revenue": round(revenue, 2),
            "completion_rate": completion_rate,
            "cancellation_rate": cancellation_rate,
            "no_show_rate": no_show_rate,
        },
        "ratings": {
            "count": rating_count,
            "average": rating_avg,
            "distribution": rating_dist,
        },
        "revenue_by_month": revenue_by_month,
        "top_services": top_services,
        "top_clients": top_clients,
    }


def _format_month(ym: str) -> str:
    """Converte '2026-04' em 'Abr/26'."""
    months_pt = {
        "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
        "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
        "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
    }
    try:
        year, month = ym.split("-")
        return f"{months_pt.get(month, month)}/{year[-2:]}"
    except Exception:
        return ym