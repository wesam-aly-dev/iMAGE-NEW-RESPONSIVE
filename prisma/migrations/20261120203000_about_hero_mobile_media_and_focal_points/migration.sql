-- AlterTable
ALTER TABLE "Homepage" ADD COLUMN "aboutHeroMobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "aboutHeroFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "aboutHeroMobileFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "aboutHeroCtaUrl" TEXT DEFAULT '#about';

