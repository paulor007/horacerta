"""add booking policy fields to system_settings

Revision ID: add_booking_policy
Revises: add_system_settings
Create Date: 2026-04-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_booking_policy"
down_revision = "add_system_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Adiciona campos de política de agendamento."""
    # max_active_appointments: quantos agendamentos ativos um cliente pode ter
    op.add_column(
        "system_settings",
        sa.Column("max_active_appointments", sa.Integer(), nullable=True, server_default="1"),
    )

    # min_days_between_bookings: dias mínimos entre agendamentos do mesmo cliente
    op.add_column(
        "system_settings",
        sa.Column("min_days_between_bookings", sa.Integer(), nullable=True, server_default="15"),
    )

    # client_cancel_hours: até quantas horas antes cliente pode cancelar (default 24h)
    op.add_column(
        "system_settings",
        sa.Column("client_cancel_hours", sa.Integer(), nullable=True, server_default="24"),
    )

    # Atualiza linhas existentes pra usar os defaults (compatibilidade)
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