-- AlterTable GlobalSettings
ALTER TABLE "GlobalSettings" ADD COLUMN "notificationEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GlobalSettings" ADD COLUMN "notificationRecipientEmail" TEXT DEFAULT 'info@imagedevelopments.com';
ALTER TABLE "GlobalSettings" ADD COLUMN "careersRecipientEmail" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "notificationSenderEmail" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN "lastNotificationTestAt" DATETIME;
ALTER TABLE "GlobalSettings" ADD COLUMN "lastNotificationTestResult" TEXT;

-- AlterTable ContactSubmission
ALTER TABLE "ContactSubmission" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "projectName" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "unitType" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "formType" TEXT NOT NULL DEFAULT 'GENERAL_CONTACT';
ALTER TABLE "ContactSubmission" ADD COLUMN "formVariant" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "sourcePage" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "sourceCta" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "consentAccepted" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ContactSubmission" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContactSubmission" ADD COLUMN "consentVersion" TEXT DEFAULT 'v1';
ALTER TABLE "ContactSubmission" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "notificationStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ContactSubmission" ADD COLUMN "notificationError" TEXT;
ALTER TABLE "ContactSubmission" ADD COLUMN "notificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContactSubmission" ADD COLUMN "notificationSentAt" DATETIME;
ALTER TABLE "ContactSubmission" ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContactSubmission" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "ContactSubmission_referenceNumber_key" ON "ContactSubmission"("referenceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ContactSubmission_idempotencyKey_key" ON "ContactSubmission"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ContactSubmission_isRead_idx" ON "ContactSubmission"("isRead");
CREATE INDEX IF NOT EXISTS "ContactSubmission_formType_idx" ON "ContactSubmission"("formType");

-- AlterTable CareerApplication
ALTER TABLE "CareerApplication" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "CareerApplication" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "CareerApplication" ADD COLUMN "notificationStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "CareerApplication" ADD COLUMN "notificationError" TEXT;
ALTER TABLE "CareerApplication" ADD COLUMN "notificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CareerApplication" ADD COLUMN "notificationSentAt" DATETIME;
ALTER TABLE "CareerApplication" ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CareerApplication" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "CareerApplication_referenceNumber_key" ON "CareerApplication"("referenceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CareerApplication_idempotencyKey_key" ON "CareerApplication"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CareerApplication_isRead_idx" ON "CareerApplication"("isRead");

-- CreateTable NotificationJob
CREATE TABLE IF NOT EXISTS "NotificationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "targetId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "senderEmail" TEXT,
    "subject" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" DATETIME,
    "deliveredAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NotificationJob_status_nextAttemptAt_idx" ON "NotificationJob"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "NotificationJob_targetId_idx" ON "NotificationJob"("targetId");

