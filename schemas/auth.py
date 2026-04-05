"""Schemas de autenticação."""

from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    """Esquema de requisição para registro de usuário."""
    name: str
    email: EmailStr
    phone: str | None = None
    password: str
    role: str  = "client"

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