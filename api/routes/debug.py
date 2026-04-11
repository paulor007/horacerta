"""
Endpoint de diagnóstico — ajuda a identificar problemas.
Apenas admin pode acessar. Remover em produção.
"""

from datetime import date as datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user
from models.user import User
from models.professional import Professional
from models.service import Service
from models.appointment import Appointment

router = APIRouter(prefix="/api/v1/debug", tags=["Debug"])


@router.get("/check")
def health_check(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Diagnóstico completo do sistema.
    Checa profissionais, serviços, agendamentos e possíveis problemas.
    """
    now = datetime.now()

    # Contar registros
    total_profs = db.query(Professional).count()
    active_profs = db.query(Professional).filter(Professional.is_active.is_(True)).count()
    total_services = db.query(Service).count()
    active_services = db.query(Service).filter(Service.is_active.is_(True)).count()

    # Agendamentos futuros com status "scheduled"
    future_scheduled = (
        db.query(Appointment)
        .filter(
            Appointment.date >= now.date(),
            Appointment.status.in_(["scheduled", "confirmed"]),
        )
        .count()
    )

    # Verificar problemas comuns
    issues = []

    if active_profs == 0:
        issues.append("CRÍTICO: Nenhum profissional ativo")
    if active_services == 0:
        issues.append("CRÍTICO: Nenhum serviço ativo")

    # Verificar profissionais sem user vinculado
    orphan_profs = (
        db.query(Professional)
        .outerjoin(User, Professional.user_id == User.id)
        .filter(User.id.is_(None))
        .count()
    )
    if orphan_profs > 0:
        issues.append(f"AVISO: {orphan_profs} profissional(is) sem usuário vinculado")

    # Agendamentos futuros por profissional
    profs = db.query(Professional).filter(Professional.is_active.is_(True)).all()
    prof_load = {}
    for p in profs:
        count = (
            db.query(Appointment)
            .filter(
                Appointment.professional_id == p.id,
                Appointment.date >= now.date(),
                Appointment.status.in_(["scheduled", "confirmed"]),
            )
            .count()
        )
        name = p.user.name if p.user else f"Prof #{p.id}"
        prof_load[name] = count

    return {
        "server_time": now.isoformat(),
        "server_date": str(now.date()),
        "server_weekday": now.isoweekday(),
        "professionals": {"total": total_profs, "active": active_profs},
        "services": {"total": total_services, "active": active_services},
        "future_scheduled_appointments": future_scheduled,
        "appointments_per_professional": prof_load,
        "issues": issues if issues else ["Nenhum problema detectado"],
    }


@router.delete("/clear-future")
def clear_future_appointments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Limpa todos agendamentos futuros com status 'scheduled' (dados de seed/teste).
    USE APENAS EM DESENVOLVIMENTO.
    """
    if user.role != "admin":
        return {"error": "Apenas admin"}

    now = datetime.now()
    deleted = (
        db.query(Appointment)
        .filter(
            Appointment.date >= now.date(),
            Appointment.status == "scheduled",
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"message": f"{deleted} agendamentos futuros removidos", "deleted": deleted}
