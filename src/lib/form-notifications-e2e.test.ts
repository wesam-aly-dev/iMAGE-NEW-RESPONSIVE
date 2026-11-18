import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/session", () => ({
  requireAdmin: () => mockRequireAdmin(),
  getAdmin: vi.fn().mockResolvedValue({ id: "admin-qa-id", email: "admin@image.local" }),
  createSession: vi.fn(),
  destroySession: vi.fn(),
  invalidateAllUserSessions: vi.fn(),
}));

import { prisma } from "./prisma";
import { submitContact, submitCareerApplication } from "@/app/actions";
import {
  saveSettings,
  saveHomepage,
  updateLead,
  markLeadReadStatus,
  toggleLeadArchive,
  retryLeadNotificationAction,
  retryCareerNotificationAction,
  dispatchPendingNotificationsAction,
} from "@/app/admin/actions";
import {
  getResolvedNotificationSettings,
  dispatchNotificationJob,
  processPendingNotificationJobs,
  retryNotificationJob,
} from "./notifications/email-service";
import { getHomepageContent } from "./content";
import { buildLeadEmail, buildCareerEmail } from "./notifications/templates";

describe("Homepage About/Our Story Images & Form Notifications Suite", () => {
  const createdLeadIds: string[] = [];
  const createdAppIds: string[] = [];
  const createdJobIds: string[] = [];
  const createdCvPaths: string[] = [];

  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ id: "admin-qa-id", email: "admin@image.local" });
  });

  afterAll(async () => {
    // Clean up test data
    if (createdLeadIds.length > 0) {
      await prisma.contactSubmission.deleteMany({
        where: { id: { in: createdLeadIds } },
      });
    }
    if (createdAppIds.length > 0) {
      await prisma.careerApplication.deleteMany({
        where: { id: { in: createdAppIds } },
      });
    }
    if (createdJobIds.length > 0) {
      await prisma.notificationJob.deleteMany({
        where: { id: { in: createdJobIds } },
      });
    }
    for (const cvPath of createdCvPaths) {
      try {
        const fs = await import("fs/promises");
        await fs.unlink(cvPath);
      } catch {
        // ignore
      }
    }
    try {
      await prisma.globalSettings.update({
        where: { id: "global" },
        data: {
          notificationRecipientEmail: "awessam311@gmail.com",
          notificationEmailEnabled: true,
        },
      });
    } catch {
      // ignore
    }
  });

  describe("A. Homepage About / Our Story Image Slots Workflow", () => {
    let originalHomepageState: any = null;

    beforeAll(async () => {
      originalHomepageState = await prisma.homepage.findUnique({ where: { id: "homepage" } });
    });

    afterAll(async () => {
      if (originalHomepageState) {
        await prisma.homepage.update({
          where: { id: "homepage" },
          data: originalHomepageState,
        });
      }
    });

    it("persists all 4 distinct image slots with focal points and localized alt text", async () => {
      const homeBefore = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });

      const fd = new FormData();
      // Required homepage fields
      fd.set("heroEyebrowEn", homeBefore.heroEyebrowEn);
      fd.set("heroEyebrowAr", homeBefore.heroEyebrowAr);
      fd.set("heroTitleEn", homeBefore.heroTitleEn);
      fd.set("heroTitleAr", homeBefore.heroTitleAr);
      fd.set("heroNoteEn", homeBefore.heroNoteEn);
      fd.set("heroNoteAr", homeBefore.heroNoteAr);
      fd.set("heroMediaUrl", homeBefore.heroMediaUrl);
      fd.set("lifestyleTitleEn", "The most memorable spaces leave room for life to happen.");
      fd.set("lifestyleTitleAr", "أكثر الأماكن حضوراً هي التي تترك للحياة مساحتها.");
      fd.set("lifestyleEyebrowEn", "Beyond the building");
      fd.set("lifestyleEyebrowAr", "أبعد من المباني");
      fd.set("lifestyleEnabled", "on");
      fd.set("closingTitleEn", homeBefore.closingTitleEn);
      fd.set("closingTitleAr", homeBefore.closingTitleAr);
      fd.set("closingCtaEn", homeBefore.closingCtaEn);
      fd.set("closingCtaAr", homeBefore.closingCtaAr);
      fd.set("closingCtaUrl", homeBefore.closingCtaUrl);
      fd.set("sectionOrder", "projects, lifestyle, stats, journal, closing");

      // Colors
      const colorKeys = [
        "openingBackgroundRgb",
        "heroBackgroundRgb",
        "projectsBackgroundRgb",
        "aboutBackgroundRgb",
        "lifestyleBackgroundRgb",
        "statsBackgroundRgb",
        "journalBackgroundRgb",
        "closingBackgroundRgb",
        "footerBackgroundRgb",
      ];
      for (const k of colorKeys) {
        fd.set(k, (homeBefore as any)[k] || "255, 255, 255");
      }

      // Slot 1: Top Left
      fd.set("lifestyleTopLeftImageUrl", "/uploads/qa-top-left.jpg");
      fd.set("lifestyleTopLeftImageAltEn", "Architectural entrance facade");
      fd.set("lifestyleTopLeftImageAltAr", "واجهة المدخل المعماري");
      fd.set("lifestyleTopLeftFocalPoint", "top");
      fd.set("lifestyleTopLeftMobileImageUrl", "/uploads/qa-top-left-mobile.jpg");

      // Slot 2: Top Right
      fd.set("lifestyleTopRightImageUrl", "/uploads/qa-top-right.jpg");
      fd.set("lifestyleTopRightImageAltEn", "Lush landscaped gardens");
      fd.set("lifestyleTopRightImageAltAr", "حدائق طبيعية غناء");
      fd.set("lifestyleTopRightFocalPoint", "center");

      // Slot 3: Bottom Left
      fd.set("lifestyleBottomLeftImageUrl", "/uploads/qa-bottom-left.jpg");
      fd.set("lifestyleBottomLeftImageAltEn", "Double-height living pavilion");
      fd.set("lifestyleBottomLeftImageAltAr", "صالة معيشة بارتفاع مزدوج");
      fd.set("lifestyleBottomLeftFocalPoint", "bottom");

      // Slot 4: Bottom Right
      fd.set("lifestyleBottomRightImageUrl", "/uploads/qa-bottom-right.jpg");
      fd.set("lifestyleBottomRightImageAltEn", "Private terrace at dusk");
      fd.set("lifestyleBottomRightImageAltAr", "شرفة خاصة وقت الغروب");
      fd.set("lifestyleBottomRightFocalPoint", "right");

      const res = await saveHomepage({}, fd);
      expect(res.success).toBe("Homepage saved.");

      // Verify persistence in database
      const homeAfter = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
      expect(homeAfter.lifestyleTopLeftImageUrl).toBe("/uploads/qa-top-left.jpg");
      expect(homeAfter.lifestyleTopLeftFocalPoint).toBe("top");
      expect(homeAfter.lifestyleTopLeftMobileImageUrl).toBe("/uploads/qa-top-left-mobile.jpg");
      expect(homeAfter.lifestyleTopRightImageUrl).toBe("/uploads/qa-top-right.jpg");
      expect(homeAfter.lifestyleBottomLeftImageUrl).toBe("/uploads/qa-bottom-left.jpg");
      expect(homeAfter.lifestyleBottomRightImageUrl).toBe("/uploads/qa-bottom-right.jpg");

      // Verify public content loader for English (/en)
      const enContent = await getHomepageContent("en");
      expect(enContent.lifestyle.slots?.topLeft?.url).toBe("/uploads/qa-top-left.jpg");
      expect(enContent.lifestyle.slots?.topLeft?.alt).toBe("Architectural entrance facade");
      expect(enContent.lifestyle.slots?.topLeft?.focalPoint).toBe("top");
      expect(enContent.lifestyle.slots?.topLeft?.mobileUrl).toBe("/uploads/qa-top-left-mobile.jpg");

      expect(enContent.lifestyle.slots?.topRight?.url).toBe("/uploads/qa-top-right.jpg");
      expect(enContent.lifestyle.slots?.bottomLeft?.url).toBe("/uploads/qa-bottom-left.jpg");
      expect(enContent.lifestyle.slots?.bottomRight?.url).toBe("/uploads/qa-bottom-right.jpg");

      // Verify public content loader for Arabic (/ar)
      const arContent = await getHomepageContent("ar");
      expect(arContent.lifestyle.slots?.topLeft?.alt).toBe("واجهة المدخل المعماري");
      expect(arContent.lifestyle.slots?.topRight?.alt).toBe("حدائق طبيعية غناء");
      expect(arContent.lifestyle.slots?.bottomLeft?.alt).toBe("صالة معيشة بارتفاع مزدوج");
      expect(arContent.lifestyle.slots?.bottomRight?.alt).toBe("شرفة خاصة وقت الغروب");
    });

    it("distinguishes explicit removal from legacy unconfigured state and does not revert to old image", async () => {
      // Deliberately remove Slot 2 (Top Right) by setting to empty string ""
      const homeBefore = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });

      const fd = new FormData();
      fd.set("heroEyebrowEn", homeBefore.heroEyebrowEn);
      fd.set("heroEyebrowAr", homeBefore.heroEyebrowAr);
      fd.set("heroTitleEn", homeBefore.heroTitleEn);
      fd.set("heroTitleAr", homeBefore.heroTitleAr);
      fd.set("heroNoteEn", homeBefore.heroNoteEn);
      fd.set("heroNoteAr", homeBefore.heroNoteAr);
      fd.set("heroMediaUrl", homeBefore.heroMediaUrl);
      fd.set("lifestyleTitleEn", homeBefore.lifestyleTitleEn);
      fd.set("lifestyleTitleAr", homeBefore.lifestyleTitleAr);
      fd.set("lifestyleEyebrowEn", homeBefore.lifestyleEyebrowEn);
      fd.set("lifestyleEyebrowAr", homeBefore.lifestyleEyebrowAr);
      fd.set("lifestyleEnabled", "on");
      fd.set("closingTitleEn", homeBefore.closingTitleEn);
      fd.set("closingTitleAr", homeBefore.closingTitleAr);
      fd.set("closingCtaEn", homeBefore.closingCtaEn);
      fd.set("closingCtaAr", homeBefore.closingCtaAr);
      fd.set("closingCtaUrl", homeBefore.closingCtaUrl);
      fd.set("sectionOrder", "projects, lifestyle, stats, journal, closing");

      const colorKeys = [
        "openingBackgroundRgb",
        "heroBackgroundRgb",
        "projectsBackgroundRgb",
        "aboutBackgroundRgb",
        "lifestyleBackgroundRgb",
        "statsBackgroundRgb",
        "journalBackgroundRgb",
        "closingBackgroundRgb",
        "footerBackgroundRgb",
      ];
      for (const k of colorKeys) {
        fd.set(k, (homeBefore as any)[k] || "255, 255, 255");
      }

      // Slot 1 remains configured
      fd.set("lifestyleTopLeftImageUrl", "/uploads/qa-top-left.jpg");
      // Slot 2 explicitly removed
      fd.set("lifestyleTopRightImageUrl", "");
      // Slot 3 & 4 remain
      fd.set("lifestyleBottomLeftImageUrl", "/uploads/qa-bottom-left.jpg");
      fd.set("lifestyleBottomRightImageUrl", "/uploads/qa-bottom-right.jpg");

      await saveHomepage({}, fd);

      const content = await getHomepageContent("en");
      // Slot 2 must be null (omitted), NOT falling back to the old milestone or unsplash image!
      expect(content.lifestyle.slots?.topRight).toBeNull();
      // Slots 1, 3, and 4 must remain active
      expect(content.lifestyle.slots?.topLeft?.url).toBe("/uploads/qa-top-left.jpg");
      expect(content.lifestyle.slots?.bottomLeft?.url).toBe("/uploads/qa-bottom-left.jpg");
      expect(content.lifestyle.slots?.bottomRight?.url).toBe("/uploads/qa-bottom-right.jpg");
    });
  });

  describe("B. Notification Settings & Form Inquiries Workflow", () => {
    it("saves recipient A, verifies Arabic inquiry targets A, then changes to B and verifies English inquiry targets B", async () => {
      // 1. Configure recipient A
      const fdA = new FormData();
      fdA.set("siteNameEn", "Image Developments");
      fdA.set("siteNameAr", "إيمدج للتطوير العقاري");
      fdA.set("contactEmail", "info@imagedevelopments.com");
      fdA.set("phone", "+20 2 1234 5678");
      fdA.set("hotline", "17087");
      fdA.set("addressEn", "Cairo, Egypt");
      fdA.set("addressAr", "القاهرة، مصر");
      fdA.set("copyrightEn", "© 2026 Image Developments");
      fdA.set("copyrightAr", "© 2026 إيمدج للتطوير العقاري");
      fdA.set("defaultSeoTitleEn", "Image Developments");
      fdA.set("defaultSeoTitleAr", "إيمدج للتطوير العقاري");
      fdA.set("defaultSeoDescriptionEn", "Modern living spaces in Egypt");
      fdA.set("defaultSeoDescriptionAr", "مساحات معيشة عصرية في مصر");
      fdA.set("menuMediaUrl", "/images/menu.jpg");
      fdA.set("menuMediaAltEn", "Menu image");
      fdA.set("menuMediaAltAr", "صورة القائمة");

      fdA.set("notificationEmailEnabled", "on");
      fdA.set("notificationRecipientEmail", "recipient-a@imagedevelopments.com");
      fdA.set("careersRecipientEmail", "hr-careers@imagedevelopments.com");

      await saveSettings({}, fdA);

      const resolvedA = await getResolvedNotificationSettings();
      expect(resolvedA.recipientEmail).toBe("recipient-a@imagedevelopments.com");

      // 2. Submit Arabic inquiry
      const formAr = new FormData();
      formAr.set("name", "أحمد السعدني");
      formAr.set("email", "ahmed.saadany@example.com");
      formAr.set("phone", "1012345678");
      formAr.set("countryCode", "EG:+20");
      formAr.set("message", "أرغب في الاستفسار عن مواعيد تسليم الوحدات.");
      formAr.set("locale", "ar");
      formAr.set("website", "");
      formAr.set("consent", "on");
      formAr.set("enquiryType", "callback");

      const resAr = await submitContact({ status: "idle" }, formAr);
      expect(resAr.status).toBe("success");

      const leadAr = await prisma.contactSubmission.findFirst({
        where: { email: "ahmed.saadany@example.com" },
        orderBy: { createdAt: "desc" },
      });
      expect(leadAr).toBeDefined();
      createdLeadIds.push(leadAr!.id);

      const jobA = await prisma.notificationJob.findFirst({
        where: { targetId: leadAr!.id },
      });
      expect(jobA).toBeDefined();
      createdJobIds.push(jobA!.id);
      expect(jobA!.recipientEmail).toBe("recipient-a@imagedevelopments.com");

      // 3. Change recipient to B in Settings
      const fdB = new FormData();
      fdB.set("siteNameEn", "Image Developments");
      fdB.set("siteNameAr", "إيمدج للتطوير العقاري");
      fdB.set("contactEmail", "info@imagedevelopments.com");
      fdB.set("phone", "+20 2 1234 5678");
      fdB.set("hotline", "17087");
      fdB.set("addressEn", "Cairo, Egypt");
      fdB.set("addressAr", "القاهرة، مصر");
      fdB.set("copyrightEn", "© 2026 Image Developments");
      fdB.set("copyrightAr", "© 2026 إيمدج للتطوير العقاري");
      fdB.set("defaultSeoTitleEn", "Image Developments");
      fdB.set("defaultSeoTitleAr", "إيمدج للتطوير العقاري");
      fdB.set("defaultSeoDescriptionEn", "Modern living spaces in Egypt");
      fdB.set("defaultSeoDescriptionAr", "مساحات معيشة عصرية في مصر");
      fdB.set("menuMediaUrl", "/images/menu.jpg");
      fdB.set("menuMediaAltEn", "Menu image");
      fdB.set("menuMediaAltAr", "صورة القائمة");

      fdB.set("notificationEmailEnabled", "on");
      fdB.set("notificationRecipientEmail", "recipient-b@imagedevelopments.com");

      await saveSettings({}, fdB);

      const resolvedB = await getResolvedNotificationSettings();
      expect(resolvedB.recipientEmail).toBe("recipient-b@imagedevelopments.com");

      // 4. Submit English inquiry and verify it targets B
      const formEn = new FormData();
      formEn.set("name", "Sarah Jenkins");
      formEn.set("email", "sarah.j@example.com");
      formEn.set("phone", "1098765432");
      formEn.set("countryCode", "EG:+20");
      formEn.set("message", "Looking for 2-bedroom floor plan.");
      formEn.set("locale", "en");
      formEn.set("website", "");
      formEn.set("consent", "on");

      const resEn = await submitContact({ status: "idle" }, formEn);
      expect(resEn.status).toBe("success");

      const leadEn = await prisma.contactSubmission.findFirst({
        where: { email: "sarah.j@example.com" },
        orderBy: { createdAt: "desc" },
      });
      expect(leadEn).toBeDefined();
      createdLeadIds.push(leadEn!.id);

      const jobB = await prisma.notificationJob.findFirst({
        where: { targetId: leadEn!.id },
      });
      expect(jobB).toBeDefined();
      createdJobIds.push(jobB!.id);
      expect(jobB!.recipientEmail).toBe("recipient-b@imagedevelopments.com");
    });

    it("verifies professional email template structure, subject line, and dashboard link", () => {
      const email = buildLeadEmail({
        referenceNumber: "INQ-2026-99999",
        formType: "PROJECT_INQUIRY",
        name: "Youssef Nabil",
        email: "youssef@example.com",
        phone: "1005554444",
        countryCode: "EG:+20",
        subject: "Aera Inquiry",
        message: "Interested in the park-facing villas.",
        projectName: "Aera",
        unitType: "Villa Type B",
        sourcePage: "/projects/aera",
        locale: "en",
        consentAccepted: true,
        marketingConsent: false,
        createdAt: "2026-11-14T18:30:00.000Z",
      }, "https://imagedevelopments.com");

      expect(email.subject).toBe("New Inquiry — Aera — INQ-2026-99999");
      expect(email.text).toContain("Reference Number: INQ-2026-99999");
      expect(email.text).toContain("Full Name: Youssef Nabil");
      expect(email.text).toContain("Interested Project: Aera");
      expect(email.text).toContain("Unit Type: Villa Type B");
      expect(email.text).toContain("View Inquiry in CMS: https://imagedevelopments.com/admin/leads?id=INQ-2026-99999");

      // Verify HTML content
      expect(email.html).toContain("Image Developments");
      expect(email.html).toContain("New Website Inquiry");
      expect(email.html).toContain("INQ-2026-99999");
      expect(email.html).toContain("https://imagedevelopments.com/admin/leads?id=INQ-2026-99999");
      expect(email.html).toContain("Automated notification from Image Developments.");
    });

    it("handles inquiry submission when optional email is omitted and preserves entered data", async () => {
      const formData = new FormData();
      formData.set("name", "Khaled Mansour");
      formData.set("phone", "1023456789");
      formData.set("countryCode", "EG:+20");
      formData.set("enquiryType", "callback");
      formData.set("locale", "en");
      formData.set("website", "");
      formData.set("consent", "on");

      const res = await submitContact({ status: "idle" }, formData);
      expect(res.status).toBe("success");

      const lead = await prisma.contactSubmission.findFirst({
        where: { name: "Khaled Mansour" },
        orderBy: { createdAt: "desc" },
      });
      expect(lead).toBeDefined();
      createdLeadIds.push(lead!.id);
      expect(lead!.email).toBe("");
      expect(lead!.phone).toContain("1023456789");
    });

    it("verifies duplicate-submit prevention (idempotency)", async () => {
      const idempKey = `test-idemp-${Date.now()}`;
      const build = () => {
        const fd = new FormData();
        fd.set("name", "Duplicate Tester");
        fd.set("phone", "1099887766");
        fd.set("countryCode", "EG:+20");
        fd.set("locale", "en");
        fd.set("website", "");
        fd.set("consent", "on");
        fd.set("idempotencyKey", idempKey);
        return fd;
      };

      const res1 = await submitContact({ status: "idle" }, build());
      expect(res1.status).toBe("success");

      const res2 = await submitContact({ status: "idle" }, build());
      expect(res2.status).toBe("success");
      expect(res2.message).toContain("already received");

      const count = await prisma.contactSubmission.count({
        where: { idempotencyKey: idempKey },
      });
      expect(count).toBe(1);

      const lead = await prisma.contactSubmission.findUnique({
        where: { idempotencyKey: idempKey },
      });
      if (lead) createdLeadIds.push(lead.id);
    });

    it("blocks unauthorized users from calling administrative lead and settings actions", async () => {
      // Mock requireAdmin throwing unauthorized error
      mockRequireAdmin.mockImplementation(() => {
        throw new Error("Unauthorized");
      });

      await expect(
        updateLead(new FormData())
      ).rejects.toThrow("Unauthorized");

      await expect(
        markLeadReadStatus("any-id", true)
      ).rejects.toThrow("Unauthorized");

      await expect(
        toggleLeadArchive("any-id", true)
      ).rejects.toThrow("Unauthorized");

      await expect(
        retryLeadNotificationAction("any-id")
      ).rejects.toThrow("Unauthorized");

      await expect(
        saveSettings({}, new FormData())
      ).rejects.toThrow("Unauthorized");

      await expect(
        saveHomepage({}, new FormData())
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("C. Form-by-Form Comprehensive Submissions & Outbox Integration", () => {
    it("1. Homepage Callback Form (Arabic): persists in DB, generates INQ reference, and creates BLOCKED notification job", async () => {
      const fd = new FormData();
      fd.set("name", "طارق المحمودي");
      fd.set("phone", "1011223344");
      fd.set("countryCode", "EG:+20");
      fd.set("locale", "ar");
      fd.set("enquiryType", "callback");
      fd.set("sourcePage", "/");
      fd.set("sourceCta", "hero-callback");
      fd.set("consent", "on");

      const res = await submitContact({ status: "idle" }, fd);
      expect(res.status).toBe("success");
      expect(res.message).toMatch(/INQ-2026-\d+/);

      const lead = await prisma.contactSubmission.findFirst({
        where: { name: "طارق المحمودي" },
        orderBy: { createdAt: "desc" },
      });
      expect(lead).toBeDefined();
      createdLeadIds.push(lead!.id);

      expect(lead!.formType).toBe("CALLBACK");
      expect(lead!.sourcePage).toBe("/");
      expect(lead!.sourceCta).toBe("hero-callback");
      expect(lead!.locale).toBe("ar");
      expect(lead!.notificationStatus).toBe("BLOCKED");
      expect(lead!.notificationError).toContain("SMTP credentials not configured in environment");

      const job = await prisma.notificationJob.findFirst({
        where: { targetId: lead!.id },
      });
      expect(job).toBeDefined();
      createdJobIds.push(job!.id);
      expect(job!.jobType).toBe("LEAD_INQUIRY");
      expect(job!.status).toBe("BLOCKED");
      expect(job!.lastError).toContain("SMTP credentials not configured in environment");
    });

    it("2. Header Callback Popup (English): verifies distinct source CTA and DB storage", async () => {
      const fd = new FormData();
      fd.set("name", "David Mitchell");
      fd.set("phone", "1022334455");
      fd.set("countryCode", "EG:+20");
      fd.set("locale", "en");
      fd.set("enquiryType", "callback");
      fd.set("sourcePage", "/about");
      fd.set("sourceCta", "header-callback");
      fd.set("consent", "on");

      const res = await submitContact({ status: "idle" }, fd);
      expect(res.status).toBe("success");

      const lead = await prisma.contactSubmission.findFirst({
        where: { name: "David Mitchell" },
        orderBy: { createdAt: "desc" },
      });
      expect(lead).toBeDefined();
      createdLeadIds.push(lead!.id);

      expect(lead!.formType).toBe("CALLBACK");
      expect(lead!.sourcePage).toBe("/about");
      expect(lead!.sourceCta).toBe("header-callback");
    });

    it("3. Project Register Interest Form: verifies project linkage by slug and REGISTER_INTEREST classification", async () => {
      const fd = new FormData();
      fd.set("name", "Hany Rashed");
      fd.set("email", "hany.rashed@example.com");
      fd.set("phone", "1033445566");
      fd.set("countryCode", "EG:+20");
      fd.set("locale", "en");
      fd.set("projectId", "aera");
      fd.set("enquiryType", "register_interest");
      fd.set("sourcePage", "/projects/aera");
      fd.set("sourceCta", "register-interest-modal");
      fd.set("consent", "on");

      const res = await submitContact({ status: "idle" }, fd);
      expect(res.status).toBe("success");

      const lead = await prisma.contactSubmission.findFirst({
        where: { email: "hany.rashed@example.com" },
        orderBy: { createdAt: "desc" },
      });
      expect(lead).toBeDefined();
      createdLeadIds.push(lead!.id);

      expect(lead!.formType).toBe("REGISTER_INTEREST");
      expect(lead!.projectName).toBe("Aera");
      expect(lead!.sourcePage).toBe("/projects/aera");

      const job = await prisma.notificationJob.findFirst({
        where: { targetId: lead!.id },
      });
      expect(job).toBeDefined();
      createdJobIds.push(job!.id);
    });

    it("4. Unit Inquiry Form: captures specific unitType and links to project", async () => {
      const fd = new FormData();
      fd.set("name", "منى زكي");
      fd.set("phone", "1044556677");
      fd.set("countryCode", "EG:+20");
      fd.set("locale", "ar");
      fd.set("projectId", "aera");
      fd.set("enquiryType", "unit");
      fd.set("unitType", "3-Bedroom Duplex Penthouse");
      fd.set("sourcePage", "/projects/aera");
      fd.set("consent", "on");

      const res = await submitContact({ status: "idle" }, fd);
      expect(res.status).toBe("success");

      const lead = await prisma.contactSubmission.findFirst({
        where: { name: "منى زكي" },
        orderBy: { createdAt: "desc" },
      });
      expect(lead).toBeDefined();
      createdLeadIds.push(lead!.id);

      expect(lead!.formType).toBe("UNIT_INQUIRY");
      expect(lead!.unitType).toBe("3-Bedroom Duplex Penthouse");
      expect(lead!.projectName).toBe("إيرا");
      expect(lead!.locale).toBe("ar");
    });

    it("5. Career Application: persists application, safely stores CV in private storage, and creates linked lead in CMS Inbox", async () => {
      const fd = new FormData();
      fd.set("fullName", "Nour El-Sherif");
      fd.set("email", "nour.architect@example.com");
      fd.set("phone", "+20 100 888 7766");
      fd.set("jobTitle", "Senior Project Architect");
      fd.set("locale", "en");
      fd.set("notes", "10+ years experience in luxury residential towers.");
      const fakeCv = new File(["%PDF-1.4 Mock CV Content"], "nour-cv.pdf", { type: "application/pdf" });
      fd.set("cv", fakeCv);

      const res = await submitCareerApplication({ status: "idle" }, fd);
      expect(res.status).toBe("success");
      expect(res.message).toMatch(/APP-2026-\d+/);

      const app = await prisma.careerApplication.findFirst({
        where: { email: "nour.architect@example.com" },
        orderBy: { createdAt: "desc" },
      });
      expect(app).toBeDefined();
      createdAppIds.push(app!.id);
      if (app!.cvUrl) createdCvPaths.push(app!.cvUrl);

      expect(app!.fullName).toBe("Nour El-Sherif");
      expect(app!.jobTitle).toBe("Senior Project Architect");
      expect(app!.cvFilename).toBe("nour-cv.pdf");
      expect(app!.cvUrl).toContain("private-storage/cvs");

      // Verify linked ContactSubmission exists in Leads Inbox
      const linkedLead = await prisma.contactSubmission.findFirst({
        where: { referenceNumber: app!.referenceNumber },
      });
      expect(linkedLead).toBeDefined();
      createdLeadIds.push(linkedLead!.id);

      expect(linkedLead!.formType).toBe("CAREER_APPLICATION");
      expect(linkedLead!.sourcePage).toBe("/careers");
      expect(linkedLead!.notes).toContain(app!.id);

      // Verify Notification Job targets careers recipient
      const job = await prisma.notificationJob.findFirst({
        where: { targetId: app!.id },
      });
      expect(job).toBeDefined();
      createdJobIds.push(job!.id);
      expect(job!.jobType).toBe("CAREER_APPLICATION");
    });
  });

  describe("D. Provider Failure Simulation, Outbox Dispatcher, and Admin Retries", () => {
    it("retries a blocked/failed lead notification via admin action and increments attempt count", async () => {
      // Create a test lead with blocked status
      const lead = await prisma.contactSubmission.create({
        data: {
          referenceNumber: "INQ-2026-RETRY1",
          name: "Retry Test Lead",
          email: "retry@example.com",
          phone: "+20 1000000001",
          countryCode: "EG:+20",
          subject: "Test Retry Inquiry",
          message: "Retry test message",
          formType: "GENERAL_CONTACT",
          status: "NEW",
          locale: "en",
          notificationStatus: "BLOCKED",
          notificationAttempts: 1,
        },
      });
      createdLeadIds.push(lead.id);

      const job = await prisma.notificationJob.create({
        data: {
          jobType: "LEAD_INQUIRY",
          targetId: lead.id,
          recipientEmail: "leads@imagedevelopments.com",
          senderEmail: "notifications@imagedevelopments.com",
          subject: "Test Retry",
          payload: JSON.stringify({
            referenceNumber: lead.referenceNumber,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
          }),
          status: "BLOCKED",
          attempts: 1,
        },
      });
      createdJobIds.push(job.id);

      // Execute retry action
      const retryRes = await retryLeadNotificationAction(lead.id);
      expect(retryRes.success || retryRes.error).toBeDefined();

      const updatedLead = await prisma.contactSubmission.findUnique({
        where: { id: lead.id },
      });
      expect(updatedLead!.notificationAttempts).toBeGreaterThanOrEqual(2);
    });

    it("retries a blocked/failed career application notification via admin action", async () => {
      const app = await prisma.careerApplication.create({
        data: {
          referenceNumber: "APP-2026-RETRY1",
          fullName: "Career Retry Test",
          email: "career.retry@example.com",
          phone: "+20 1000000002",
          jobTitle: "Design Director",
          cvUrl: "private-storage/cvs/test.pdf",
          cvFilename: "test.pdf",
          status: "NEW",
          notificationStatus: "BLOCKED",
          notificationAttempts: 1,
        },
      });
      createdAppIds.push(app.id);

      const job = await prisma.notificationJob.create({
        data: {
          jobType: "CAREER_APPLICATION",
          targetId: app.id,
          recipientEmail: "hr@imagedevelopments.com",
          senderEmail: "notifications@imagedevelopments.com",
          subject: "Career Retry Test",
          payload: JSON.stringify({
            referenceNumber: app.referenceNumber,
            fullName: app.fullName,
            email: app.email,
            phone: app.phone,
            jobTitle: app.jobTitle,
          }),
          status: "BLOCKED",
          attempts: 1,
        },
      });
      createdJobIds.push(job.id);

      const retryRes = await retryCareerNotificationAction(app.id);
      expect(retryRes.success || retryRes.error).toBeDefined();

      const updatedApp = await prisma.careerApplication.findUnique({
        where: { id: app.id },
      });
      expect(updatedApp!.notificationAttempts).toBeGreaterThanOrEqual(2);
    });

    it("dispatches pending outbox queue safely using processPendingNotificationJobs", async () => {
      const outboxRes = await processPendingNotificationJobs(5);
      expect(outboxRes).toBeDefined();
      expect(typeof outboxRes.processed).toBe("number");
      expect(typeof outboxRes.succeeded).toBe("number");
      expect(typeof outboxRes.failed).toBe("number");
      expect(typeof outboxRes.blocked).toBe("number");

      const actionRes = await dispatchPendingNotificationsAction();
      expect(actionRes.success?.toLowerCase()).toContain("processed");
    });
  });

  describe("E. Responsive Email Templates: Arabic RTL, English LTR, and Security Sanitization", () => {
    it("renders Arabic RTL lead email template with proper direction and localized labels", () => {
      const email = buildLeadEmail(
        {
          referenceNumber: "INQ-2026-AR001",
          formType: "UNIT_INQUIRY",
          name: "كريم عبد العزيز",
          email: "karim@example.com",
          phone: "1011112222",
          countryCode: "+20",
          subject: "استفسار عن وحدة في مشروع إيرا",
          message: "هل الدوبلكس متاح في المرحلة الأولى؟",
          projectName: "إيرا",
          unitType: "دوبلكس جاردن",
          sourcePage: "/ar/projects/aera",
          locale: "ar",
          consentAccepted: true,
          marketingConsent: true,
          createdAt: "2026-11-15T10:00:00.000Z",
        },
        "https://imagedevelopments.com"
      );

      expect(email.subject).toContain("INQ-2026-AR001");
      expect(email.subject).toContain("إيرا");
      expect(email.html).toContain('dir="rtl"');
      expect(email.html).toContain('lang="ar"');
      expect(email.html).toContain("إشعار استفسار جديد");
      expect(email.html).toContain("الرقم المرجعي");
      expect(email.html).toContain("المشروع المطلوب");
      expect(email.html).toContain("نوع الوحدة");
      expect(email.html).toContain("دوبلكس جاردن");
      expect(email.html).toContain("Cairo Time");
      expect(email.html).toContain("عرض الاستفسار في لوحة التحكم");

      expect(email.text).toContain("الرقم المرجعي: INQ-2026-AR001");
      expect(email.text).toContain("الاسم بالكامل: كريم عبد العزيز");
      expect(email.text).toContain("المشروع المطلوب: إيرا");
      expect(email.text).toContain("نوع الوحدة: دوبلكس جاردن");
    });

    it("renders English LTR lead email template and escapes malicious HTML tags", () => {
      const maliciousInput = {
        referenceNumber: "INQ-2026-SEC01",
        formType: "GENERAL_CONTACT" as const,
        name: "<script>alert('xss')</script> John",
        email: "john@example.com",
        phone: "1022223333",
        countryCode: "+20",
        subject: "Security Test <img src=x onerror=alert(1)>",
        message: "Hello <b>world</b> <iframe src='evil.com'></iframe>",
        projectName: "Aera",
        sourcePage: "/contact",
        locale: "en",
        consentAccepted: true,
        marketingConsent: false,
        createdAt: "2026-11-15T11:00:00.000Z",
      };

      const email = buildLeadEmail(maliciousInput, "https://imagedevelopments.com");

      expect(email.html).toContain('dir="ltr"');
      expect(email.html).toContain('lang="en"');
      expect(email.html).not.toContain("<script>alert('xss')</script>");
      expect(email.html).toContain("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
      expect(email.html).not.toContain("<iframe src='evil.com'>");
      expect(email.html).toContain("&lt;iframe src=&#039;evil.com&#039;&gt;&lt;/iframe&gt;");

      expect(email.text).toContain("John");
      expect(email.text).toContain("https://imagedevelopments.com/admin/leads?id=INQ-2026-SEC01");
    });

    it("renders Career Application email template with link to careers portal and no raw CV exposure", () => {
      const email = buildCareerEmail(
        {
          referenceNumber: "APP-2026-CAR01",
          jobTitle: "Lead Interior Designer",
          fullName: "Laila El-Kady",
          email: "laila@example.com",
          phone: "+20 100 555 6677",
          cvUrl: "/Users/secret/private-storage/cvs/random-uuid.pdf",
          cvFilename: "laila-portfolio.pdf",
          notes: "Award-winning designer with 8 years in hospitality.",
          createdAt: "2026-11-15T12:00:00.000Z",
        },
        "https://imagedevelopments.com"
      );

      expect(email.subject).toBe("New Application — Lead Interior Designer — APP-2026-CAR01");
      expect(email.html).toContain("Lead Interior Designer");
      expect(email.html).toContain("Laila El-Kady");
      expect(email.html).toContain("laila-portfolio.pdf");
      expect(email.html).toContain("https://imagedevelopments.com/admin/careers");
      // Must not expose local server filesystem path
      expect(email.html).not.toContain("/Users/secret/private-storage/cvs/");

      expect(email.text).toContain("Candidate Name: Laila El-Kady");
      expect(email.text).toContain("Position: Lead Interior Designer");
      expect(email.text).toContain("https://imagedevelopments.com/admin/careers");
    });
  });

  describe("F. Career Application Validation & Duplicate Prevention", () => {
    it("validates required fields and CV file constraints on career application", async () => {
      // 1. Missing name & email
      const fd1 = new FormData();
      fd1.set("jobTitle", "Project Manager");
      const res1 = await submitCareerApplication({ status: "idle" }, fd1);
      expect(res1.status).toBe("error");
      expect(res1.fields?.fullName).toBeDefined();
      expect(res1.fields?.email).toBeDefined();

      // 2. Disallowed CV file extension (.exe)
      const fd2 = new FormData();
      fd2.set("fullName", "Hacker Joe");
      fd2.set("email", "joe@example.com");
      fd2.set("phone", "+20 100 000 0000");
      fd2.set("jobTitle", "IT Security");
      const fakeExe = new File(["malicious"], "payload.exe", { type: "application/x-msdownload" });
      fd2.set("cv", fakeExe);

      const res2 = await submitCareerApplication({ status: "idle" }, fd2);
      expect(res2.status).toBe("error");
      expect(res2.fields?.cv).toMatch(/PDF.*Word|Word.*PDF/i);

      // 3. File size limit (> 5MB)
      const fd3 = new FormData();
      fd3.set("fullName", "Heavy Uploader");
      fd3.set("email", "heavy@example.com");
      fd3.set("phone", "+20 100 000 0000");
      fd3.set("jobTitle", "BIM Specialist");
      const bigBlob = new Uint8Array(6 * 1024 * 1024);
      const fakeBigFile = new File([bigBlob], "big-portfolio.pdf", { type: "application/pdf" });
      fd3.set("cv", fakeBigFile);

      const res3 = await submitCareerApplication({ status: "idle" }, fd3);
      expect(res3.status).toBe("error");
      expect(res3.fields?.cv).toContain("5");
    });

    it("verifies idempotency key prevents duplicate career application records and duplicate notification jobs", async () => {
      const idempKey = `career-idemp-${Date.now()}`;
      const build = () => {
        const fd = new FormData();
        fd.set("fullName", "Yasmine Fares");
        fd.set("email", "yasmine@example.com");
        fd.set("phone", "+20 100 444 3322");
        fd.set("jobTitle", "Landscape Architect");
        fd.set("locale", "en");
        fd.set("idempotencyKey", idempKey);
        const cv = new File(["Mock CV content"], "yasmine-cv.pdf", { type: "application/pdf" });
        fd.set("cv", cv);
        return fd;
      };

      const res1 = await submitCareerApplication({ status: "idle" }, build());
      expect(res1.status).toBe("success");

      const res2 = await submitCareerApplication({ status: "idle" }, build());
      expect(res2.status).toBe("success");
      expect(res2.message).toContain("already received");

      const count = await prisma.careerApplication.count({
        where: { idempotencyKey: idempKey },
      });
      expect(count).toBe(1);

      const app = await prisma.careerApplication.findUnique({
        where: { idempotencyKey: idempKey },
      });
      if (app) {
        createdAppIds.push(app.id);
        if (app.cvUrl) createdCvPaths.push(app.cvUrl);
      }
    });
  });
});
