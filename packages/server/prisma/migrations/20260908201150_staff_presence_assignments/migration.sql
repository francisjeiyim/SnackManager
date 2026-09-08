-- CreateEnum
CREATE TYPE "StaffPresence" AS ENUM ('PRESENT', 'ABSENT', 'BREAK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "presence" "StaffPresence" NOT NULL DEFAULT 'ABSENT',
ADD COLUMN     "presenceChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GuestAssignment" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,

    CONSTRAINT "GuestAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestAssignment_guestId_idx" ON "GuestAssignment"("guestId");

-- CreateIndex
CREATE INDEX "GuestAssignment_userId_idx" ON "GuestAssignment"("userId");

-- CreateIndex
CREATE INDEX "GuestAssignment_endedAt_idx" ON "GuestAssignment"("endedAt");

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
