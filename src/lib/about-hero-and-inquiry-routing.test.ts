import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}));

// Mock admin session
vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin" }),
  getAdminSession: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin" }),
}));

import { prisma } from "@/lib/prisma";
import { saveAbout, saveSettings } from "@/app/admin/actions";
import { submitContact } from "@/app/actions";
import { getAboutPageContent } from "@/lib/content";
import { getResolvedNotificationSettings, resolveActiveSmtpConfig } from "@/lib/notifications/email-service";

describe("About Page Hero CMS Editor & Inquiries Email Routing Suite", { timeout: 30000 }, () => {
  beforeEach(async () => {
    // Ensure database records exist for global and homepage
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
        menuMediaUrl: "/uploads/menu.jpg",
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

  /* =========================================================================
     PART 1: ABOUT PAGE HERO CMS EDITOR & PERSISTENCE
     ========================================================================= */

  it("1.1 Saves About Hero with independent mobile override and custom focal points", async () => {
    const fd = new FormData();
    fd.set("aboutHeroEnabled", "on");
    fd.set("aboutHeroEyebrowEn", "Heritage & Innovation");
    fd.set("aboutHeroEyebrowAr", "الأصالة والابتكار");
    fd.set("aboutHeroTitleEn", "Crafting Architectural Icons in Egypt");
    fd.set("aboutHeroTitleAr", "صياغة معالم معمارية رائدة في مصر");
    fd.set("aboutHeroBodyEn", "Over 20 years of creating communities that inspire modern life.");
    fd.set("aboutHeroBodyAr", "أكثر من عشرين عاماً من ابتكار مجتمعات ترتقي بأسلوب الحياة العصري.");
    fd.set("aboutHeroImageUrl", "/uploads/about-hero-desktop.jpg");
    fd.set("aboutHeroMobileImageUrl", "/uploads/about-hero-mobile.jpg");
    fd.set("aboutHeroFocalPoint", "top");
    fd.set("aboutHeroMobileFocalPoint", "bottom");
    fd.set("aboutHeroImageAltEn", "Image Developments flagship masterplan");
    fd.set("aboutHeroImageAltAr", "المخطط العام الرائد لشركة إيمدج");
    fd.set("aboutHeroCtaLabelEn", "Discover Our Vision");
    fd.set("aboutHeroCtaLabelAr", "اكتشف رؤيتنا");
    fd.set("aboutHeroCtaUrl", "#journey");

    // Required fields for existing timeline and sections
    fd.set("aboutEyebrowEn", "Our Journey");
    fd.set("aboutEyebrowAr", "مسيرتنا");
    fd.set("aboutTitleEn", "Two Decades of Excellence");
    fd.set("aboutTitleAr", "عقدان من التميز");
    fd.set("aboutIntroEn", "Tracing our milestones since inception.");
    fd.set("aboutIntroAr", "محطات مسيرتنا منذ البداية.");

    const res = await saveAbout({}, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("About page saved.");

    // Direct database verification
    const dbRecord = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(dbRecord.aboutHeroEnabled).toBe(true);
    expect(dbRecord.aboutHeroEyebrowEn).toBe("Heritage & Innovation");
    expect(dbRecord.aboutHeroTitleEn).toBe("Crafting Architectural Icons in Egypt");
    expect(dbRecord.aboutHeroImageUrl).toBe("/uploads/about-hero-desktop.jpg");
    expect(dbRecord.aboutHeroMobileImageUrl).toBe("/uploads/about-hero-mobile.jpg");
    expect(dbRecord.aboutHeroFocalPoint).toBe("top");
    expect(dbRecord.aboutHeroMobileFocalPoint).toBe("bottom");
    expect(dbRecord.aboutHeroCtaLabelEn).toBe("Discover Our Vision");
    expect(dbRecord.aboutHeroCtaUrl).toBe("#journey");

    // Public content loader verification
    const enContent = await getAboutPageContent("en");
    expect(enContent.aboutPage.hero.enabled).toBe(true);
    expect(enContent.aboutPage.hero.eyebrow).toBe("Heritage & Innovation");
    expect(enContent.aboutPage.hero.title).toBe("Crafting Architectural Icons in Egypt");
    expect(enContent.aboutPage.hero.image).toBe("/uploads/about-hero-desktop.jpg");
    expect(enContent.aboutPage.hero.mobileImage).toBe("/uploads/about-hero-mobile.jpg");
    expect(enContent.aboutPage.hero.focalPoint).toBe("top");
    expect(enContent.aboutPage.hero.mobileFocalPoint).toBe("bottom");
    expect(enContent.aboutPage.hero.ctaLabel).toBe("Discover Our Vision");
    expect(enContent.aboutPage.hero.ctaUrl).toBe("#journey");
    expect(enContent.aboutPage.hero.alt).toBe("Image Developments flagship masterplan");

    const arContent = await getAboutPageContent("ar");
    expect(arContent.aboutPage.hero.eyebrow).toBe("الأصالة والابتكار");
    expect(arContent.aboutPage.hero.title).toBe("صياغة معالم معمارية رائدة في مصر");
    expect(arContent.aboutPage.hero.ctaLabel).toBe("اكتشف رؤيتنا");
    expect(arContent.aboutPage.hero.alt).toBe("المخطط العام الرائد لشركة إيمدج");
  });

  it("1.2 Removing mobile override restores desktop fallback without deleting desktop image", async () => {
    // First, save with both desktop and mobile
    const fd1 = new FormData();
    fd1.set("aboutHeroEnabled", "on");
    fd1.set("aboutHeroEyebrowEn", "About Us");
    fd1.set("aboutHeroEyebrowAr", "من نحن");
    fd1.set("aboutHeroTitleEn", "Enduring Architecture");
    fd1.set("aboutHeroTitleAr", "عمارة مستدامة");
    fd1.set("aboutHeroBodyEn", "Built for generations to come.");
    fd1.set("aboutHeroBodyAr", "صممت للأجيال القادمة.");
    fd1.set("aboutHeroImageUrl", "/uploads/desktop-master.jpg");
    fd1.set("aboutHeroMobileImageUrl", "/uploads/mobile-crop.jpg");
    fd1.set("aboutHeroFocalPoint", "center");
    fd1.set("aboutHeroMobileFocalPoint", "top");
    fd1.set("aboutHeroImageAltEn", "Architecture");
    fd1.set("aboutHeroImageAltAr", "عمارة");
    fd1.set("aboutHeroCtaLabelEn", "Explore Our Journey");
    fd1.set("aboutHeroCtaLabelAr", "اكتشف رحلتنا");
    fd1.set("aboutHeroCtaUrl", "#about");
    fd1.set("aboutEyebrowEn", "Milestones");
    fd1.set("aboutEyebrowAr", "المحطات");
    fd1.set("aboutTitleEn", "Our Journey");
    fd1.set("aboutTitleAr", "مسيرتنا");
    fd1.set("aboutIntroEn", "Introduction.");
    fd1.set("aboutIntroAr", "مقدمة.");

    await saveAbout({}, fd1);

    // Now operator removes the mobile override (submitting empty string)
    const fd2 = new FormData();
    fd2.set("aboutHeroEnabled", "on");
    fd2.set("aboutHeroEyebrowEn", "About Us");
    fd2.set("aboutHeroEyebrowAr", "من نحن");
    fd2.set("aboutHeroTitleEn", "Enduring Architecture");
    fd2.set("aboutHeroTitleAr", "عمارة مستدامة");
    fd2.set("aboutHeroBodyEn", "Built for generations to come.");
    fd2.set("aboutHeroBodyAr", "صممت للأجيال القادمة.");
    fd2.set("aboutHeroImageUrl", "/uploads/desktop-master.jpg");
    fd2.set("aboutHeroMobileImageUrl", ""); // Cleared by user
    fd2.set("aboutHeroFocalPoint", "center");
    fd2.set("aboutHeroMobileFocalPoint", "center");
    fd2.set("aboutHeroImageAltEn", "Architecture");
    fd2.set("aboutHeroImageAltAr", "عمارة");
    fd2.set("aboutHeroCtaLabelEn", "Explore Our Journey");
    fd2.set("aboutHeroCtaLabelAr", "اكتشف رحلتنا");
    fd2.set("aboutHeroCtaUrl", "#about");
    fd2.set("aboutEyebrowEn", "Milestones");
    fd2.set("aboutEyebrowAr", "المحطات");
    fd2.set("aboutTitleEn", "Our Journey");
    fd2.set("aboutTitleAr", "مسيرتنا");
    fd2.set("aboutIntroEn", "Introduction.");
    fd2.set("aboutIntroAr", "مقدمة.");

    const res2 = await saveAbout({}, fd2);
    expect(res2.error).toBeUndefined();

    // Verify DB state
    const dbRecord = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(dbRecord.aboutHeroImageUrl).toBe("/uploads/desktop-master.jpg");
    expect(dbRecord.aboutHeroMobileImageUrl).toBeNull();

    // Verify content loader fallback: mobileImage is undefined, desktop image is intact
    const content = await getAboutPageContent("en");
    expect(content.aboutPage.hero.image).toBe("/uploads/desktop-master.jpg");
    expect(content.aboutPage.hero.mobileImage).toBeUndefined();
    expect(content.aboutPage.hero.focalPoint).toBe("center");
  });

  /* =========================================================================
     PART 2: WEBSITE INQUIRY WORKFLOW & EMAIL ROUTING
     ========================================================================= */

  it("2.1 Resolves effective notification settings: website mailbox to info mailbox over port 465 SSL", async () => {
    const settings = await getResolvedNotificationSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.recipientEmail).toBe("info@image-developments.com");
    expect(settings.senderEmail).toBe("website@image-developments.com");
    expect(settings.senderName).toBe("Image Developments");
    expect(settings.smtpSource).toBe("CMS");
    expect(settings.smtpHost).toBe("image-developments.com");
    expect(settings.smtpPort).toBe(465);
    expect(settings.smtpEncryption).toBe("SSL");
    expect(settings.smtpUser).toBe("website@image-developments.com");

    const smtpConfig = await resolveActiveSmtpConfig();
    expect(smtpConfig).not.toBeNull();
    expect(smtpConfig?.host).toBe("image-developments.com");
    expect(smtpConfig?.port).toBe(465);
    expect(smtpConfig?.secure).toBe(true);
    expect(smtpConfig?.user).toBe("website@image-developments.com");
    expect(smtpConfig?.from).toBe('"Image Developments" <website@image-developments.com>');
  });

  it("2.2 Customer inquiry with optional email omitted: succeeds, saves lead, routes website -> info", async () => {
    const uniquePhone = `010${Date.now().toString().slice(-8)}`;
    const uniqueName = `Customer NoEmail ${Date.now()}`;
    const fd = new FormData();
    fd.set("name", uniqueName);
    fd.set("phone", uniquePhone);
    fd.set("countryCode", "EG:+20");
    fd.set("email", ""); // Blank email
    fd.set("message", "Interested in compound villas.");
    fd.set("consent", "on");
    fd.set("locale", "en");

    const res = await submitContact({ status: "idle" }, fd);
    expect(res.status).toBe("success");
    expect(res.message).toMatch(/Reference:|Ref:/);

    // Verify lead stored in DB with email = null
    const lead = await prisma.contactSubmission.findFirst({
      where: { name: uniqueName },
      orderBy: { createdAt: "desc" },
    });
    expect(lead).not.toBeNull();
    expect(lead?.email).toBeNull();
    expect(lead?.phone).toBe(`+20 ${uniquePhone}`);

    // Verify notification job created
    const job = await prisma.notificationJob.findFirst({
      where: { targetId: lead!.id },
      orderBy: { createdAt: "desc" },
    });
    expect(job).not.toBeNull();
    expect(job?.recipientEmail).toBe("info@image-developments.com");
    expect(job?.senderEmail).toBe("website@image-developments.com");
    expect(job?.jobType).toBe("LEAD_INQUIRY");

    const payload = JSON.parse(job!.payload);
    expect(payload.email).toBeNull();
    expect(payload.name).toBe(uniqueName);
  });

  it("2.3 Customer inquiry with email provided: email is validated and set strictly as Reply-To", async () => {
    const uniquePhone = `012${Date.now().toString().slice(-8)}`;
    const uniqueName = `Customer WithEmail ${Date.now()}`;
    const fd = new FormData();
    fd.set("name", uniqueName);
    fd.set("phone", uniquePhone);
    fd.set("countryCode", "EG:+20");
    fd.set("email", "customer.test@example.com");
    fd.set("consent", "on");
    fd.set("locale", "en");

    const res = await submitContact({ status: "idle" }, fd);
    expect(res.status).toBe("success");

    const lead = await prisma.contactSubmission.findFirst({
      where: { name: uniqueName },
      orderBy: { createdAt: "desc" },
    });
    expect(lead?.email).toBe("customer.test@example.com");

    const job = await prisma.notificationJob.findFirst({
      where: { targetId: lead!.id },
      orderBy: { createdAt: "desc" },
    });
    expect(job?.recipientEmail).toBe("info@image-developments.com");
    expect(job?.senderEmail).toBe("website@image-developments.com"); // Authenticated sender, NEVER customer

    const payload = JSON.parse(job!.payload);
    expect(payload.email).toBe("customer.test@example.com");
  });

  it("2.4 Invalid email is rejected with inline error and preserves form values", async () => {
    const fd = new FormData();
    fd.set("name", "Omar Farouk");
    fd.set("phone", "01122334455");
    fd.set("countryCode", "EG:+20");
    fd.set("email", "not-a-valid-email");
    fd.set("consent", "on");
    fd.set("locale", "en");

    const res = await submitContact({ status: "idle" }, fd);
    expect(res.status).toBe("error");
    expect(res.fields?.email).toBe("Please enter a valid email address.");
    expect(res.values?.name).toBe("Omar Farouk");
    expect(res.values?.email).toBe("not-a-valid-email");

    // Verify NO record created in database
    const lead = await prisma.contactSubmission.findFirst({
      where: { name: "Omar Farouk" },
    });
    expect(lead).toBeNull();
  });
});
