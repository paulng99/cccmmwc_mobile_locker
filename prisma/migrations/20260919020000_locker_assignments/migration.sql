-- CreateTable
CREATE TABLE "locker_assignments" (
    "student_no" TEXT NOT NULL,
    "student_name" TEXT,
    "class_code" TEXT NOT NULL DEFAULT '',
    "locker_code" TEXT NOT NULL DEFAULT '',
    "cabinet" TEXT NOT NULL DEFAULT '',
    "door_no" TEXT NOT NULL DEFAULT '',
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locker_assignments_pkey" PRIMARY KEY ("student_no")
);

-- CreateIndex
CREATE INDEX "locker_assignments_locker_code_idx" ON "locker_assignments"("locker_code");
