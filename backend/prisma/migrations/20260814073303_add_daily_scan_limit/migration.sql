-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyScanCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyScanDate" TIMESTAMP(3);
