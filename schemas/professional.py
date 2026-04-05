"""Schemas de profissionais."""

from pydantic import BaseModel
from datetime import time

class ProfessionalCreate(BaseModel):
    """Schema para criação de profissional."""
    user_id: int
    specialty: str | None = None
    bio: str | None = None
    work_start: time = time(9, 0)
    work_end: time = time(18, 0)
    work_days: str = "1,2,3,4,5,6"


class ProfessionalUpdate(BaseModel):
    """Schema para atualização de profissional."""
    specialty: str | None = None
    bio: str | None = None
    work_start: time | None = None
    work_end: time | None = None
    work_days: str | None = None
    is_active: bool | None = None


class ProfessionalResponse(BaseModel):
    """Schema para resposta de profissional."""
    id: int
    user_id: int
    specialty: str | None
    bio: str | None
    is_active: bool
    work_start: time
    work_end: time
    work_days: str
    user_name: str | None = None

    model_config = {"from_attributes": True}

