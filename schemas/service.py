"""Schemas de serviços."""

from pydantic import BaseModel
from decimal import Decimal


class ServiceCreate(BaseModel):
    """Schema para criação de serviço."""
    name: str
    duration_min: int
    price: Decimal
    description: str | None = None


class ServiceUpdate(BaseModel):
    """Schema para atualização de serviço."""
    name: str | None = None
    duration_min: int | None = None
    price: Decimal | None = None
    description: str | None = None
    is_active: bool | None = None


class ServiceResponse(BaseModel):
    """Schema para resposta de serviço."""
    id: int
    name: str
    duration_min: int
    price: Decimal
    description: str | None
    is_active: bool

    model_config = {"from_attributes": True}