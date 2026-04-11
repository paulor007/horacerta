"""CRUD de serviços."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user, require_role
from models.user import User
from models.service import Service
from schemas.service import ServiceCreate, ServiceUpdate, ServiceResponse

router = APIRouter(prefix="/api/v1/services", tags=["Serviços"])


@router.get("", response_model=list[ServiceResponse])
def list_services(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lista serviços. Qualquer autenticado."""
    query = db.query(Service)
    if active_only:
        query = query.filter(Service.is_active.is_(True))
    return query.all()


@router.get("/{service_id}", response_model=ServiceResponse)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detalhes de um serviço."""
    svc = db.query(Service).filter(Service.id == service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    return svc


@router.post("", response_model=ServiceResponse, status_code=201)
def create_service(
    data: ServiceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Cadastrar serviço. Apenas admin."""
    svc = Service(**data.model_dump())
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


@router.put("/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: int,
    data: ServiceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Editar serviço. Apenas admin."""
    svc = db.query(Service).filter(Service.id == service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(svc, field, value)

    db.commit()
    db.refresh(svc)
    return svc