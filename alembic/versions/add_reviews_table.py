"""add reviews table

Revision ID: a1b2c3d4e5f6
Revises: 92bb1c0a4659
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "92bb1c0a4659"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id"), unique=True, nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("professional_id", sa.Integer(), sa.ForeignKey("professionals.id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("token", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("rating >= 0 AND rating <= 5", name="ck_reviews_rating"),
    )


def downgrade() -> None:
    op.drop_table("reviews")