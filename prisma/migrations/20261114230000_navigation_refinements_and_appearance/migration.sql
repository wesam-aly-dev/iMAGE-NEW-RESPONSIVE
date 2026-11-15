-- AlterTable NavigationItem
ALTER TABLE "NavigationItem" ADD COLUMN "previewImageAltEn" TEXT;
ALTER TABLE "NavigationItem" ADD COLUMN "previewImageAltAr" TEXT;

-- AlterTable GlobalSettings
ALTER TABLE "GlobalSettings" ADD COLUMN "morePagesLabelEn" TEXT DEFAULT 'More Pages';
ALTER TABLE "GlobalSettings" ADD COLUMN "morePagesLabelAr" TEXT DEFAULT 'المزيد من الصفحات';
ALTER TABLE "GlobalSettings" ADD COLUMN "menuFontSizeDesktop" TEXT DEFAULT '1.125rem';
ALTER TABLE "GlobalSettings" ADD COLUMN "menuFontSizeMobile" TEXT DEFAULT '1rem';

