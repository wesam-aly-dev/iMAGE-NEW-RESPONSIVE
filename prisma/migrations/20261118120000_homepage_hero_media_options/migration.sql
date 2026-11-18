-- AlterTable
ALTER TABLE "Homepage" ADD COLUMN "heroMediaType" TEXT NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "Homepage" ADD COLUMN "heroFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "heroMobileMediaType" TEXT NOT NULL DEFAULT 'INHERIT';
ALTER TABLE "Homepage" ADD COLUMN "heroMobilePosterUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "heroMobileFocalPoint" TEXT NOT NULL DEFAULT 'center';

