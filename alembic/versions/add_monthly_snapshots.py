"""add monthly_snapshots table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "monthly_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("year", sa.Integer(), nullable=False, index=True),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("professional_id", sa.Integer(), sa.ForeignKey("professionals.id"), nullable=True),
        sa.Column("total_completed", sa.Integer(), default=0),
        sa.Column("total_cancelled", sa.Integer(), default=0),
        sa.Column("total_no_show", sa.Integer(), default=0),
        sa.Column("total_revenue", sa.Numeric(10, 2), default=0),
        sa.Column("unique_clients", sa.Integer(), default=0),
        sa.Column("generated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("year", "month", "professional_id", name="uq_snapshot_ymp"),
    )


def downgrade() -> None:
    op.drop_table("monthly_snapshots")