"""Schemas de avaliação."""

from pydantic import BaseModel, field_validator
from datetime import datetime


class ReviewSubmit(BaseModel):
    """Schema para enviar avaliação (público, via token)."""
    rating: int
    comment: str | None = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Avaliação deve ser entre 1 e 5")
        return v


class ReviewResponse(BaseModel):
    """Schema de resposta de avaliação."""
    id: int
    appointment_id: int
    client_id: int
    professional_id: int
    rating: int
    comment: str | None
    created_at: datetime

    # Extras
    client_name: str | None = None
    service_name: str | None = None

    model_config = {"from_attributes": True}