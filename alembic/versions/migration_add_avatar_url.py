"""add avatar_url to users

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-04 12:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Adiciona campo avatar_url na tabela users."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("users")}

    if "avatar_url" not in existing_cols:
        op.add_column(
            "users",
            sa.Column("avatar_url", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")