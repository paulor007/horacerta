"""Schemas de autenticação."""

from pydantic import BaseModel, EmailStr, field_validator

VALID_ROLES = {"admin", "professional", "client"}


class RegisterRequest(BaseModel):
    """Esquema de requisição para registro de usuário."""
    name: str
    email: EmailStr
    phone: str | None = None
    password: str
    role: str = "client"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Nome não pode ser vazio")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A senha deve ter pelo menos 6 caracteres")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"Role inválido. Use: {', '.join(sorted(VALID_ROLES))}")
        return v


class LoginResponse(BaseModel):
    """Esquema de resposta para login de usuário."""
    access_token: str
    token_type: str = "bearer"
    name: str
    role: str
    avatar_url: str | None = None


class UserResponse(BaseModel):
    """Esquema de resposta para informações do usuário."""
    id: int
    name: str
    email: str
    phone: str | None
    role: str
    is_active: bool
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class AvatarUpdate(BaseModel):
    """Atualização de avatar — recebe URL pública do Cloudinary."""
    avatar_url: str

    @field_validator("avatar_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("URL não pode ser vazia")
        v = v.strip()
        if not v.startswith(("https://res.cloudinary.com/", "https://cloudinary.com/")):
            raise ValueError("URL deve ser do Cloudinary (https://res.cloudinary.com/...)")
        if len(v) > 500:
            raise ValueError("URL muito longa (max 500 caracteres)")
        return v


class ProfileUpdate(BaseModel):
    """Atualização de perfil próprio — campos editáveis pelo usuário."""
    name: str | None = None
    phone: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty_if_provided(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not v.strip():
            raise ValueError("Nome não pode ser vazio")
        return v.strip()