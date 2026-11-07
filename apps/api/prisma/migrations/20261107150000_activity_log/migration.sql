-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" UUID,
    "chat_id" UUID,
    "chat_kind" TEXT,
    "chat_public" BOOLEAN,
    "ip" TEXT,
    "device" TEXT,
    "meta" JSONB,
    "media_kind" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "file_name" TEXT,
    "attachment_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reports" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_log_user_id_created_at_idx" ON "activity_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_log_type_created_at_idx" ON "activity_log"("type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "message_reports_created_at_idx" ON "message_reports"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "message_reports_message_id_reporter_id_key" ON "message_reports"("message_id", "reporter_id");

-- AddForeignKey
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

