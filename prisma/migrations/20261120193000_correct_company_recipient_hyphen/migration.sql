-- Non-destructive migration to ensure the hyphenated company domain is used in GlobalSettings defaults and records
UPDATE "GlobalSettings"
SET "notificationRecipientEmail" = 'info@image-developments.com'
WHERE "notificationRecipientEmail" = 'info@imagedevelopments.com' OR "notificationRecipientEmail" IS NULL;

UPDATE "GlobalSettings"
SET "notificationSenderEmail" = 'website@image-developments.com'
WHERE "notificationSenderEmail" = 'website@imagedevelopments.com' OR "notificationSenderEmail" IS NULL;

UPDATE "GlobalSettings"
SET "smtpUser" = 'website@image-developments.com'
WHERE "smtpUser" = 'website@imagedevelopments.com' OR "smtpUser" IS NULL;

UPDATE "GlobalSettings"
SET "contactEmail" = 'info@image-developments.com'
WHERE "contactEmail" = 'info@imagedevelopments.com' OR "contactEmail" IS NULL;

UPDATE "GlobalSettings"
SET "smtpHost" = 'image-developments.com'
WHERE "smtpHost" = 'imagedevelopments.com' OR "smtpHost" IS NULL;
