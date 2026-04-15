"""Endpoints de autenticação: register, login, change password, update profile."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import create_access_token, verify_password, hash_password
from api.deps import get_current_user
from models.user import User
from schemas.auth import RegisterRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["Autenticação"])


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Criar nova conta."""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já registrado")

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


@router.post("/token", response_model=LoginResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Login — retorna JWT."""
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Conta desativada")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return LoginResponse(
        access_token=token,
        name=user.name,
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Retorna dados do usuário logado."""
    return current_user


@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Alterar senha do usuário logado."""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Nova senha deve ter pelo menos 6 caracteres")

    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Senha alterada com sucesso"}


@router.put("/profile", response_model=UserResponse)
def update_profile(
    data: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Atualizar dados do perfil."""
    if data.name and data.name.strip():
        user.name = data.name.strip()
    if data.phone is not None:
        user.phone = data.phone.strip() if data.phone else None
    if data.email:
        existing = db.query(User).filter(User.email == data.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email já está em uso")
        user.email = data.email

    db.commit()
    db.refresh(user)
    return user