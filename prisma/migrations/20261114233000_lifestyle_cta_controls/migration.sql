-- AlterTable Homepage
ALTER TABLE "Homepage" ADD COLUMN "lifestyleCtaEnabled" BOOLEAN DEFAULT 1;
ALTER TABLE "Homepage" ADD COLUMN "lifestyleCtaExternal" BOOLEAN DEFAULT 0;

-- Fix stale test reference in dev.db if present
UPDATE "Homepage"
SET "lifestyleTopLeftImageUrl" = 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=2400&q=88'
WHERE "lifestyleTopLeftImageUrl" = '/uploads/qa-top-left.jpg';

