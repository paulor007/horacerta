"""
Serviço de snapshots mensais.

Gera resumos financeiros mensais que são preservados mesmo após a limpeza
de agendamentos antigos. Assim, relatórios anuais e históricos financeiros
continuam funcionando indefinidamente.
"""

import logging
from datetime import date
from decimal import Decimal
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from models.appointment import Appointment
from models.professional import Professional
from models.service import Service
from models.monthly_snapshot import MonthlySnapshot

logger = logging.getLogger(__name__)


def generate_snapshot_for_month(
    db: Session,
    year: int,
    month: int,
    overwrite: bool = False,
) -> dict:
    """
    Gera snapshot de um mês específico para cada profissional + totalizador geral.
    
    overwrite=True: regenera se já existir (útil pra correções).
    overwrite=False: pula se já existir (usado pela task automática).
    """
    # Verificar se já existe (snapshot geral)
    if not overwrite:
        existing = (
            db.query(MonthlySnapshot)
            .filter(
                MonthlySnapshot.year == year,
                MonthlySnapshot.month == month,
                MonthlySnapshot.professional_id.is_(None),
            )
            .first()
        )
        if existing:
            return {"skipped": True, "reason": "snapshot já existe"}

    # Se overwrite, apaga os existentes desse mês
    if overwrite:
        db.query(MonthlySnapshot).filter(
            MonthlySnapshot.year == year,
            MonthlySnapshot.month == month,
        ).delete(synchronize_session=False)
        db.commit()

    # Gerar snapshot por profissional
    profs = db.query(Professional).all()
    total_completed_geral = 0
    total_cancelled_geral = 0
    total_noshow_geral = 0
    total_revenue_geral = Decimal("0")

    for prof in profs:
        # Contagens por status
        completed = (
            db.query(Appointment)
            .filter(
                Appointment.professional_id == prof.id,
                func.extract("year", Appointment.date) == year,
                func.extract("month", Appointment.date) == month,
                Appointment.status == "completed",
            )
            .count()
        )

        cancelled = (
            db.query(Appointment)
            .filter(
                Appointment.professional_id == prof.id,
                func.extract("year", Appointment.date) == year,
                func.extract("month", Appointment.date) == month,
                Appointment.status == "cancelled",
            )
            .count()
        )

        no_show = (
            db.query(Appointment)
            .filter(
                Appointment.professional_id == prof.id,
                func.extract("year", Appointment.date) == year,
                func.extract("month", Appointment.date) == month,
                Appointment.status == "no_show",
            )
            .count()
        )

        # Faturamento (soma dos preços dos serviços concluídos)
        revenue_query = (
            db.query(func.coalesce(func.sum(Service.price), 0))
            .join(Appointment, Appointment.service_id == Service.id)
            .filter(
                Appointment.professional_id == prof.id,
                func.extract("year", Appointment.date) == year,
                func.extract("month", Appointment.date) == month,
                Appointment.status == "completed",
            )
        )
        revenue = revenue_query.scalar() or Decimal("0")

        # Clientes únicos no mês
        clients_count = (
            db.query(func.count(distinct(Appointment.client_id)))
            .filter(
                Appointment.professional_id == prof.id,
                func.extract("year", Appointment.date) == year,
                func.extract("month", Appointment.date) == month,
                Appointment.status == "completed",
            )
            .scalar() or 0
        )

        # Se teve movimento, cria snapshot
        if completed + cancelled + no_show > 0:
            snapshot = MonthlySnapshot(
                year=year,
                month=month,
                professional_id=prof.id,
                total_completed=completed,
                total_cancelled=cancelled,
                total_no_show=no_show,
                total_revenue=revenue,
                unique_clients=clients_count,
            )
            db.add(snapshot)

        total_completed_geral += completed
        total_cancelled_geral += cancelled
        total_noshow_geral += no_show
        total_revenue_geral += revenue

    # Clientes únicos do mês (geral)
    clients_geral = (
        db.query(func.count(distinct(Appointment.client_id)))
        .filter(
            func.extract("year", Appointment.date) == year,
            func.extract("month", Appointment.date) == month,
            Appointment.status == "completed",
        )
        .scalar() or 0
    )

    # Snapshot geral (professional_id = NULL)
    geral = MonthlySnapshot(
        year=year,
        month=month,
        professional_id=None,
        total_completed=total_completed_geral,
        total_cancelled=total_cancelled_geral,
        total_no_show=total_noshow_geral,
        total_revenue=total_revenue_geral,
        unique_clients=clients_geral,
    )
    db.add(geral)
    db.commit()

    logger.info(
        "Snapshot %d/%d: %d concluídos, R$%s faturados, %d clientes",
        month, year, total_completed_geral, total_revenue_geral, clients_geral,
    )

    return {
        "year": year,
        "month": month,
        "total_completed": total_completed_geral,
        "total_cancelled": total_cancelled_geral,
        "total_no_show": total_noshow_geral,
        "total_revenue": float(total_revenue_geral),
        "unique_clients": clients_geral,
    }


def generate_missing_snapshots(db: Session) -> list[dict]:
    """
    Gera snapshots para todos os meses que ainda não têm snapshot.
    Útil pra rodar uma vez na instalação ou quando o banco cresce muito.
    """
    # Achar o mês mais antigo com agendamentos
    oldest = db.query(func.min(Appointment.date)).scalar()
    if not oldest:
        return []

    today = date.today()
    results = []

    year = oldest.year
    month = oldest.month

    # Iterar mês a mês até o mês anterior ao atual
    while (year, month) < (today.year, today.month):
        result = generate_snapshot_for_month(db, year, month, overwrite=False)
        if not result.get("skipped"):
            results.append(result)

        month += 1
        if month > 12:
            month = 1
            year += 1

    return results


def close_previous_month(db: Session) -> dict:
    """
    Fecha o mês anterior (gera snapshot).
    Chamado automaticamente no dia 1 de cada mês.
    """
    today = date.today()
    if today.month == 1:
        year = today.year - 1
        month = 12
    else:
        year = today.year
        month = today.month - 1

    return generate_snapshot_for_month(db, year, month, overwrite=True)