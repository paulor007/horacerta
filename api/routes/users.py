"""Gestão de usuários — apenas admin."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user, require_role
from core.security import hash_password
from models.user import User
from schemas.auth import (
    RegisterRequest,
    UserResponse,
    AvatarUpdate,
    ProfileUpdate,
)

router = APIRouter(prefix="/api/v1/users", tags=["Usuários (Admin)"])


@router.get("", response_model=list[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Lista todos os usuários. Apenas admin."""
    return db.query(User).offset(skip).limit(limit).all()


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: RegisterRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Admin cria usuário com role definido."""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    valid_roles = {"admin", "professional", "client"}
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role inválido. Use: {', '.join(valid_roles)}")

    user = User(
        name=data.name,
        email=data.email,
        phone=data.phone,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/toggle-active")
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Admin ativa/desativa conta."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user.is_active = not user.is_active
    db.commit()
    status = "ativado" if user.is_active else "desativado"
    return {"message": f"Usuário {user.name} {status}"}

@router.get("/me", response_model=UserResponse)
def get_my_profile(
    user: User = Depends(get_current_user),
):
    """Retorna dados do usuário logado (incluindo avatar_url)."""
    return user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Usuário atualiza próprio nome/phone."""
    if data.name is not None:
        user.name = data.name
    if data.phone is not None:
        user.phone = data.phone
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/avatar", response_model=UserResponse)
def update_my_avatar(
    data: AvatarUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Atualiza avatar do próprio usuário (URL do Cloudinary)."""
    user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(user)
    return user


@router.delete("/me/avatar", response_model=UserResponse)
def remove_my_avatar(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove avatar do próprio usuário (volta a mostrar iniciais)."""
    user.avatar_url = None
    db.commit()
    db.refresh(user)
    return user