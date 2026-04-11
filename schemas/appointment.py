"""Schemas de agendamento."""

from pydantic import BaseModel
from datetime import date, time
from decimal import Decimal


class AppointmentCreate(BaseModel):
    professional_id: int
    service_id: int
    date: date
    start_time: time


class AppointmentReschedule(BaseModel):
    date: date
    start_time: time


class AppointmentResponse(BaseModel):
    id: int
    client_id: int
    professional_id: int
    service_id: int
    date: date
    start_time: time
    end_time: time
    status: str
    notes: str | None

    # Campos extras (preenchidos manualmente)
    client_name: str | None = None
    professional_name: str | None = None
    service_name: str | None = None
    service_price: Decimal | None = None
    service_duration: int | None = None 

    model_config = {"from_attributes": True}

class TimeSlot(BaseModel):
    time: time
    available: bool

class AvailabilityResponse(BaseModel):
    professional_id: int
    professional_name: str
    date: date
    slots: list[TimeSlot]
