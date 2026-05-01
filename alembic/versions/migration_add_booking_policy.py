"""add booking policy fields to system_settings

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-29 01:30:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Adiciona campos de política de agendamento."""
    # max_active_appointments: quantos agendamentos ativos um cliente pode ter
    op.add_column(
        "system_settings",
        sa.Column(
            "max_active_appointments",
            sa.Integer(),
            nullable=True,
            server_default="1",
        ),
    )

    # min_days_between_bookings: dias mínimos entre agendamentos do mesmo cliente
    op.add_column(
        "system_settings",
        sa.Column(
            "min_days_between_bookings",
            sa.Integer(),
            nullable=True,
            server_default="15",
        ),
    )

    # client_cancel_hours: até quantas horas antes cliente pode cancelar
    op.add_column(
        "system_settings",
        sa.Column(
            "client_cancel_hours",
            sa.Integer(),
            nullable=True,
            server_default="24",
        ),
    )

    # Atualiza linhas existentes pra garantir que tenham valor (não NULL)
    op.execute(
        "UPDATE system_settings SET "
        "max_active_appointments = 1, "
        "min_days_between_bookings = 15, "
        "client_cancel_hours = 24 "
        "WHERE max_active_appointments IS NULL"
    )


def downgrade() -> None:
    op.drop_column("system_settings", "client_cancel_hours")
    op.drop_column("system_settings", "min_days_between_bookings")
    op.drop_column("system_settings", "max_active_appointments")