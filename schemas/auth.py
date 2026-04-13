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


class UserResponse(BaseModel):
    """Esquema de resposta para informações do usuário."""
    id: int
    name: str
    email: str
    phone: str | None
    role: str
    is_active: bool

    model_config = {
        "from_attributes": True
    }