import { prisma } from "../prisma";
import { getSmtpConfig, sendViaSmtp, testSmtpConnection, type SmtpConfig } from "./smtp-client";
import { decryptCredential } from "../crypto";
import { buildCareerEmail, buildLeadEmail, buildTestEmail } from "./templates";
import {
  CareerApplicationPayload,
  EmailDeliveryResult,
  EmailSendOptions,
  FormType,
  LeadInquiryPayload,
  NotificationStatus,
  TestEmailPayload,
} from "./types";
import type { Prisma } from "@prisma/client";

export interface ResolvedNotificationSettings {
  enabled: boolean;
  recipientEmail: string | null;
  careersRecipientEmail: string | null;
  senderEmail: string;
  senderName: string;
  additionalRecipients: string[];
  smtpSource: "CMS" | "ENV";
  smtpHost: string | null;
  smtpPort: number;
  smtpEncryption: string;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  smtpConfigured: boolean;
  hasResend: boolean;
  isConfigured: boolean;
}

function sanitizeError(err: unknown): string {
  if (!err) return "Unknown delivery error";
  let str = err instanceof Error ? err.message : String(err);
  str = str.replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, "Bearer [REDACTED]");
  str = str.replace(/re_[A-Za-z0-9_]+/gi, "[REDACTED_API_KEY]");
  str = str.replace(/pass(?:word)?[:=]\s*[^\s,]+/gi, "password=[REDACTED]");
  return str;
}

export async function resolveActiveSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const s = await prisma.globalSettings.findUnique({
      where: { id: "global" },
      select: {
        smtpActiveSource: true,
        smtpHost: true,
        smtpPort: true,
        smtpEncryption: true,
        smtpUser: true,
        smtpPasswordEncrypted: true,
        smtpPasswordIv: true,
        smtpPasswordTag: true,
        notificationSenderEmail: true,
        notificationSenderName: true,
      },
    });

    if (s && (s.smtpActiveSource === "CMS" || (!process.env.SMTP_HOST && s.smtpHost)) && s.smtpHost) {
      const decryptedPass = decryptCredential({
        ciphertext: s.smtpPasswordEncrypted,
        iv: s.smtpPasswordIv,
        tag: s.smtpPasswordTag,
      }) || undefined;

      const port = s.smtpPort || 465;
      const secure = s.smtpEncryption === "SSL" || port === 465;
      const senderName = s.notificationSenderName || "Image Developments";
      const senderAddr = s.notificationSenderEmail || s.smtpUser || "website@image-developments.com";
      const from = `"${senderName}" <${senderAddr}>`;

      return {
        host: s.smtpHost,
        port,
        secure,
        user: s.smtpUser || undefined,
        pass: decryptedPass,
        from,
        timeoutMs: 15000,
      };
    }
  } catch (err: unknown) {
    console.error("Notice: Failed to query CMS SMTP settings:", err);
  }

  // Fallback to environment variables
  return getSmtpConfig();
}

export async function getResolvedNotificationSettings(): Promise<ResolvedNotificationSettings> {
  let settings: {
    notificationEmailEnabled?: boolean | null;
    notificationRecipientEmail?: string | null;
    careersRecipientEmail?: string | null;
    notificationSenderEmail?: string | null;
    notificationSenderName?: string | null;
    additionalRecipients?: string | null;
    smtpActiveSource?: string | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpEncryption?: string | null;
    smtpUser?: string | null;
    smtpPasswordEncrypted?: string | null;
  } | null = null;

  try {
    settings = await prisma.globalSettings.findUnique({
      where: { id: "global" },
      select: {
        notificationEmailEnabled: true,
        notificationRecipientEmail: true,
        careersRecipientEmail: true,
        notificationSenderEmail: true,
        notificationSenderName: true,
        additionalRecipients: true,
        smtpActiveSource: true,
        smtpHost: true,
        smtpPort: true,
        smtpEncryption: true,
        smtpUser: true,
        smtpPasswordEncrypted: true,
      },
    });
  } catch (err: unknown) {
    console.error("Notice: Failed to query notification fields on globalSettings:", err);
  }

  // Use the recipient setting intended for inquiry notifications.
  // Stored in the database and survives restarts.
  const rawRecipient = settings?.notificationRecipientEmail?.trim() || process.env.NOTIFICATION_RECIPIENT_EMAIL?.trim() || "info@image-developments.com";
  const primaryRecipient = rawRecipient && rawRecipient.includes("@") ? rawRecipient : "info@image-developments.com";

  const rawCareers = settings?.careersRecipientEmail?.trim();
  const careersRecipient = rawCareers && rawCareers.includes("@") ? rawCareers : primaryRecipient;

  const senderEmail =
    settings?.notificationSenderEmail?.trim() ||
    settings?.smtpUser?.trim() ||
    process.env.SMTP_FROM ||
    process.env.NOTIFICATION_SENDER_EMAIL ||
    "website@image-developments.com";

  const senderName = settings?.notificationSenderName?.trim() || "Image Developments";

  const additionalRecipients = (settings?.additionalRecipients || "")
    .split(/[\s,;]+/)
    .map(e => e.trim())
    .filter(e => e && e.includes("@"));

  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const activeSmtp = await resolveActiveSmtpConfig();
  const smtpConfigured = Boolean(activeSmtp);

  return {
    enabled: settings?.notificationEmailEnabled ?? true,
    recipientEmail: primaryRecipient,
    careersRecipientEmail: careersRecipient,
    senderEmail,
    senderName,
    additionalRecipients,
    smtpSource: (settings?.smtpActiveSource as "CMS" | "ENV") || "ENV",
    smtpHost: settings?.smtpHost || null,
    smtpPort: settings?.smtpPort || 465,
    smtpEncryption: settings?.smtpEncryption || "SSL",
    smtpUser: settings?.smtpUser || null,
    hasSmtpPassword: Boolean(settings?.smtpPasswordEncrypted),
    smtpConfigured,
    hasResend,
    isConfigured: Boolean(primaryRecipient && (smtpConfigured || hasResend)),
  };
}

async function sendEmail(options: EmailSendOptions): Promise<EmailDeliveryResult> {
  // 1. Authoritative SMTP if configured (CMS-managed or Environment)
  const smtpConfig = await resolveActiveSmtpConfig();
  if (smtpConfig) {
    return sendViaSmtp(options, smtpConfig);
  }

  // 2. Secondary fallback: Resend API if configured in environment
  if (process.env.RESEND_API_KEY) {
    try {
      // Use configured sender or verified domain; fallback to onboarding@resend.dev for test sandbox
      const fromAddress =
        options.from && options.from.includes("@") && !options.from.includes("localhost")
          ? options.from.includes("<")
            ? options.from
            : `Image Developments <${options.from}>`
          : process.env.RESEND_FROM || "Image Developments <onboarding@resend.dev>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [options.to],
          reply_to: options.replyTo,
          subject: options.subject,
          text: options.text,
          html: options.html,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          status: "FAILED",
          error: sanitizeError(data.message || `Resend API error HTTP ${res.status}`),
          provider: "resend",
        };
      }

      return {
        success: true,
        status: "ACCEPTED",
        messageId: data.id || `resend-${Date.now()}`,
        provider: "resend",
      };
    } catch (err: unknown) {
      return {
        success: false,
        status: "FAILED",
        error: sanitizeError(err),
        provider: "resend",
      };
    }
  }

  // 3. Neither configured: mark as BLOCKED (honest, clear status - zero fake success simulation)
  return {
    success: false,
    status: "BLOCKED",
    error: "SMTP credentials not configured in environment (SMTP_HOST / SMTP_USER / SMTP_PASS or RESEND_API_KEY)",
    provider: "none",
  };
}

export async function createNotificationJob(
  tx: Prisma.TransactionClient | { notificationJob: { create: (args: any) => Promise<any> } },
  params: {
    jobType: "LEAD_INQUIRY" | "CAREER_APPLICATION" | "TEST_EMAIL";
    targetId?: string;
    recipientEmail: string | null;
    senderEmail?: string;
    subject: string;
    payload: unknown;
  }
): Promise<{ id: string; status: NotificationStatus }> {
  const isBlocked = !params.recipientEmail || !params.recipientEmail.includes("@");
  const initialStatus: NotificationStatus = isBlocked ? "BLOCKED" : "PENDING";
  const initialError = isBlocked
    ? "Notification recipient email address is not configured in Settings → Form Notifications"
    : null;

  const job = await (tx.notificationJob as any).create({
    data: {
      jobType: params.jobType,
      targetId: params.targetId,
      recipientEmail: params.recipientEmail || "unconfigured@local",
      senderEmail: params.senderEmail,
      subject: params.subject,
      payload: JSON.stringify(params.payload),
      status: initialStatus,
      lastError: initialError,
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(),
    },
  });

  return { id: job.id, status: job.status as NotificationStatus };
}

export async function dispatchNotificationJob(jobId: string): Promise<EmailDeliveryResult> {
  const job = await prisma.notificationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return {
      success: false,
      status: "FAILED",
      error: `NotificationJob ${jobId} not found`,
    };
  }

  // Prevent duplicate concurrent worker dispatch
  if (job.status === "DELIVERED" || job.status === "ACCEPTED" || job.status === "PROCESSING") {
    return {
      success: job.status === "DELIVERED" || job.status === "ACCEPTED",
      status: job.status as NotificationStatus,
      error: job.status === "PROCESSING" ? "Notification is currently processing" : undefined,
    };
  }

  // Validate recipient email address
  if (!job.recipientEmail || job.recipientEmail === "unconfigured@local" || !job.recipientEmail.includes("@")) {
    const errorMsg = "Notification recipient email address is not configured in Settings → Form Notifications";
    await prisma.notificationJob.update({
      where: { id: jobId },
      data: { status: "BLOCKED", lastError: errorMsg },
    });
    if (job.targetId) {
      if (job.jobType === "LEAD_INQUIRY") {
        await prisma.contactSubmission.updateMany({
          where: { id: job.targetId },
          data: { notificationStatus: "BLOCKED", notificationError: errorMsg },
        });
      } else if (job.jobType === "CAREER_APPLICATION") {
        await prisma.careerApplication.updateMany({
          where: { id: job.targetId },
          data: { notificationStatus: "BLOCKED", notificationError: errorMsg },
        });
      }
    }
    return { success: false, status: "BLOCKED", error: errorMsg };
  }

  const settings = await getResolvedNotificationSettings();

  // If notifications disabled by administrator
  if (!settings.enabled && job.jobType !== "TEST_EMAIL") {
    await prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: "SKIPPED",
        lastError: "Notifications disabled in Global Settings",
      },
    });

    if (job.targetId) {
      if (job.jobType === "LEAD_INQUIRY") {
        await prisma.contactSubmission.updateMany({
          where: { id: job.targetId },
          data: { notificationStatus: "SKIPPED", notificationError: "Notifications disabled in Global Settings" },
        });
      } else if (job.jobType === "CAREER_APPLICATION") {
        await prisma.careerApplication.updateMany({
          where: { id: job.targetId },
          data: { notificationStatus: "SKIPPED", notificationError: "Notifications disabled in Global Settings" },
        });
      }
    }

    return {
      success: true,
      status: "SKIPPED",
      error: "Notifications disabled in Global Settings",
    };
  }

  // Mark PROCESSING
  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  let sendOptions: EmailSendOptions;
  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://imagedevelopments.com" : "http://localhost:3000")
  ).replace(/\/+$/, "");

  let parsedPayload: Record<string, unknown> | null = null;
  try {
    parsedPayload = JSON.parse(job.payload) as Record<string, unknown>;

    if (job.jobType === "LEAD_INQUIRY") {
      const emailContent = buildLeadEmail(parsedPayload as unknown as LeadInquiryPayload, appUrl);
      sendOptions = {
        to: job.recipientEmail,
        from: job.senderEmail || settings.senderEmail,
        replyTo: typeof parsedPayload.email === "string" && parsedPayload.email.includes("@") ? parsedPayload.email : undefined,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      };
    } else if (job.jobType === "CAREER_APPLICATION") {
      const emailContent = buildCareerEmail(parsedPayload as unknown as CareerApplicationPayload, appUrl);
      sendOptions = {
        to: job.recipientEmail,
        from: job.senderEmail || settings.senderEmail,
        replyTo: typeof parsedPayload.email === "string" && parsedPayload.email.includes("@") ? parsedPayload.email : undefined,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      };
    } else {
      const emailContent = buildTestEmail(parsedPayload as unknown as TestEmailPayload);
      sendOptions = {
        to: job.recipientEmail,
        from: job.senderEmail || settings.senderEmail,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      };
    }
  } catch (err: unknown) {
    const errorMsg = sanitizeError(`Payload parse error: ${err instanceof Error ? err.message : String(err)}`);
    await prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        lastError: errorMsg,
      },
    });
    return { success: false, status: "FAILED", error: errorMsg };
  }

  const result = await sendEmail(sendOptions);

  if (result.success && (result.status === "ACCEPTED" || result.status === "DELIVERED")) {
    const now = new Date();
    await prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: result.status,
        deliveredAt: now,
        lastError: null,
      },
    });

    if (job.targetId) {
      if (job.jobType === "LEAD_INQUIRY") {
        await prisma.contactSubmission.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: result.status,
            notificationSentAt: now,
            notificationError: null,
            notificationAttempts: { increment: 1 },
          },
        });
      } else if (job.jobType === "CAREER_APPLICATION") {
        await prisma.careerApplication.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: result.status,
            notificationSentAt: now,
            notificationError: null,
            notificationAttempts: { increment: 1 },
          },
        });
        // Also update any linked lead record
        if (parsedPayload?.referenceNumber) {
          await prisma.contactSubmission.updateMany({
            where: { referenceNumber: parsedPayload.referenceNumber },
            data: {
              notificationStatus: result.status,
              notificationSentAt: now,
              notificationError: null,
              notificationAttempts: { increment: 1 },
            },
          });
        }
      }
    }
  } else if (result.status === "BLOCKED") {
    // Unconfigured environment
    await prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: "BLOCKED",
        lastError: result.error,
      },
    });

    if (job.targetId) {
      if (job.jobType === "LEAD_INQUIRY") {
        await prisma.contactSubmission.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: "BLOCKED",
            notificationError: result.error,
            notificationAttempts: { increment: 1 },
          },
        });
      } else if (job.jobType === "CAREER_APPLICATION") {
        await prisma.careerApplication.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: "BLOCKED",
            notificationError: result.error,
            notificationAttempts: { increment: 1 },
          },
        });
        if (parsedPayload?.referenceNumber) {
          await prisma.contactSubmission.updateMany({
            where: { referenceNumber: parsedPayload.referenceNumber },
            data: {
              notificationStatus: "BLOCKED",
              notificationError: result.error,
              notificationAttempts: { increment: 1 },
            },
          });
        }
      }
    }
  } else {
    // FAILED - bounded retries with exponential backoff
    const attempts = job.attempts + 1;
    const isExhausted = attempts >= job.maxAttempts;
    const backoffSeconds = Math.min(60 * Math.pow(2, attempts), 3600);
    const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

    await prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: isExhausted ? "FAILED" : "PENDING",
        lastError: result.error,
        nextAttemptAt,
      },
    });

    if (job.targetId) {
      if (job.jobType === "LEAD_INQUIRY") {
        await prisma.contactSubmission.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: isExhausted ? "FAILED" : "PENDING",
            notificationError: result.error,
            notificationAttempts: { increment: 1 },
          },
        });
      } else if (job.jobType === "CAREER_APPLICATION") {
        await prisma.careerApplication.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: isExhausted ? "FAILED" : "PENDING",
            notificationError: result.error,
            notificationAttempts: { increment: 1 },
          },
        });
        if (parsedPayload?.referenceNumber) {
          await prisma.contactSubmission.updateMany({
            where: { referenceNumber: parsedPayload.referenceNumber },
            data: {
              notificationStatus: isExhausted ? "FAILED" : "PENDING",
              notificationError: result.error,
              notificationAttempts: { increment: 1 },
            },
          });
        }
      }
    }
  }

  return result;
}

export async function processPendingNotificationJobs(limit = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  blocked: number;
}> {
  const now = new Date();
  const pendingJobs = await prisma.notificationJob.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let succeeded = 0;
  let failed = 0;
  let blocked = 0;

  for (const job of pendingJobs) {
    try {
      const result = await dispatchNotificationJob(job.id);
      if (result.success) {
        succeeded++;
      } else if (result.status === "BLOCKED") {
        blocked++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`Error processing pending notification job ${job.id}:`, err);
      failed++;
    }
  }

  return {
    processed: pendingJobs.length,
    succeeded,
    failed,
    blocked,
  };
}

export async function sendTestNotificationEmail(recipientEmail: string): Promise<EmailDeliveryResult> {
  const cleanEmail = recipientEmail.trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return {
      success: false,
      status: "FAILED",
      error: "Invalid recipient email address format",
    };
  }

  const payload: TestEmailPayload = {
    recipientEmail: cleanEmail,
    triggeredAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  };

  const job = await prisma.notificationJob.create({
    data: {
      jobType: "TEST_EMAIL",
      recipientEmail: cleanEmail,
      subject: "Test Notification — Image Developments",
      payload: JSON.stringify(payload),
      status: "PENDING",
      attempts: 0,
      maxAttempts: 1,
    },
  });

  const result = await dispatchNotificationJob(job.id);

  // Update GlobalSettings test audit fields
  const summary = result.success
    ? `SUCCESS: Provider accepted via ${result.provider} (ID: ${result.messageId || "sent"}) at ${new Date().toISOString()}`
    : `${result.status}: ${result.error}`;

  await prisma.globalSettings.updateMany({
    where: { id: "global" },
    data: {
      lastNotificationTestAt: new Date(),
      lastNotificationTestResult: summary,
    },
  });

  return result;
}

export async function retryNotificationJob(jobId: string): Promise<EmailDeliveryResult> {
  const job = await prisma.notificationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return {
      success: false,
      status: "FAILED",
      error: `NotificationJob ${jobId} not found`,
    };
  }

  const settings = await getResolvedNotificationSettings();

  // If recipient was previously unconfigured and now is configured in CMS, route to current configured address
  const effectiveRecipient =
    job.recipientEmail && job.recipientEmail !== "unconfigured@local" && job.recipientEmail.includes("@")
      ? job.recipientEmail
      : job.jobType === "CAREER_APPLICATION"
      ? settings.careersRecipientEmail || settings.recipientEmail
      : settings.recipientEmail;

  if (!effectiveRecipient) {
    const errorMsg = "Notification recipient email address is not configured in Settings → Form Notifications";
    await prisma.notificationJob.update({
      where: { id: jobId },
      data: { status: "BLOCKED", lastError: errorMsg },
    });
    return {
      success: false,
      status: "BLOCKED",
      error: errorMsg,
    };
  }

  // Reset job for immediate retry
  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      recipientEmail: effectiveRecipient,
      senderEmail: settings.senderEmail,
      nextAttemptAt: new Date(),
      lastError: null,
    },
  });

  return dispatchNotificationJob(jobId);
}

export async function retryLeadNotification(leadId: string): Promise<EmailDeliveryResult> {
  const lead = await prisma.contactSubmission.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    return {
      success: false,
      status: "FAILED",
      error: `Lead ${leadId} not found`,
    };
  }

  // Look for existing job
  let job = await prisma.notificationJob.findFirst({
    where: { targetId: leadId },
    orderBy: { createdAt: "desc" },
  });

  if (!job) {
    const settings = await getResolvedNotificationSettings();
    if (!settings.recipientEmail) {
      const errorMsg = "Notification recipient email address is not configured in Settings → Form Notifications";
      await prisma.contactSubmission.update({
        where: { id: leadId },
        data: { notificationStatus: "BLOCKED", notificationError: errorMsg },
      });
      return { success: false, status: "BLOCKED", error: errorMsg };
    }

    const payload: LeadInquiryPayload = {
      referenceNumber: lead.referenceNumber || `INQ-${lead.id.slice(0, 8)}`,
      formType: (lead.formType as FormType) || "GENERAL_CONTACT",
      formVariant: lead.formVariant,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      countryCode: lead.countryCode,
      subject: lead.subject,
      message: lead.message,
      projectId: lead.projectId,
      projectName: lead.projectName,
      unitType: lead.unitType,
      sourcePage: lead.sourcePage,
      sourceCta: lead.sourceCta,
      locale: lead.locale || "en",
      consentAccepted: lead.consentAccepted,
      marketingConsent: lead.marketingConsent,
      consentVersion: lead.consentVersion,
      createdAt: lead.createdAt.toISOString(),
    };

    job = await prisma.notificationJob.create({
      data: {
        jobType: "LEAD_INQUIRY",
        targetId: lead.id,
        recipientEmail: settings.recipientEmail,
        senderEmail: settings.senderEmail,
        subject: `New Inquiry — ${lead.projectName || "General Inquiry"} — ${payload.referenceNumber}`,
        payload: JSON.stringify(payload),
        status: "PENDING",
        attempts: 0,
        maxAttempts: 3,
      },
    });
  }

  return retryNotificationJob(job.id);
}

export async function retryCareerNotification(applicationId: string): Promise<EmailDeliveryResult> {
  const app = await prisma.careerApplication.findUnique({
    where: { id: applicationId },
  });

  if (!app) {
    return {
      success: false,
      status: "FAILED",
      error: `CareerApplication ${applicationId} not found`,
    };
  }

  let job = await prisma.notificationJob.findFirst({
    where: { targetId: applicationId, jobType: "CAREER_APPLICATION" },
    orderBy: { createdAt: "desc" },
  });

  if (!job) {
    const settings = await getResolvedNotificationSettings();
    const recipient = settings.careersRecipientEmail || settings.recipientEmail;
    if (!recipient) {
      const errorMsg = "Notification recipient email address is not configured in Settings → Form Notifications";
      await prisma.careerApplication.update({
        where: { id: applicationId },
        data: { notificationStatus: "BLOCKED", notificationError: errorMsg },
      });
      return { success: false, status: "BLOCKED", error: errorMsg };
    }

    const payload: CareerApplicationPayload = {
      referenceNumber: app.referenceNumber || `APP-${app.id.slice(0, 8)}`,
      jobId: app.jobId,
      jobTitle: app.jobTitle,
      fullName: app.fullName,
      email: app.email,
      phone: app.phone,
      cvUrl: app.cvUrl,
      cvFilename: app.cvFilename,
      notes: app.notes,
      createdAt: app.createdAt.toISOString(),
    };

    job = await prisma.notificationJob.create({
      data: {
        jobType: "CAREER_APPLICATION",
        targetId: app.id,
        recipientEmail: recipient,
        senderEmail: settings.senderEmail,
        subject: `New Application — ${app.jobTitle} — ${payload.referenceNumber}`,
        payload: JSON.stringify(payload),
        status: "PENDING",
        attempts: 0,
        maxAttempts: 3,
      },
    });
  }

  return retryNotificationJob(job.id);
}
