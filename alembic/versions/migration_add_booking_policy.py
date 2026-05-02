"""add booking policy fields to system_settings

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-29 12:00:00.000000

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
    """Adiciona 3 campos de política de agendamento."""
    # Verifica se as colunas já existem antes de adicionar (idempotente)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("system_settings")}

    if "max_active_appointments" not in existing_cols:
        op.add_column(
            "system_settings",
            sa.Column(
                "max_active_appointments",
                sa.Integer(),
                nullable=True,
                server_default="1",
            ),
        )

    if "min_days_between_bookings" not in existing_cols:
        op.add_column(
            "system_settings",
            sa.Column(
                "min_days_between_bookings",
                sa.Integer(),
                nullable=True,
                server_default="15",
            ),
        )

    if "client_cancel_hours" not in existing_cols:
        op.add_column(
            "system_settings",
            sa.Column(
                "client_cancel_hours",
                sa.Integer(),
                nullable=True,
                server_default="24",
            ),
        )

    # Garante valores nas linhas existentes
    op.execute(
        "UPDATE system_settings SET "
        "max_active_appointments = COALESCE(max_active_appointments, 1), "
        "min_days_between_bookings = COALESCE(min_days_between_bookings, 15), "
        "client_cancel_hours = COALESCE(client_cancel_hours, 24)"
    )


def downgrade() -> None:
    op.drop_column("system_settings", "client_cancel_hours")
    op.drop_column("system_settings", "min_days_between_bookings")
    op.drop_column("system_settings", "max_active_appointments")