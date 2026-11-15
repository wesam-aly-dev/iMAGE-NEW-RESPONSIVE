-- AlterTable
ALTER TABLE "Project" ADD COLUMN "virtualTourEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "virtualTourUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN "virtualTourUrlAr" TEXT;
ALTER TABLE "Project" ADD COLUMN "virtualTourLabelEn" TEXT DEFAULT 'Explore Virtual Tour';
ALTER TABLE "Project" ADD COLUMN "virtualTourLabelAr" TEXT DEFAULT 'استكشف الجولة الافتراضية';
ALTER TABLE "Project" ADD COLUMN "virtualTourDescriptionEn" TEXT;
ALTER TABLE "Project" ADD COLUMN "virtualTourDescriptionAr" TEXT;

