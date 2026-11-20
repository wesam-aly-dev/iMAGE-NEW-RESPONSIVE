-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContactSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referenceNumber" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "countryCode" TEXT,
    "subject" TEXT NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT,
    "unitType" TEXT,
    "formType" TEXT NOT NULL DEFAULT 'GENERAL_CONTACT',
    "formVariant" TEXT,
    "sourcePage" TEXT,
    "sourceCta" TEXT,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT true,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT DEFAULT 'v1',
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "notificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "notificationError" TEXT,
    "notificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "notificationSentAt" DATETIME,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ContactSubmission" SELECT "id", "referenceNumber", "name", "email", "phone", "countryCode", "subject", "projectId", "projectName", "unitType", "formType", "formVariant", "sourcePage", "sourceCta", "consentAccepted", "marketingConsent", "consentVersion", "idempotencyKey", "status", "notes", "message", "locale", "notificationStatus", "notificationError", "notificationAttempts", "notificationSentAt", "isRead", "isArchived", "createdAt" FROM "ContactSubmission";
DROP TABLE "ContactSubmission";
ALTER TABLE "new_ContactSubmission" RENAME TO "ContactSubmission";
CREATE UNIQUE INDEX "ContactSubmission_referenceNumber_key" ON "ContactSubmission"("referenceNumber");
CREATE UNIQUE INDEX "ContactSubmission_idempotencyKey_key" ON "ContactSubmission"("idempotencyKey");
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");
CREATE INDEX "ContactSubmission_status_idx" ON "ContactSubmission"("status");
CREATE INDEX "ContactSubmission_isRead_idx" ON "ContactSubmission"("isRead");
CREATE INDEX "ContactSubmission_formType_idx" ON "ContactSubmission"("formType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

