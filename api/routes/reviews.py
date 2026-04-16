"""
Endpoints de avaliação — público (via token) e autenticado (listagem).

Fluxo:
1. Profissional marca agendamento como concluído
2. Sistema gera token único e envia link por email/WhatsApp
3. Cliente acessa /avaliar?token=xxx e dá nota + comentário
4. Admin/profissional vê avaliações no painel
"""

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from core.database import get_db
from api.deps import get_current_user
from models.user import User
from models.professional import Professional
from models.appointment import Appointment
from models.review import Review
from schemas.review_schema import ReviewSubmit, ReviewResponse
from services.rate_limit import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Avaliações"])


def generate_review_token() -> str:
    """Gera token único para avaliação."""
    return secrets.token_urlsafe(32)


# ── Público: submeter avaliação via token ──

@router.get("/api/v1/public/review")
def get_review_info(
    token: str = Query(...),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Busca dados do agendamento pelo token (para mostrar na tela de avaliação)."""
    if request:
        check_rate_limit(request)

    review = db.query(Review).filter(Review.token == token).first()
    if not review:
        raise HTTPException(status_code=404, detail="Token inválido ou expirado")

    if review.rating > 0:
        return {
            "already_reviewed": True,
            "rating": review.rating,
            "message": "Você já avaliou este atendimento. Obrigado!",
        }

    apt = db.query(Appointment).filter(Appointment.id == review.appointment_id).first()
    client = db.query(User).filter(User.id == review.client_id).first()
    prof = (
        db.query(Professional)
        .options(joinedload(Professional.user))
        .filter(Professional.id == review.professional_id)
        .first()
    )

    return {
        "already_reviewed": False,
        "client_name": client.name if client else None,
        "professional_name": prof.user.name if prof and prof.user else None,
        "service_name": apt.service.name if apt and apt.service else None,
        "date": str(apt.date) if apt else None,
    }


@router.post("/api/v1/public/review")
def submit_review(
    token: str = Query(...),
    data: ReviewSubmit = ...,
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Submete avaliação (público, sem auth)."""
    if request:
        check_rate_limit(request)

    review = db.query(Review).filter(Review.token == token).first()
    if not review:
        raise HTTPException(status_code=404, detail="Token inválido")

    if review.rating > 0:
        raise HTTPException(status_code=400, detail="Avaliação já enviada")

    review.rating = data.rating
    review.comment = data.comment
    db.commit()

    logger.info("Avaliação recebida: appointment=%d, rating=%d", review.appointment_id, data.rating)

    return {"message": "Avaliação enviada com sucesso!", "rating": data.rating}


# ── Autenticado: listar avaliações ──

@router.get("/api/v1/reviews", response_model=list[ReviewResponse])
def list_reviews(
    professional_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lista avaliações. Admin vê todas, profissional vê as suas."""
    query = db.query(Review).filter(Review.rating > 0)

    if user.role == "professional":
        prof = db.query(Professional).filter(Professional.user_id == user.id).first()
        if prof:
            query = query.filter(Review.professional_id == prof.id)
        else:
            return []
    elif professional_id:
        query = query.filter(Review.professional_id == professional_id)

    query = query.order_by(Review.created_at.desc()).limit(50)
    reviews = query.all()

    result = []
    for r in reviews:
        data = ReviewResponse.model_validate(r)
        client = db.query(User).filter(User.id == r.client_id).first()
        apt = db.query(Appointment).filter(Appointment.id == r.appointment_id).first()
        data.client_name = client.name if client else None
        data.service_name = apt.service.name if apt and apt.service else None
        result.append(data)

    return result


@router.get("/api/v1/reviews/summary")
def reviews_summary(
    professional_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Resumo de avaliações (média, total)."""
    query = db.query(Review).filter(Review.rating > 0)

    if user.role == "professional":
        prof = db.query(Professional).filter(Professional.user_id == user.id).first()
        if prof:
            query = query.filter(Review.professional_id == prof.id)
    elif professional_id:
        query = query.filter(Review.professional_id == professional_id)

    total = query.count()
    avg = db.query(func.avg(Review.rating)).filter(Review.rating > 0).scalar()

    # Distribuição
    dist = {}
    for i in range(1, 6):
        dist[str(i)] = query.filter(Review.rating == i).count()

    return {
        "total_reviews": total,
        "average_rating": round(float(avg or 0), 1),
        "distribution": dist,
    }