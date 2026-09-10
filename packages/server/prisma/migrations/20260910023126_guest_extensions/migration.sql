-- CreateTable
CREATE TABLE "GuestExtension" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "priceYen" INTEGER NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedByUserId" TEXT,

    CONSTRAINT "GuestExtension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestExtension_guestId_idx" ON "GuestExtension"("guestId");

-- AddForeignKey
ALTER TABLE "GuestExtension" ADD CONSTRAINT "GuestExtension_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestExtension" ADD CONSTRAINT "GuestExtension_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
