-- AlterTable Homepage
ALTER TABLE "Homepage" ADD COLUMN "teamHeroEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Homepage" ADD COLUMN "teamHeroCtaLabelEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "teamHeroCtaLabelAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "teamHeroCtaUrl" TEXT DEFAULT '#team-roster';
ALTER TABLE "Homepage" ADD COLUMN "teamHeroImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "teamHeroMobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "teamHeroFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "teamHeroMobileFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "teamHeroImageAltEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "teamHeroImageAltAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "teamHeroOverlay" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Homepage" ADD COLUMN "teamHeroAlignment" TEXT NOT NULL DEFAULT 'start';
ALTER TABLE "Homepage" ADD COLUMN "teamHeroHeight" TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE "Homepage" ADD COLUMN "partnersHeroEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroCtaLabelEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroCtaLabelAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroCtaUrl" TEXT DEFAULT '#partners-directory';
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroMobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroMobileFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroImageAltEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroImageAltAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroOverlay" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroAlignment" TEXT NOT NULL DEFAULT 'start';
ALTER TABLE "Homepage" ADD COLUMN "partnersHeroHeight" TEXT NOT NULL DEFAULT 'standard';

-- AlterTable ContactPage
ALTER TABLE "ContactPage" ADD COLUMN "heroEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ContactPage" ADD COLUMN "heroCtaLabelEn" TEXT DEFAULT 'Send an Inquiry';
ALTER TABLE "ContactPage" ADD COLUMN "heroCtaLabelAr" TEXT DEFAULT 'أرسل استفسارك';
ALTER TABLE "ContactPage" ADD COLUMN "heroCtaUrl" TEXT DEFAULT '#contact-form';
ALTER TABLE "ContactPage" ADD COLUMN "heroImageUrl" TEXT;
ALTER TABLE "ContactPage" ADD COLUMN "heroMobileImageUrl" TEXT;
ALTER TABLE "ContactPage" ADD COLUMN "heroFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "ContactPage" ADD COLUMN "heroMobileFocalPoint" TEXT NOT NULL DEFAULT 'center';
ALTER TABLE "ContactPage" ADD COLUMN "heroImageAltEn" TEXT;
ALTER TABLE "ContactPage" ADD COLUMN "heroImageAltAr" TEXT;
ALTER TABLE "ContactPage" ADD COLUMN "heroOverlay" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "ContactPage" ADD COLUMN "heroAlignment" TEXT NOT NULL DEFAULT 'start';
ALTER TABLE "ContactPage" ADD COLUMN "heroHeight" TEXT NOT NULL DEFAULT 'standard';

