"""CRUD de profissionais."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db, get_current_user, require_role
from models.user import User
from models.professional import Professional
from schemas.professional import ProfessionalCreate, ProfessionalResponse, ProfessionalUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/professionals", tags=["Profissionais"])


@router.get("", response_model=list[ProfessionalResponse])
def list_professionals(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lista profissionais. Qualquer autenticado."""
    query = db.query(Professional).options(joinedload(Professional.user))
    if active_only:
        query = query.filter(Professional.is_active.is_(True))
    profs = query.all()

    result = []
    for p in profs:
        data = ProfessionalResponse.model_validate(p)
        data.user_name = p.user.name if p.user else None
        result.append(data)
    return result


@router.get("/{prof_id}", response_model=ProfessionalResponse)
def get_professional(
    prof_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detalhes de um profissional."""
    prof = (
        db.query(Professional)
        .options(joinedload(Professional.user))
        .filter(Professional.id == prof_id)
        .first()
    )
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado")

    data = ProfessionalResponse.model_validate(prof)
    data.user_name = prof.user.name if prof.user else None
    return data


@router.post("", response_model=ProfessionalResponse, status_code=201)
def create_professional(
    data: ProfessionalCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Cadastrar profissional. Apenas admin."""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    existing = db.query(Professional).filter(Professional.user_id == data.user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já é profissional")

    prof = Professional(**data.model_dump())
    db.add(prof)
    db.commit()
    db.refresh(prof)

    result = ProfessionalResponse.model_validate(prof)
    result.user_name = user.name
    return result


@router.put("/{prof_id}", response_model=ProfessionalResponse)
def update_professional(
    prof_id: int,
    data: ProfessionalUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Editar profissional. Apenas admin."""
    prof = (
        db.query(Professional)
        .options(joinedload(Professional.user))
        .filter(Professional.id == prof_id)
        .first()
    )
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prof, field, value)

    db.commit()
    db.refresh(prof)

    result = ProfessionalResponse.model_validate(prof)
    result.user_name = prof.user.name if prof.user else None
    return result
