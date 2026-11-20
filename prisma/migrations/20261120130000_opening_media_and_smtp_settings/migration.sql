-- AlterTable
ALTER TABLE "Homepage" ADD COLUMN "openingMobilePosterUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot1ImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot1MobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot1AltEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot1AltAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot2ImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot2MobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot2AltEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot2AltAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot3ImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot3MobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot3AltEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot3AltAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot4ImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot4MobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot4AltEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot4AltAr" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot5ImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot5MobileImageUrl" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot5AltEn" TEXT;
ALTER TABLE "Homepage" ADD COLUMN "openingSlot5AltAr" TEXT;

-- AlterTable
ALTER TABLE "GlobalSettings" ADD COLUMN "notificationSenderName" TEXT DEFAULT 'Image Developments';
ALTER TABLE "GlobalSettings" ADD COLUMN "additionalRecipients" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpActiveSource" TEXT DEFAULT 'ENV';
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpPort" INTEGER DEFAULT 465;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpEncryption" TEXT DEFAULT 'SSL';
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpUser" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpPasswordEncrypted" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpPasswordIv" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "smtpPasswordTag" TEXT;

