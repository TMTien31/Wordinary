from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "202608110001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('active', 'pending', 'disabled')",
            name=op.f("ck_users_status_values"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index("uq_users_email_ci", "users", [sa.text("lower(email)")], unique=True)

    op.create_table(
        "user_settings",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("language", sa.String(length=12), server_default="vi", nullable=False),
        sa.Column("theme", sa.String(length=16), server_default="system", nullable=False),
        sa.Column("font_size", sa.SmallInteger(), server_default="21", nullable=False),
        sa.Column("reader_rail_collapsed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("main_sidebar_collapsed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("font_size BETWEEN 12 AND 32", name=op.f("ck_user_settings_font_size_range")),
        sa.CheckConstraint("theme IN ('light', 'dark', 'system')", name=op.f("ck_user_settings_theme_values")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_settings_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", name="pk_user_settings"),
    )

    op.create_table(
        "learning_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("native_language", sa.String(length=12), server_default="vi", nullable=False),
        sa.Column("target_language", sa.String(length=12), server_default="en", nullable=False),
        sa.Column("xp", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("current_streak", sa.Integer(), server_default="0", nullable=False),
        sa.Column("longest_streak", sa.Integer(), server_default="0", nullable=False),
        sa.Column("daily_goal", sa.Integer(), server_default="8", nullable=False),
        sa.Column("timezone", sa.String(length=60), server_default="Asia/Ho_Chi_Minh", nullable=False),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("current_streak >= 0", name=op.f("ck_learning_profiles_current_streak_nonnegative")),
        sa.CheckConstraint("daily_goal BETWEEN 1 AND 200", name=op.f("ck_learning_profiles_daily_goal_range")),
        sa.CheckConstraint("longest_streak >= 0", name=op.f("ck_learning_profiles_longest_streak_nonnegative")),
        sa.CheckConstraint("xp >= 0", name=op.f("ck_learning_profiles_xp_nonnegative")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_learning_profiles_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", name="pk_learning_profiles"),
    )

    op.create_table(
        "daily_activities",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("activity_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("xp_earned", sa.Integer(), server_default="0", nullable=False),
        sa.Column("review_answers_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("saved_vocabulary_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completed_items_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reading_seconds", sa.Integer(), server_default="0", nullable=False),
        sa.Column("video_seconds", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("activity_count >= 0", name=op.f("ck_daily_activities_activity_count_nonnegative")),
        sa.CheckConstraint("completed_items_count >= 0", name=op.f("ck_daily_activities_completed_items_count_nonnegative")),
        sa.CheckConstraint("reading_seconds >= 0", name=op.f("ck_daily_activities_reading_seconds_nonnegative")),
        sa.CheckConstraint("review_answers_count >= 0", name=op.f("ck_daily_activities_review_answers_count_nonnegative")),
        sa.CheckConstraint("saved_vocabulary_count >= 0", name=op.f("ck_daily_activities_saved_vocabulary_count_nonnegative")),
        sa.CheckConstraint("video_seconds >= 0", name=op.f("ck_daily_activities_video_seconds_nonnegative")),
        sa.CheckConstraint("xp_earned >= 0", name=op.f("ck_daily_activities_xp_earned_nonnegative")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_daily_activities_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_daily_activities"),
    )
    op.create_index("ix_daily_activities_user_date", "daily_activities", ["user_id", sa.text("activity_date DESC")])
    op.create_index("uq_daily_activities_user_activity_date", "daily_activities", ["user_id", "activity_date"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_sessions_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_user_sessions"),
    )
    op.create_index("ix_user_sessions_active", "user_sessions", ["user_id"], postgresql_where=sa.text("revoked_at IS NULL"))
    op.create_index("ix_user_sessions_user_expires", "user_sessions", ["user_id", "expires_at"])

    op.create_table(
        "stored_files",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("storage_backend", sa.String(length=16), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("original_file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=127), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'", name=op.f("ck_stored_files_checksum_sha256_lower_hex")),
        sa.CheckConstraint("purpose IN ('pdf_document', 'vocabulary_icon')", name=op.f("ck_stored_files_purpose_values")),
        sa.CheckConstraint("size_bytes >= 0", name=op.f("ck_stored_files_size_bytes_nonnegative")),
        sa.CheckConstraint("storage_backend IN ('local', 's3', 'r2', 'minio')", name=op.f("ck_stored_files_storage_backend_values")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_stored_files_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_stored_files"),
    )
    op.create_index("ix_stored_files_user_created", "stored_files", ["user_id", sa.text("created_at DESC")])
    op.create_index("uq_stored_files_backend_key", "stored_files", ["storage_backend", "storage_key"], unique=True)

    op.create_table(
        "library_items",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("processing_status", sa.String(length=16), server_default="ready", nullable=False),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("processing_status IN ('pending', 'processing', 'ready', 'failed')", name=op.f("ck_library_items_processing_status_values")),
        sa.CheckConstraint("type IN ('article', 'pdf', 'video')", name=op.f("ck_library_items_type_values")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_library_items_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_library_items"),
    )
    op.create_index("ix_library_items_user_type_created", "library_items", ["user_id", "type", sa.text("created_at DESC")])
    op.create_index("ix_library_items_user_updated", "library_items", ["user_id", sa.text("updated_at DESC")])

    op.create_table(
        "articles",
        sa.Column("library_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_format", sa.String(length=16), server_default="html", nullable=False),
        sa.Column("author", sa.String(length=160), nullable=True),
        sa.Column("level", sa.String(length=30), nullable=True),
        sa.Column("import_method", sa.String(length=20), nullable=False),
        sa.Column("original_file_name", sa.String(length=255), nullable=True),
        sa.Column("mime_type", sa.String(length=127), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("reading_minutes", sa.Integer(), nullable=False),
        sa.Column("content_checksum", sa.String(length=64), nullable=True),
        sa.CheckConstraint("content_checksum IS NULL OR content_checksum ~ '^[0-9a-f]{64}$'", name=op.f("ck_articles_content_checksum_lower_hex")),
        sa.CheckConstraint("content_format IN ('html', 'plain_text', 'markdown')", name=op.f("ck_articles_content_format_values")),
        sa.CheckConstraint("import_method IN ('paste', 'url', 'file')", name=op.f("ck_articles_import_method_values")),
        sa.CheckConstraint("reading_minutes >= 0", name=op.f("ck_articles_reading_minutes_nonnegative")),
        sa.CheckConstraint("word_count >= 0", name=op.f("ck_articles_word_count_nonnegative")),
        sa.ForeignKeyConstraint(["library_item_id"], ["library_items.id"], name="fk_articles_library_item_id_library_items", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("library_item_id", name="pk_articles"),
    )

    op.create_table(
        "pdf_documents",
        sa.Column("library_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("text_layer_available", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("ocr_used", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("page_count >= 1", name=op.f("ck_pdf_documents_page_count_positive")),
        sa.ForeignKeyConstraint(["file_id"], ["stored_files.id"], name="fk_pdf_documents_file_id_stored_files", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["library_item_id"], ["library_items.id"], name="fk_pdf_documents_library_item_id_library_items", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("library_item_id", name="pk_pdf_documents"),
        sa.UniqueConstraint("file_id", name="uq_pdf_documents_file_id"),
    )

    op.create_table(
        "videos",
        sa.Column("library_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("provider_video_id", sa.String(length=128), nullable=True),
        sa.Column("channel_name", sa.String(length=255), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("embeddable", sa.Boolean(), nullable=True),
        sa.Column("availability", sa.String(length=64), nullable=True),
        sa.Column("provider_metadata", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.CheckConstraint("duration_seconds IS NULL OR duration_seconds >= 0", name=op.f("ck_videos_duration_seconds_nonnegative")),
        sa.CheckConstraint("provider IN ('youtube', 'external')", name=op.f("ck_videos_provider_values")),
        sa.ForeignKeyConstraint(["library_item_id"], ["library_items.id"], name="fk_videos_library_item_id_library_items", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("library_item_id", name="pk_videos"),
    )
    op.create_index("ix_videos_provider_video", "videos", ["provider", "provider_video_id"])

    op.create_table(
        "learning_progress",
        sa.Column("library_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("progress_percent", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("position", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.CheckConstraint("progress_percent BETWEEN 0 AND 100", name=op.f("ck_learning_progress_progress_percent_range")),
        sa.CheckConstraint("version >= 1", name=op.f("ck_learning_progress_version_positive")),
        sa.ForeignKeyConstraint(["library_item_id"], ["library_items.id"], name="fk_learning_progress_library_item_id_library_items", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("library_item_id", name="pk_learning_progress"),
    )
    op.create_index("ix_learning_progress_recent", "learning_progress", [sa.text("last_opened_at DESC")], postgresql_where=sa.text("last_opened_at IS NOT NULL"))

    op.create_table(
        "vocabulary_items",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_library_item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_type", sa.String(length=16), nullable=False),
        sa.Column("word", sa.String(length=200), nullable=False),
        sa.Column("normalized_word", sa.String(length=200), nullable=False),
        sa.Column("lemma", sa.String(length=200), nullable=True),
        sa.Column("translation", sa.String(length=500), nullable=False),
        sa.Column("definition", sa.Text(), nullable=True),
        sa.Column("phonetic", sa.String(length=200), nullable=True),
        sa.Column("part_of_speech", sa.String(length=80), nullable=True),
        sa.Column("example_sentence", sa.Text(), nullable=True),
        sa.Column("sentence_translation", sa.Text(), nullable=True),
        sa.Column("icon_name", sa.String(length=255), nullable=True),
        sa.Column("icon_file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("icon_url", sa.Text(), nullable=True),
        sa.Column("source_title_snapshot", sa.String(length=300), nullable=True),
        sa.Column("source_url_snapshot", sa.Text(), nullable=True),
        sa.Column("source_context", sa.Text(), nullable=True),
        sa.Column("article_paragraph_index", sa.Integer(), nullable=True),
        sa.Column("article_character_start", sa.Integer(), nullable=True),
        sa.Column("article_character_end", sa.Integer(), nullable=True),
        sa.Column("pdf_page", sa.Integer(), nullable=True),
        sa.Column("video_timestamp_seconds", sa.Float(), nullable=True),
        sa.Column("video_caption_index", sa.Integer(), nullable=True),
        sa.Column("mastery", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("review_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_result", sa.String(length=10), nullable=True),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("article_character_end IS NULL OR article_character_start IS NULL OR article_character_end >= article_character_start", name=op.f("ck_vocabulary_items_article_character_end_after_start")),
        sa.CheckConstraint("article_character_end IS NULL OR article_character_end >= 0", name=op.f("ck_vocabulary_items_article_character_end_nonnegative")),
        sa.CheckConstraint("article_character_start IS NULL OR article_character_start >= 0", name=op.f("ck_vocabulary_items_article_character_start_nonnegative")),
        sa.CheckConstraint("article_paragraph_index IS NULL OR article_paragraph_index >= 0", name=op.f("ck_vocabulary_items_article_paragraph_index_nonnegative")),
        sa.CheckConstraint("last_result IS NULL OR last_result IN ('good', 'again')", name=op.f("ck_vocabulary_items_last_result_values")),
        sa.CheckConstraint("mastery BETWEEN 0 AND 5", name=op.f("ck_vocabulary_items_mastery_range")),
        sa.CheckConstraint("num_nonnulls(icon_name, icon_file_id, icon_url) <= 1", name=op.f("ck_vocabulary_items_single_icon_source")),
        sa.CheckConstraint("pdf_page IS NULL OR pdf_page >= 1", name=op.f("ck_vocabulary_items_pdf_page_positive")),
        sa.CheckConstraint("review_count >= 0", name=op.f("ck_vocabulary_items_review_count_nonnegative")),
        sa.CheckConstraint("source_type IN ('article', 'pdf', 'video', 'manual')", name=op.f("ck_vocabulary_items_source_type_values")),
        sa.CheckConstraint("video_caption_index IS NULL OR video_caption_index >= 0", name=op.f("ck_vocabulary_items_video_caption_index_nonnegative")),
        sa.CheckConstraint("video_timestamp_seconds IS NULL OR video_timestamp_seconds >= 0", name=op.f("ck_vocabulary_items_video_timestamp_seconds_nonnegative")),
        sa.ForeignKeyConstraint(["icon_file_id"], ["stored_files.id"], name="fk_vocabulary_items_icon_file_id_stored_files", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_library_item_id"], ["library_items.id"], name="fk_vocabulary_items_source_library_item_id_library_items", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_vocabulary_items_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_vocabulary_items"),
    )
    op.create_index("ix_vocabulary_items_source_library_item", "vocabulary_items", ["source_library_item_id"])
    op.create_index("ix_vocabulary_items_user_due", "vocabulary_items", ["user_id", "next_review_at"], postgresql_where=sa.text("next_review_at IS NOT NULL"))
    op.create_index("ix_vocabulary_items_user_source_type", "vocabulary_items", ["user_id", "source_type"])
    op.create_index("ix_vocabulary_items_user_word", "vocabulary_items", ["user_id", "normalized_word"])

    op.create_table(
        "review_sessions",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("mode IN ('all', 'due', 'retry', 'custom')", name=op.f("ck_review_sessions_mode_values")),
        sa.CheckConstraint("status IN ('active', 'completed', 'abandoned')", name=op.f("ck_review_sessions_status_values")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_review_sessions_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_review_sessions"),
    )
    op.create_index("ix_review_sessions_active", "review_sessions", ["user_id"], postgresql_where=sa.text("status = 'active'"))
    op.create_index("ix_review_sessions_user_started", "review_sessions", ["user_id", sa.text("started_at DESC")])

    op.create_table(
        "review_session_items",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vocabulary_item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("queue_index", sa.Integer(), nullable=False),
        sa.Column("card_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("mastery_at_start", sa.SmallInteger(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("mastery_at_start BETWEEN 0 AND 5", name=op.f("ck_review_session_items_mastery_at_start_range")),
        sa.CheckConstraint("queue_index >= 0", name=op.f("ck_review_session_items_queue_index_nonnegative")),
        sa.ForeignKeyConstraint(["session_id"], ["review_sessions.id"], name="fk_review_session_items_session_id_review_sessions", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vocabulary_item_id"], ["vocabulary_items.id"], name="fk_review_session_items_vocabulary_item_id_vocabulary_items", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_review_session_items"),
    )
    op.create_index("uq_review_session_items_session_queue", "review_session_items", ["session_id", "queue_index"], unique=True)
    op.create_index("uq_review_session_items_session_vocabulary", "review_session_items", ["session_id", "vocabulary_item_id"], unique=True, postgresql_where=sa.text("vocabulary_item_id IS NOT NULL"))

    op.create_table(
        "review_answers",
        sa.Column("session_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_answer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("result", sa.String(length=10), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("mastery_before", sa.SmallInteger(), nullable=False),
        sa.Column("mastery_after", sa.SmallInteger(), nullable=False),
        sa.Column("xp_earned", sa.Integer(), server_default="0", nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("mastery_after BETWEEN 0 AND 5", name=op.f("ck_review_answers_mastery_after_range")),
        sa.CheckConstraint("mastery_before BETWEEN 0 AND 5", name=op.f("ck_review_answers_mastery_before_range")),
        sa.CheckConstraint("response_time_ms IS NULL OR response_time_ms BETWEEN 0 AND 3600000", name=op.f("ck_review_answers_response_time_ms_range")),
        sa.CheckConstraint("result IN ('good', 'again')", name=op.f("ck_review_answers_result_values")),
        sa.CheckConstraint("round_number >= 1", name=op.f("ck_review_answers_round_number_positive")),
        sa.CheckConstraint("xp_earned >= 0", name=op.f("ck_review_answers_xp_earned_nonnegative")),
        sa.ForeignKeyConstraint(["session_item_id"], ["review_session_items.id"], name="fk_review_answers_session_item_id_review_session_items", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_review_answers"),
    )
    op.create_index("ix_review_answers_session_item_answered", "review_answers", ["session_item_id", "answered_at"])
    op.create_index("uq_review_answers_client_answer_id", "review_answers", ["client_answer_id"], unique=True)
    op.create_index("uq_review_answers_session_item_round", "review_answers", ["session_item_id", "round_number"], unique=True)

    op.create_table(
        "caption_tracks",
        sa.Column("video_library_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("language", sa.String(length=12), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("processing_status", sa.String(length=16), server_default="ready", nullable=False),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("cue_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("provider_metadata", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("cue_count >= 0", name=op.f("ck_caption_tracks_cue_count_nonnegative")),
        sa.CheckConstraint("processing_status IN ('pending', 'processing', 'ready', 'failed')", name=op.f("ck_caption_tracks_processing_status_values")),
        sa.CheckConstraint("source IN ('manual', 'automatic', 'upload', 'pasted')", name=op.f("ck_caption_tracks_source_values")),
        sa.ForeignKeyConstraint(["video_library_item_id"], ["videos.library_item_id"], name="fk_caption_tracks_video_library_item_id_videos", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_caption_tracks"),
    )
    op.create_index("ix_caption_tracks_processing", "caption_tracks", ["updated_at"], postgresql_where=sa.text("processing_status IN ('pending', 'processing')"))
    op.create_index("ix_caption_tracks_video_default", "caption_tracks", ["video_library_item_id", "is_default"])
    op.create_index("uq_caption_tracks_default_per_video", "caption_tracks", ["video_library_item_id"], unique=True, postgresql_where=sa.text("is_default = true"))
    op.create_index("uq_caption_tracks_video_language_source", "caption_tracks", ["video_library_item_id", "language", "source"], unique=True)

    op.create_table(
        "caption_cues",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cue_index", sa.Integer(), nullable=False),
        sa.Column("start_seconds", sa.Float(), nullable=False),
        sa.Column("end_seconds", sa.Float(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("translation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("cue_index >= 0", name=op.f("ck_caption_cues_cue_index_nonnegative")),
        sa.CheckConstraint("end_seconds > start_seconds", name=op.f("ck_caption_cues_end_seconds_after_start")),
        sa.CheckConstraint("start_seconds >= 0", name=op.f("ck_caption_cues_start_seconds_nonnegative")),
        sa.ForeignKeyConstraint(["track_id"], ["caption_tracks.id"], name="fk_caption_cues_track_id_caption_tracks", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_caption_cues"),
    )
    op.create_index("ix_caption_cues_track_time", "caption_cues", ["track_id", "start_seconds"])
    op.create_index("uq_caption_cues_track_cue_index", "caption_cues", ["track_id", "cue_index"], unique=True)

    op.create_table(
        "data_imports",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_import_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_version", sa.Integer(), nullable=False),
        sa.Column("dry_run", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("imported_library_items", sa.Integer(), server_default="0", nullable=False),
        sa.Column("imported_vocabulary_items", sa.Integer(), server_default="0", nullable=False),
        sa.Column("skipped_items", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_items", sa.Integer(), server_default="0", nullable=False),
        sa.Column("warnings", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("data_version >= 0", name=op.f("ck_data_imports_data_version_nonnegative")),
        sa.CheckConstraint("failed_items >= 0", name=op.f("ck_data_imports_failed_items_nonnegative")),
        sa.CheckConstraint("imported_library_items >= 0", name=op.f("ck_data_imports_imported_library_items_nonnegative")),
        sa.CheckConstraint("imported_vocabulary_items >= 0", name=op.f("ck_data_imports_imported_vocabulary_items_nonnegative")),
        sa.CheckConstraint("skipped_items >= 0", name=op.f("ck_data_imports_skipped_items_nonnegative")),
        sa.CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed')", name=op.f("ck_data_imports_status_values")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_data_imports_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_data_imports"),
        sa.UniqueConstraint("id", "user_id", name="uq_data_imports_id_user_id"),
    )
    op.create_index("ix_data_imports_user_created", "data_imports", ["user_id", sa.text("created_at DESC")])
    op.create_index("uq_data_imports_user_client_import", "data_imports", ["user_id", "client_import_id"], unique=True)

    op.create_table(
        "data_import_items",
        sa.Column("import_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("local_id", sa.Text(), nullable=False),
        sa.Column("canonical_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("warning", sa.Text(), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint(
            "entity_type IN ('library_item', 'vocabulary_item', 'caption_track', 'user_settings', 'learning_profile')",
            name=op.f("ck_data_import_items_entity_type_values"),
        ),
        sa.CheckConstraint("payload_hash IS NULL OR payload_hash ~ '^[0-9a-f]{64}$'", name=op.f("ck_data_import_items_payload_hash_lower_hex")),
        sa.CheckConstraint("status IN ('imported', 'skipped', 'failed')", name=op.f("ck_data_import_items_status_values")),
        sa.ForeignKeyConstraint(["import_id", "user_id"], ["data_imports.id", "data_imports.user_id"], name="fk_data_import_items_import_user_data_imports", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_data_import_items_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_data_import_items"),
    )
    op.create_index("ix_data_import_items_import_status", "data_import_items", ["import_id", "status"])
    op.create_index("ix_data_import_items_user_canonical", "data_import_items", ["user_id", "canonical_id"])
    op.create_index("uq_data_import_items_user_entity_local", "data_import_items", ["user_id", "entity_type", "local_id"], unique=True)


def downgrade() -> None:
    for table_name, index_names in _INDEXES_BY_TABLE:
        for index_name in index_names:
            op.drop_index(index_name, table_name=table_name)

    for table_name in reversed(_TABLES):
        op.drop_table(table_name)


_TABLES: Sequence[str] = (
    "users",
    "user_settings",
    "learning_profiles",
    "daily_activities",
    "user_sessions",
    "stored_files",
    "library_items",
    "articles",
    "pdf_documents",
    "videos",
    "learning_progress",
    "vocabulary_items",
    "review_sessions",
    "review_session_items",
    "review_answers",
    "caption_tracks",
    "caption_cues",
    "data_imports",
    "data_import_items",
)

_INDEXES_BY_TABLE: Sequence[tuple[str, Sequence[str]]] = (
    ("data_import_items", ("ix_data_import_items_import_status", "ix_data_import_items_user_canonical", "uq_data_import_items_user_entity_local")),
    ("data_imports", ("ix_data_imports_user_created", "uq_data_imports_user_client_import")),
    ("caption_cues", ("ix_caption_cues_track_time", "uq_caption_cues_track_cue_index")),
    ("caption_tracks", ("ix_caption_tracks_processing", "ix_caption_tracks_video_default", "uq_caption_tracks_default_per_video", "uq_caption_tracks_video_language_source")),
    ("review_answers", ("ix_review_answers_session_item_answered", "uq_review_answers_client_answer_id", "uq_review_answers_session_item_round")),
    ("review_session_items", ("uq_review_session_items_session_queue", "uq_review_session_items_session_vocabulary")),
    ("review_sessions", ("ix_review_sessions_active", "ix_review_sessions_user_started")),
    ("vocabulary_items", ("ix_vocabulary_items_source_library_item", "ix_vocabulary_items_user_due", "ix_vocabulary_items_user_source_type", "ix_vocabulary_items_user_word")),
    ("learning_progress", ("ix_learning_progress_recent",)),
    ("videos", ("ix_videos_provider_video",)),
    ("library_items", ("ix_library_items_user_type_created", "ix_library_items_user_updated")),
    ("stored_files", ("ix_stored_files_user_created", "uq_stored_files_backend_key")),
    ("user_sessions", ("ix_user_sessions_active", "ix_user_sessions_user_expires")),
    ("daily_activities", ("ix_daily_activities_user_date", "uq_daily_activities_user_activity_date")),
    ("users", ("uq_users_email_ci",)),
)

