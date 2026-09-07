from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "202609070001"
down_revision = "202608110001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "onboarding_completed_version",
            sa.SmallInteger(),
            server_default="0",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        op.f("ck_user_settings_onboarding_completed_version_nonnegative"),
        "user_settings",
        "onboarding_completed_version >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_user_settings_onboarding_completed_version_nonnegative"),
        "user_settings",
        type_="check",
    )
    op.drop_column("user_settings", "onboarding_completed_version")
