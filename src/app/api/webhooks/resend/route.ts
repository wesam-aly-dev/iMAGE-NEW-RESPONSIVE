import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Resend Delivery & Bounce Webhook Handler
 * Verifies webhook signature when RESEND_WEBHOOK_SECRET is set,
 * and updates NotificationJob and associated ContactSubmission / CareerApplication records.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const rawBody = await req.text();

  // Signature verification if secret is provided
  if (secret) {
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 401 });
    }

    // Verify timestamp within 5 minutes to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(svixTimestamp, 10);
    if (Math.abs(now - ts) > 300) {
      return NextResponse.json({ error: "Webhook timestamp expired" }, { status: 401 });
    }

    try {
      const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
      const secretBytes = secret.startsWith("whsec_")
        ? Buffer.from(secret.slice(6), "base64")
        : Buffer.from(secret, "utf-8");
      const expectedSig = crypto
        .createHmac("sha256", secretBytes)
        .update(signedContent)
        .digest("base64");

      const signatures = svixSignature.split(" ").map((s) => s.replace(/^v1,/, ""));
      const isValid = signatures.some((sig) => {
        try {
          return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
        } catch {
          return false;
        }
      });

      if (!isValid) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    } catch (err) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType = event.type; // e.g. "email.delivered", "email.bounced", "email.complained"
    const emailId = event.data?.email_id || event.data?.id;

    if (!emailId) {
      return NextResponse.json({ received: true });
    }

    // Find corresponding notification job
    const job = await prisma.notificationJob.findFirst({
      where: {
        OR: [
          { id: emailId },
          { payload: { contains: emailId } },
        ],
      },
    });

    if (!job) {
      return NextResponse.json({ received: true, note: "Job not found" });
    }

    const now = new Date();

    if (eventType === "email.delivered") {
      await prisma.notificationJob.update({
        where: { id: job.id },
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
            data: { notificationStatus: "DELIVERED", notificationSentAt: now, notificationError: null },
          });
        } else if (job.jobType === "CAREER_APPLICATION") {
          await prisma.careerApplication.updateMany({
            where: { id: job.targetId },
            data: { notificationStatus: "DELIVERED", notificationSentAt: now, notificationError: null },
          });
        }
      }
    } else if (eventType === "email.bounced" || eventType === "email.complained") {
      const reason = event.data?.bounce?.message || `Recipient email ${eventType}`;
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: reason,
        },
      });

      if (job.targetId) {
        if (job.jobType === "LEAD_INQUIRY") {
          await prisma.contactSubmission.updateMany({
            where: { id: job.targetId },
            data: { notificationStatus: "FAILED", notificationError: reason },
          });
        } else if (job.jobType === "CAREER_APPLICATION") {
          await prisma.careerApplication.updateMany({
            where: { id: job.targetId },
            data: { notificationStatus: "FAILED", notificationError: reason },
          });
        }
      }
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (err: unknown) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
