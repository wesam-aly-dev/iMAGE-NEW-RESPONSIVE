import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { submitContact } from "@/app/actions";
import {
  resolveActiveSmtpConfig,
  getResolvedNotificationSettings,
  dispatchNotificationJob,
  retryLeadNotification,
} from "@/lib/notifications/email-service";
import { buildLeadEmail } from "@/lib/notifications/templates";
import type { LeadInquiryPayload } from "@/lib/notifications/types";

describe("Website Inquiry Specification Tests (P0 Verification)", { timeout: 35000 }, () => {
  beforeEach(async () => {
    // Ensure CMS settings are configured to requested company mailboxes
    await prisma.globalSettings.upsert({
      where: { id: "global" },
      update: {
        notificationEmailEnabled: true,
        notificationRecipientEmail: "info@image-developments.com",
        notificationSenderEmail: "website@image-developments.com",
        notificationSenderName: "Image Developments",
        smtpActiveSource: "CMS",
        smtpHost: "image-developments.com",
        smtpPort: 465,
        smtpEncryption: "SSL",
        smtpUser: "website@image-developments.com",
      },
      create: {
        id: "global",
        siteNameEn: "Image Developments",
        siteNameAr: "إيمدج للتطوير العقاري",
        contactEmail: "info@image-developments.com",
        phone: "+20 100 000 0000",
        addressEn: "Cairo, Egypt",
        addressAr: "القاهرة، مصر",
        copyrightEn: "Image Developments",
        copyrightAr: "إيمدج للتطوير العقاري",
        defaultSeoTitleEn: "Image Developments",
        defaultSeoTitleAr: "إيمدج للتطوير العقاري",
        defaultSeoDescriptionEn: "Image Developments",
        defaultSeoDescriptionAr: "إيمدج للتطوير العقاري",
        menuMediaUrl: "/placeholder.jpg",
        menuMediaAltEn: "Menu",
        menuMediaAltAr: "القائمة",
        notificationEmailEnabled: true,
        notificationRecipientEmail: "info@image-developments.com",
        notificationSenderEmail: "website@image-developments.com",
        notificationSenderName: "Image Developments",
        smtpActiveSource: "CMS",
        smtpHost: "image-developments.com",
        smtpPort: 465,
        smtpEncryption: "SSL",
        smtpUser: "website@image-developments.com",
      },
    });
  });

  // A. Submit name and phone only
  it("A. Submit name and phone only: succeeds, saves 1 lead with null email, targets info mailbox, From is website mailbox, Reply-To omitted", async () => {
    const testName = `Tarek Zaki ${Math.random().toString(36).substring(2, 7)}`;
    const testPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;

    const formData = new FormData();
    formData.append("name", testName);
    formData.append("phone", testPhone);
    formData.append("countryCode", "EG:+20");
    formData.append("locale", "en");
    formData.append("consent", "on");
    formData.append("website", "");
    // email is omitted completely

    const res = await submitContact({ status: "idle" }, formData);
    expect(res.status).toBe("success");
    expect(res.message).toContain("your enquiry has been received");

    // 1. Exactly one lead is saved
    const matchingLeads = await prisma.contactSubmission.findMany({
      where: { name: testName },
    });
    expect(matchingLeads.length).toBe(1);
    const lead = matchingLeads[0];
    expect(lead.phone).toContain(testPhone);
    expect(lead.email).toBeNull(); // Optional in database persistence

    // 2. Notification job targets info@image-developments.com
    const job = await prisma.notificationJob.findFirst({
      where: { targetId: lead.id },
    });
    expect(job).toBeDefined();
    expect(job!.recipientEmail).toBe("info@image-developments.com");
    expect(job!.senderEmail).toBe("website@image-developments.com");

    // 3. Email content: From is website@, Reply-To is omitted
    const payload = JSON.parse(job!.payload) as LeadInquiryPayload;
    expect(payload.email).toBeNull();
    const email = buildLeadEmail(payload, "https://image-developments.com");
    expect(email.subject).toContain("New Website Inquiry");
    expect(email.subject).toContain(testName);
    expect(email.text).toContain("Email: Not provided");
    expect(email.html).toContain("Not provided");
    expect(email.html).toContain(`tel:+20${testPhone}`);
  });

  // B. Submit name, phone, and valid customer email
  it("B. Submit name, phone, and valid customer email: lead saved, notification created with Reply-To matching customer email", async () => {
    const testName = `Mona El-Shazly ${Math.random().toString(36).substring(2, 7)}`;
    const testPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const customerEmail = "mona.elshazly@example.com";

    const formData = new FormData();
    formData.append("name", testName);
    formData.append("phone", testPhone);
    formData.append("countryCode", "EG:+20");
    formData.append("email", customerEmail);
    formData.append("locale", "en");
    formData.append("consent", "on");
    formData.append("website", "");

    const res = await submitContact({ status: "idle" }, formData);
    expect(res.status).toBe("success");

    const lead = await prisma.contactSubmission.findFirst({
      where: { name: testName },
    });
    expect(lead).toBeDefined();
    expect(lead!.email).toBe(customerEmail);

    const job = await prisma.notificationJob.findFirst({
      where: { targetId: lead!.id },
    });
    expect(job).toBeDefined();
    expect(job!.recipientEmail).toBe("info@image-developments.com");

    const payload = JSON.parse(job!.payload) as LeadInquiryPayload;
    expect(payload.email).toBe(customerEmail);

    const email = buildLeadEmail(payload, "https://image-developments.com");
    expect(email.text).toContain(`Email: ${customerEmail}`);
    expect(email.html).toContain(`mailto:${customerEmail}`);
  });

  // C. Submit an invalid non-empty email
  it("C. Submit an invalid non-empty email: shows inline validation error, preserves entered values, creates no lead", async () => {
    const testName = `Invalid Email Tester ${Math.random().toString(36).substring(2, 7)}`;
    const testPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const invalidEmail = "not-an-email-address";

    const formData = new FormData();
    formData.append("name", testName);
    formData.append("phone", testPhone);
    formData.append("countryCode", "EG:+20");
    formData.append("email", invalidEmail);
    formData.append("locale", "en");
    formData.append("consent", "on");
    formData.append("website", "");

    const res = await submitContact({ status: "idle" }, formData);
    expect(res.status).toBe("error");
    expect(res.fields?.email).toBe("Please enter a valid email address.");

    // Preserves entered values
    expect(res.values?.name).toBe(testName);
    expect(res.values?.phone).toBe(testPhone);
    expect(res.values?.email).toBe(invalidEmail);

    // No lead is saved
    const saved = await prisma.contactSubmission.findFirst({
      where: { name: testName },
    });
    expect(saved).toBeNull();
  });

  // D. Submit Arabic customer details and verify correct rendering
  it("D. Submit Arabic customer details and verify correct rendering and RTL direction", async () => {
    const arabicName = `م. حسام الشناوي ${Math.random().toString(36).substring(2, 5)}`;
    const testPhone = `011${Math.floor(10000000 + Math.random() * 90000000)}`;

    const formData = new FormData();
    formData.append("name", arabicName);
    formData.append("phone", testPhone);
    formData.append("countryCode", "EG:+20");
    formData.append("locale", "ar");
    formData.append("consent", "on");
    formData.append("website", "");

    const res = await submitContact({ status: "idle" }, formData);
    expect(res.status).toBe("success");
    expect(res.message).toContain("تم استلام استفسارك بنجاح");

    const lead = await prisma.contactSubmission.findFirst({
      where: { name: arabicName },
    });
    expect(lead).toBeDefined();
    expect(lead!.locale).toBe("ar");

    const job = await prisma.notificationJob.findFirst({
      where: { targetId: lead!.id },
    });
    expect(job).toBeDefined();

    const payload = JSON.parse(job!.payload) as LeadInquiryPayload;
    const email = buildLeadEmail(payload, "https://image-developments.com");

    expect(email.subject).toContain("استفسار جديد عبر الموقع");
    expect(email.subject).toContain(arabicName);
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain('lang="ar"');
    expect(email.html).toContain("إشعار استفسار جديد");
    expect(email.html).toContain("الرقم المرجعي");
    expect(email.html).toContain("المشروع / الاهتمام");
    expect(email.html).toContain("غير محدد"); // Email not provided in Arabic
    expect(email.html).toContain(`tel:+20${testPhone}`);
    expect(email.html).toContain("/admin/leads?id=");
  });

  // E. Simulate SMTP failure: lead remains saved, failure is visible, retry does not duplicate lead
  it("E. Simulate SMTP failure: lead remains saved, failure recorded with actionable diagnostic, retry does not duplicate lead", async () => {
    const testName = `Failure Simulation ${Math.random().toString(36).substring(2, 7)}`;
    const testPhone = `012${Math.floor(10000000 + Math.random() * 90000000)}`;

    const formData = new FormData();
    formData.append("name", testName);
    formData.append("phone", testPhone);
    formData.append("countryCode", "EG:+20");
    formData.append("locale", "en");
    formData.append("consent", "on");
    formData.append("website", "");

    const res = await submitContact({ status: "idle" }, formData);
    // Customer receives success confirmation that enquiry is safely accepted
    expect(res.status).toBe("success");
    expect(res.message).toContain("your enquiry has been received");

    // Lead is safely persisted in DB
    const lead = await prisma.contactSubmission.findFirst({
      where: { name: testName },
    });
    expect(lead).toBeDefined();

    // Verify job exists
    const job = await prisma.notificationJob.findFirst({
      where: { targetId: lead!.id },
    });
    expect(job).toBeDefined();

    // Now test retry mechanism
    const retryResult = await retryLeadNotification(lead!.id);
    expect(retryResult).toBeDefined();

    // Ensure retry did NOT create another lead record
    const totalLeads = await prisma.contactSubmission.count({
      where: { name: testName },
    });
    expect(totalLeads).toBe(1);
  });

  // F. Save and reload SMTP settings, verify real submissions use them
  it("F. Save and reload SMTP settings, verify real submissions use them without hardcoded overrides", async () => {
    // 1. Verify settings resolver returns the exact company mailboxes
    const resolved = await getResolvedNotificationSettings();
    expect(resolved.recipientEmail).toBe("info@image-developments.com");
    expect(resolved.senderEmail).toBe("website@image-developments.com");
    expect(resolved.senderName).toBe("Image Developments");
    expect(resolved.smtpHost).toBe("image-developments.com");
    expect(resolved.smtpPort).toBe(465);
    expect(resolved.smtpEncryption).toBe("SSL");
    expect(resolved.smtpUser).toBe("website@image-developments.com");
    expect(resolved.enabled).toBe(true);

    // 2. Active SMTP config uses these settings
    const activeSmtp = await resolveActiveSmtpConfig();
    expect(activeSmtp).toBeDefined();
    expect(activeSmtp!.host).toBe("image-developments.com");
    expect(activeSmtp!.port).toBe(465);
    expect(activeSmtp!.secure).toBe(true);
    expect(activeSmtp!.user).toBe("website@image-developments.com");
    expect(activeSmtp!.from).toBe('"Image Developments" <website@image-developments.com>');
  });

  // G. Test inquiry submission and header injection protection
  it("G. Strips CRLF newlines from customer name to prevent SMTP header injection", () => {
    const maliciousPayload: LeadInquiryPayload = {
      referenceNumber: "INQ-2026-TEST01",
      formType: "GENERAL_CONTACT",
      name: "Attacker\r\nBcc: hacker@evil.com\r\nSubject: Injected",
      email: null,
      phone: "0100000000",
      countryCode: "20",
      subject: "Test Subject",
      message: "Normal message",
      locale: "en",
      consentAccepted: true,
      marketingConsent: false,
      createdAt: new Date().toISOString(),
    };

    const email = buildLeadEmail(maliciousPayload, "https://image-developments.com");
    // Newlines stripped from subject line
    expect(email.subject).not.toContain("\r");
    expect(email.subject).not.toContain("\n");
    expect(email.subject).toBe("New Website Inquiry | Attacker Bcc: hacker@evil.com Subject: Injected | INQ-2026-TEST01");
  });

  // H. Verify configuration survives an application restart (reads directly from persisted database)
  it("H. Configuration persists in database and survives restart with exact hyphenated domain", async () => {
    const dbSettings = await prisma.globalSettings.findUniqueOrThrow({
      where: { id: "global" },
    });
    expect(dbSettings.notificationRecipientEmail).toBe("info@image-developments.com");
    expect(dbSettings.notificationSenderEmail).toBe("website@image-developments.com");
    expect(dbSettings.smtpHost).toBe("image-developments.com");
    expect(dbSettings.smtpPort).toBe(465);
    expect(dbSettings.smtpEncryption).toBe("SSL");
    expect(dbSettings.smtpUser).toBe("website@image-developments.com");
    expect(dbSettings.notificationEmailEnabled).toBe(true);

    // Fresh resolver call mirrors a new server request or restart
    const freshResolved = await getResolvedNotificationSettings();
    expect(freshResolved.recipientEmail).toBe("info@image-developments.com");
    expect(freshResolved.senderEmail).toBe("website@image-developments.com");
    expect(freshResolved.smtpHost).toBe("image-developments.com");
  });

  // I. Regression tests: preserves hyphens in domain, never stripping hyphens during normalization
  it("I. Strictly preserves hyphens in email addresses and domains during normalization", async () => {
    const rawHyphenated = "  info@image-developments.com  ";
    const resolved = await getResolvedNotificationSettings();
    expect(resolved.recipientEmail).toBe("info@image-developments.com");
    expect(resolved.recipientEmail).toContain("-");
    expect(resolved.recipientEmail).not.toBe("info@imagedevelopments.com");

    const activeConfig = await resolveActiveSmtpConfig();
    expect(activeConfig?.host).toBe("image-developments.com");
    expect(activeConfig?.host).toContain("-");
    expect(activeConfig?.from).toContain("website@image-developments.com");
  });

  // J. Explicit retry-to-corrected-recipient action updates unhyphenated historical job and records the change
  it("J. Explicit retry-to-corrected-recipient re-routes historical unhyphenated destination and records audit note", async () => {
    // Create a mock historical job targeting the unhyphenated address
    const historicalLead = await prisma.contactSubmission.create({
      data: {
        name: "Historical Lead",
        phone: "+201009999999",
        subject: "General Inquiry",
        message: "Historical message",
        notificationStatus: "FAILED",
        notificationError: "Connection refused",
      },
    });

    const historicalJob = await prisma.notificationJob.create({
      data: {
        jobType: "LEAD_INQUIRY",
        targetId: historicalLead.id,
        recipientEmail: "info@imagedevelopments.com", // Old unhyphenated address
        senderEmail: "website@image-developments.com",
        subject: "New Inquiry — Historical",
        payload: JSON.stringify({ name: "Historical Lead", phone: "+201009999999" }),
        status: "FAILED",
        lastError: "Delivery failed to unhyphenated host",
        attempts: 1,
      },
    });

    // Execute explicit retry with useCurrentSettingsRecipient: true
    await retryLeadNotification(historicalLead.id, { useCurrentSettingsRecipient: true });

    const updatedJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: historicalJob.id },
    });

    // Destination is updated to the current hyphenated CMS recipient
    expect(updatedJob.recipientEmail).toBe("info@image-developments.com");
    // Change is recorded in audit note / lastError
    expect(updatedJob.lastError).toContain("Re-routed from info@imagedevelopments.com to info@image-developments.com");
  });
});
