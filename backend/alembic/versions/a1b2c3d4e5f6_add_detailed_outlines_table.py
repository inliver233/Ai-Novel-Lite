"""add_detailed_outlines_table

Revision ID: a1b2c3d4e5f6
Revises: 0d389b1d0cf0
Create Date: 2026-04-02 11:30:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '0d389b1d0cf0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('detailed_outlines',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('outline_id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('volume_number', sa.Integer(), nullable=False),
        sa.Column('volume_title', sa.String(length=255), nullable=False),
        sa.Column('content_md', sa.Text(), nullable=True),
        sa.Column('structure_json', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='planned'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['outline_id'], ['outlines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('outline_id', 'volume_number', name='uq_detailed_outlines_outline_volume'),
    )
    op.create_index('ix_detailed_outlines_outline_id', 'detailed_outlines', ['outline_id'])
    op.create_index('ix_detailed_outlines_project_id', 'detailed_outlines', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_detailed_outlines_project_id', table_name='detailed_outlines')
    op.drop_index('ix_detailed_outlines_outline_id', table_name='detailed_outlines')
    op.drop_table('detailed_outlines')
