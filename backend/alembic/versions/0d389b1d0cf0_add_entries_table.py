"""add_entries_table

Revision ID: 0d389b1d0cf0
Revises: c4a2b7e91d13
Create Date: 2026-03-31 11:29:36.278056

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0d389b1d0cf0'
down_revision = 'c4a2b7e91d13'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('entries',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('tags_json', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('entries', schema=None) as batch_op:
        batch_op.create_index('ix_entries_project_id', ['project_id'], unique=False)
        batch_op.create_index('ix_entries_project_id_updated_at', ['project_id', 'updated_at'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('entries', schema=None) as batch_op:
        batch_op.drop_index('ix_entries_project_id_updated_at')
        batch_op.drop_index('ix_entries_project_id')

    op.drop_table('entries')
