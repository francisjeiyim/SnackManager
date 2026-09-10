-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "validatedHalfSets" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Seat" ADD COLUMN     "tempX" DOUBLE PRECISION,
ADD COLUMN     "tempY" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "soundRepeatSeconds" INTEGER NOT NULL DEFAULT 30;
