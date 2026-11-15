import { prisma } from "../prisma";
import { getSmtpConfig, sendViaSmtp } from "./smtp-client";
import { buildCareerEmail, buildLeadEmail, buildTestEmail } from "./templates";
import {
  CareerApplicationPayload,
  EmailDeliveryResult,
  EmailSendOptions,
  LeadInquiryPayload,
  NotificationStatus,
  TestEmailPayload,
} from "./types";

export interface ResolvedNotificationSettings {
  enabled: boolean;
  recipientEmail: string | null;
  careersRecipientEmail: string | null;
  senderEmail: string;
  smtpConfigured: boolean;
  hasResend: boolean;
  isConfigured: boolean;
}

export async function getResolvedNotificationSettings(): Promise<ResolvedNotificationSettings> {
  let settings: {
    notificationEmailEnabled?: boolean | null;
    notificationRecipientEmail?: string | null;
    careersRecipientEmail?: string | null;
    notificationSenderEmail?: string | null;
  } | null = null;

  try {
    settings = await prisma.globalSettings.findUnique({
      where: { id: "global" },
      select: {
        notificationEmailEnabled: true,
        notificationRecipientEmail: true,
        careersRecipientEmail: true,
        notificationSenderEmail: true,
      },
    });
  } catch (err: unknown) {
    console.error("Notice: Failed to query notification fields on globalSettings:", err);
  }

  // Use the recipient setting intended for inquiry notifications.
  // Do not accidentally use the public contact email or administrator login email.
  const rawRecipient = settings?.notificationRecipientEmail?.trim() || process.env.NOTIFICATION_RECIPIENT_EMAIL?.trim();
  const primaryRecipient = rawRecipient && rawRecipient.includes("@") ? rawRecipient : null;

  const rawCareers = settings?.careersRecipientEmail?.trim();
  const careersRecipient = rawCareers && rawCareers.includes("@") ? rawCareers : primaryRecipient;

  const senderEmail =
    settings?.notificationSenderEmail?.trim() ||
    process.env.SMTP_FROM ||
    process.env.NOTIFICATION_SENDER_EMAIL ||
    "notifications@imagedevelopments.com";

  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const smtpConfig = getSmtpConfig();
  const smtpConfigured = Boolean(smtpConfig);

  return {
    enabled: settings?.notificationEmailEnabled ?? true,
    recipientEmail: primaryRecipient,
    careersRecipientEmail: careersRecipient,
    senderEmail,
    smtpConfigured,
    hasResend,
    isConfigured: Boolean(primaryRecipient && (smtpConfigured || hasResend)),
  };
}

async function sendEmail(options: EmailSendOptions): Promise<EmailDeliveryResult> {
  // 1. Resend API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from || "Image Developments <onboarding@resend.dev>",
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
          error: data.message || `Resend API error HTTP ${res.status}`,
          provider: "resend",
        };
      }

      return {
        success: true,
        status: "DELIVERED",
        messageId: data.id || `resend-${Date.now()}`,
        provider: "resend",
      };
    } catch (err: unknown) {
      return {
        success: false,
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        provider: "resend",
      };
    }
  }

  // 2. Direct SMTP if configured
  const smtpConfig = getSmtpConfig();
  if (smtpConfig) {
    return sendViaSmtp(options, smtpConfig);
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
  tx: any,
  params: {
    jobType: "LEAD_INQUIRY" | "CAREER_APPLICATION" | "TEST_EMAIL";
    targetId?: string;
    recipientEmail: string | null;
    senderEmail?: string;
    subject: string;
    payload: any;
  }
) {
  const isBlocked = !params.recipientEmail || !params.recipientEmail.includes("@");
  const initialStatus = isBlocked ? "BLOCKED" : "PENDING";
  const initialError = isBlocked
    ? "Notification recipient email address is not configured in Settings → Form Notifications"
    : null;

  return tx.notificationJob.create({
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
  if (job.status === "DELIVERED" || job.status === "PROCESSING") {
    return {
      success: job.status === "DELIVERED",
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

  try {
    const parsedPayload = JSON.parse(job.payload);

    if (job.jobType === "LEAD_INQUIRY") {
      const emailContent = buildLeadEmail(parsedPayload as LeadInquiryPayload, appUrl);
      sendOptions = {
        to: job.recipientEmail,
        from: job.senderEmail || settings.senderEmail,
        replyTo: parsedPayload.email && parsedPayload.email.includes("@") ? parsedPayload.email : undefined,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      };
    } else if (job.jobType === "CAREER_APPLICATION") {
      const emailContent = buildCareerEmail(parsedPayload as CareerApplicationPayload, appUrl);
      sendOptions = {
        to: job.recipientEmail,
        from: job.senderEmail || settings.senderEmail,
        replyTo: parsedPayload.email && parsedPayload.email.includes("@") ? parsedPayload.email : undefined,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      };
    } else {
      const emailContent = buildTestEmail(parsedPayload as TestEmailPayload);
      sendOptions = {
        to: job.recipientEmail,
        from: job.senderEmail || settings.senderEmail,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      };
    }
  } catch (err: unknown) {
    const errorMsg = `Payload parse error: ${err instanceof Error ? err.message : String(err)}`;
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

  if (result.success && result.status === "DELIVERED") {
    const now = new Date();
    await prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: "DELIVERED",
        deliveredAt: now,
        lastError: null,
      },
    });

    if (job.targetId) {
      if (job.jobType === "LEAD_INQUIRY") {
        await prisma.contactSubmission.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: "DELIVERED",
            notificationSentAt: now,
            notificationError: null,
            notificationAttempts: { increment: 1 },
          },
        });
      } else if (job.jobType === "CAREER_APPLICATION") {
        await prisma.careerApplication.updateMany({
          where: { id: job.targetId },
          data: {
            notificationStatus: "DELIVERED",
            notificationSentAt: now,
            notificationError: null,
            notificationAttempts: { increment: 1 },
          },
        });
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
      }
    }
  } else {
    // FAILED
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
      }
    }
  }

  return result;
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

  // Update GlobalSettings test fields
  const summary = result.success
    ? `SUCCESS: Delivered via ${result.provider} at ${new Date().toISOString()}`
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

  const settings = await getResolvedNotificationSettings();

  // If recipient still not configured, inform administrator immediately
  if (!settings.recipientEmail) {
    const errorMsg = "Notification recipient email address is not configured in Settings → Form Notifications";
    await prisma.contactSubmission.update({
      where: { id: leadId },
      data: { notificationStatus: "BLOCKED", notificationError: errorMsg },
    });
    return {
      success: false,
      status: "BLOCKED",
      error: errorMsg,
    };
  }

  // Look for existing job or create a new one
  let job = await prisma.notificationJob.findFirst({
    where: { targetId: leadId, jobType: "LEAD_INQUIRY" },
    orderBy: { createdAt: "desc" },
  });

  if (!job) {
    const payload: LeadInquiryPayload = {
      referenceNumber: lead.referenceNumber || `INQ-${lead.id.slice(0, 8)}`,
      formType: (lead.formType as any) || "GENERAL_CONTACT",
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
  } else {
    // Reset existing job to allow retry and route to current recipient
    job = await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        recipientEmail: settings.recipientEmail,
        senderEmail: settings.senderEmail,
        nextAttemptAt: new Date(),
      },
    });
  }

  return dispatchNotificationJob(job.id);
}
