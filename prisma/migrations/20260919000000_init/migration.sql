-- CreateSchema

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "login_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_login_name_key" ON "users"("login_name");

CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "intranet_base_url" TEXT NOT NULL DEFAULT 'http://10.127.7.200:17789',
    "session_storage_key" TEXT NOT NULL DEFAULT '__tea_session_id_586864',
    "session_payload" TEXT NOT NULL DEFAULT '',
    "export_api_path" TEXT NOT NULL DEFAULT '',
    "first_import_date" TEXT NOT NULL DEFAULT '2025-09-01',
    "doors_per_cabinet" INTEGER NOT NULL DEFAULT 120,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_attempt_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_success_open_date" TEXT,
    "last_error" TEXT,
    "last_row_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "open_events" (
    "id" BIGSERIAL NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "student_name" TEXT,
    "student_no" TEXT NOT NULL,
    "class_code" TEXT NOT NULL,
    "cabinet" TEXT NOT NULL,
    "door_no" TEXT NOT NULL,
    "locker_code" TEXT NOT NULL,
    "open_type" TEXT NOT NULL,
    "verify_method" TEXT NOT NULL DEFAULT '',
    "admin_name" TEXT NOT NULL DEFAULT '',
    "remark" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "row_fingerprint" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "open_events_row_fingerprint_key" ON "open_events"("row_fingerprint");
CREATE INDEX "open_events_student_no_opened_at_idx" ON "open_events"("student_no", "opened_at" DESC);
CREATE INDEX "open_events_locker_code_opened_at_idx" ON "open_events"("locker_code", "opened_at" DESC);
CREATE INDEX "open_events_opened_at_idx" ON "open_events"("opened_at");

CREATE TABLE "student_current" (
    "student_no" TEXT NOT NULL,
    "class_code" TEXT NOT NULL,
    "student_name" TEXT,
    "last_opened_at" TIMESTAMP(3) NOT NULL,
    "last_locker_code" TEXT NOT NULL,
    "last_open_type" TEXT NOT NULL,
    "last_event_id" BIGINT NOT NULL,
    CONSTRAINT "student_current_pkey" PRIMARY KEY ("student_no")
);

CREATE TABLE "locker_current" (
    "locker_code" TEXT NOT NULL,
    "cabinet" TEXT NOT NULL,
    "door_no" TEXT NOT NULL,
    "student_no" TEXT,
    "class_code" TEXT,
    "student_name" TEXT,
    "last_opened_at" TIMESTAMP(3),
    "last_open_type" TEXT,
    "last_event_id" BIGINT,
    CONSTRAINT "locker_current_pkey" PRIMARY KEY ("locker_code")
);

CREATE INDEX "locker_current_cabinet_door_no_idx" ON "locker_current"("cabinet", "door_no");
