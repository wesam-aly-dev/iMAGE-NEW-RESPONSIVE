import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

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
} from "@/app/admin/actions";
import {
  getResolvedNotificationSettings,
  dispatchNotificationJob,
} from "./notifications/email-service";
import { getHomepageContent } from "./content";
import { buildLeadEmail, buildCareerEmail } from "./notifications/templates";

describe("Homepage About/Our Story Images & Form Notifications Suite", () => {
  const createdLeadIds: string[] = [];
  const createdAppIds: string[] = [];
  const createdJobIds: string[] = [];

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
  });

  describe("A. Homepage About / Our Story Image Slots Workflow", () => {
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
});
