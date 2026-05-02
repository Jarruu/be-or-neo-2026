/*
  Warnings:

  - The values [LATE] on the enum `attendance_status` will be removed. If these variants are still used in the database, this will fail.
  - The values [PAID,FAILED,EXPIRED,REFUNDED] on the enum `payment_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `timeline_id` on the `attendances` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `external_payment_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `paid_at` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `payment_url` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `attendance_passcode` on the `recruitment_timelines` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,activity_id]` on the table `attendances` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `activity_id` to the `attendances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proof_url` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "attendance_status_new" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED', 'SICK');
ALTER TABLE "public"."attendances" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "attendances" ALTER COLUMN "status" TYPE "attendance_status_new" USING ("status"::text::"attendance_status_new");
ALTER TYPE "attendance_status" RENAME TO "attendance_status_old";
ALTER TYPE "attendance_status_new" RENAME TO "attendance_status";
DROP TYPE "public"."attendance_status_old";
ALTER TABLE "attendances" ALTER COLUMN "status" SET DEFAULT 'ABSENT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "payment_status_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "payment_status_new" USING ("status"::text::"payment_status_new");
ALTER TYPE "payment_status" RENAME TO "payment_status_old";
ALTER TYPE "payment_status_new" RENAME TO "payment_status";
DROP TYPE "public"."payment_status_old";
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_timeline_id_fkey";

-- DropIndex
DROP INDEX "attendances_user_id_timeline_id_key";

-- AlterTable
ALTER TABLE "attendances" DROP COLUMN "timeline_id",
ADD COLUMN     "activity_id" TEXT NOT NULL,
ALTER COLUMN "check_in_time" DROP NOT NULL,
ALTER COLUMN "check_in_time" DROP DEFAULT,
ALTER COLUMN "status" SET DEFAULT 'ABSENT';

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "currency",
DROP COLUMN "external_payment_id",
DROP COLUMN "paid_at",
DROP COLUMN "payment_url",
DROP COLUMN "provider",
ADD COLUMN     "proof_url" TEXT NOT NULL,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_admin_id" TEXT;

-- AlterTable
ALTER TABLE "recruitment_timelines" DROP COLUMN "attendance_passcode";

-- DropEnum
DROP TYPE "payment_provider";

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendances_user_id_activity_id_key" ON "attendances"("user_id", "activity_id");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
