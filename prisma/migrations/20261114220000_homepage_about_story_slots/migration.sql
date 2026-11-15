-- AlterTable Homepage with 4 distinct lifestyle/about story image slots
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopLeftImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopLeftImageAltEn" TEXT DEFAULT 'Image Developments architectural community';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopLeftImageAltAr" TEXT DEFAULT 'مجتمع معماري متكامل من إيمدج للتطوير العقاري';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopLeftFocalPoint" TEXT DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopLeftMobileImageUrl" TEXT;

ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopRightImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopRightImageAltEn" TEXT DEFAULT 'Image Developments landscape and craft';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopRightImageAltAr" TEXT DEFAULT 'الطبيعة والحرفية المعمارية في إيمدج';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopRightFocalPoint" TEXT DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleTopRightMobileImageUrl" TEXT;

ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomLeftImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomLeftImageAltEn" TEXT DEFAULT 'Image Developments interior space';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomLeftImageAltAr" TEXT DEFAULT 'المساحات الداخلية في إيمدج';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomLeftFocalPoint" TEXT DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomLeftMobileImageUrl" TEXT;

ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomRightImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomRightImageAltEn" TEXT DEFAULT 'Image Developments destination overview';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomRightImageAltAr" TEXT DEFAULT 'إطلالة على وجهات إيمدج للتطوير العقاري';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomRightFocalPoint" TEXT DEFAULT 'center';
ALTER TABLE "Homepage" ADD COLUMN "lifestyleBottomRightMobileImageUrl" TEXT;

-- Seed existing legacy images into the new slot columns so editors immediately see them
UPDATE "Homepage" SET
  "lifestyleTopLeftImageUrl" = COALESCE("lifestyleMediaUrl", 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=2400&q=88'),
  "lifestyleTopRightImageUrl" = 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=86',
  "lifestyleBottomLeftImageUrl" = '/uploads/1793279841889-4de211e8-2ffe-4cc9-a5fa-5139968c5cf1.jpg',
  "lifestyleBottomRightImageUrl" = 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2200&q=88'
WHERE "id" = 'homepage' AND ("lifestyleTopLeftImageUrl" IS NULL OR "lifestyleTopLeftImageUrl" = '');

