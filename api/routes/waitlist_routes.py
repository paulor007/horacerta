"""
Endpoints de lista de espera.

Fluxo:
1. Cliente vê que horários estão cheios → clica "Entrar na fila"
2. Sistema registra na waitlist (profissional + data + serviço)
3. Quando alguém cancela, o sistema notifica o primeiro da fila
4. Cliente recebe mensagem com link para agendar
"""

import logging
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from api.deps import get_current_user
from models.user import User
from models.professional import Professional
from models.service import Service
from models.waitlist import Waitlist

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/waitlist", tags=["Lista de Espera"])


class WaitlistJoinRequest(BaseModel):
    professional_id: int
    service_id: int
    date: date_type


class WaitlistResponse(BaseModel):
    id: int
    professional_id: int
    service_id: int
    date: date_type
    notified: bool
    professional_name: str | None = None
    service_name: str | None = None

    model_config = {"from_attributes": True}


# ── Público: entrar na fila sem login ──

class WaitlistPublicJoinRequest(BaseModel):
    client_name: str
    client_email: str
    client_phone: str
    professional_id: int
    service_id: int
    date: date_type


@router.post("/public/join", status_code=201)
def public_join_waitlist(
    data: WaitlistPublicJoinRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Entrar na fila de espera (público, sem login)."""
    try:
        from services.rate_limit import check_rate_limit
        check_rate_limit(request)
    except ImportError:
        pass

    # Buscar ou criar cliente
    from core.security import hash_password
    import secrets

    user = db.query(User).filter(User.email == data.client_email).first()
    if not user:
        user = User(
            name=data.client_name,
            email=data.client_email,
            phone=data.client_phone,
            hashed_password=hash_password(secrets.token_urlsafe(16)),
            role="client",
        )
        db.add(user)
        db.flush()

    # Verificar se já está na fila
    existing = db.query(Waitlist).filter(
        Waitlist.client_id == user.id,
        Waitlist.professional_id == data.professional_id,
        Waitlist.date == data.date,
        Waitlist.notified.is_(False),
    ).first()

    if existing:
        return {"message": "Você já está na lista de espera para esta data.", "position": _get_position(db, existing)}

    entry = Waitlist(
        client_id=user.id,
        professional_id=data.professional_id,
        service_id=data.service_id,
        date=data.date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    position = _get_position(db, entry)
    logger.info("Waitlist: %s entrou na fila para prof=%d em %s (posição %d)", data.client_name, data.professional_id, data.date, position)

    return {
        "message": f"Você entrou na lista de espera! Posição: {position}",
        "position": position,
        "id": entry.id,
    }


# ── Autenticado: entrar na fila ──

@router.post("/join", response_model=WaitlistResponse, status_code=201)
def join_waitlist(
    data: WaitlistJoinRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Entrar na fila de espera (autenticado)."""
    existing = db.query(Waitlist).filter(
        Waitlist.client_id == user.id,
        Waitlist.professional_id == data.professional_id,
        Waitlist.date == data.date,
        Waitlist.notified.is_(False),
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Você já está na lista de espera para esta data")

    entry = Waitlist(
        client_id=user.id,
        professional_id=data.professional_id,
        service_id=data.service_id,
        date=data.date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return _enrich_entry(entry, db)


# ── Minhas entradas na fila ──

@router.get("/my", response_model=list[WaitlistResponse])
def my_waitlist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Minhas entradas na lista de espera."""
    entries = (
        db.query(Waitlist)
        .filter(Waitlist.client_id == user.id, Waitlist.notified.is_(False))
        .order_by(Waitlist.date)
        .all()
    )
    return [_enrich_entry(e, db) for e in entries]


# ── Sair da fila ──

@router.delete("/{entry_id}")
def leave_waitlist(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sair da lista de espera."""
    entry = db.query(Waitlist).filter(Waitlist.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada não encontrada")

    if entry.client_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")

    db.delete(entry)
    db.commit()
    return {"message": "Removido da lista de espera"}


# ── Helpers ──

def _get_position(db: Session, entry: Waitlist) -> int:
    """Posição na fila (1 = primeiro)."""
    return (
        db.query(Waitlist)
        .filter(
            Waitlist.professional_id == entry.professional_id,
            Waitlist.date == entry.date,
            Waitlist.notified.is_(False),
            Waitlist.created_at <= entry.created_at,
        )
        .count()
    )


def _enrich_entry(entry: Waitlist, db: Session) -> WaitlistResponse:
    data = WaitlistResponse.model_validate(entry)
    prof = db.query(Professional).options(joinedload(Professional.user)).filter(Professional.id == entry.professional_id).first()
    svc = db.query(Service).filter(Service.id == entry.service_id).first()
    data.professional_name = prof.user.name if prof and prof.user else None
    data.service_name = svc.name if svc else None
    return data


def notify_waitlist_on_cancel(db: Session, professional_id: int, cancel_date: date_type):
    """
    Chamado quando um agendamento é cancelado.
    Notifica o primeiro da fila que há vaga.
    """
    from datetime import datetime, timezone
    from services.notification import send_email, send_whatsapp

    entries = (
        db.query(Waitlist)
        .filter(
            Waitlist.professional_id == professional_id,
            Waitlist.date == cancel_date,
            Waitlist.notified.is_(False),
        )
        .order_by(Waitlist.created_at)
        .limit(3)  # Notifica os 3 primeiros
        .all()
    )

    if not entries:
        return

    prof = db.query(Professional).options(joinedload(Professional.user)).filter(Professional.id == professional_id).first()
    prof_name = prof.user.name if prof and prof.user else "Profissional"

    for entry in entries:
        client = db.query(User).filter(User.id == entry.client_id).first()
        if not client:
            continue

        date_str = entry.date.strftime("%d/%m/%Y")
        booking_url = "http://localhost:5173/agendar"

        # Email
        email_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #22c55e;">🎉 Vaga disponível — HoraCerta</h2>
            <p>Olá <strong>{client.name}</strong>,</p>
            <p>Uma vaga abriu na agenda de <strong>{prof_name}</strong> para o dia <strong>{date_str}</strong>!</p>
            <p>Corra para garantir seu horário:</p>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{booking_url}" style="background: #22c55e; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: bold; display: inline-block;">
                    Agendar Agora
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">HoraCerta — Agendamento Inteligente</p>
        </div>
        """

        whatsapp_msg = (
            f"🎉 *Vaga disponível — HoraCerta*\n\n"
            f"Olá {client.name}!\n\n"
            f"Uma vaga abriu com *{prof_name}* no dia *{date_str}*!\n\n"
            f"Agende agora: {booking_url}\n\n"
            f"_HoraCerta — Agendamento Inteligente_"
        )

        send_email(client.email, "Vaga disponível! — HoraCerta", email_body)
        if client.phone:
            send_whatsapp(client.phone, whatsapp_msg)

        entry.notified = True
        entry.notified_at = datetime.now(timezone.utc)

        logger.info("Waitlist: notificou %s sobre vaga em %s com %s", client.name, date_str, prof_name)

    db.commit()