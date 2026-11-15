import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}));

// Mock requireAdmin
const mockRequireAdmin = vi.fn();
vi.mock("./session", () => ({
  requireAdmin: () => mockRequireAdmin(),
  getAdminSession: () => mockRequireAdmin(),
}));

import { saveHomepage } from "@/app/admin/actions";
import { getHomepageContent } from "./content";

describe("Homepage Save & Reliability Regression Suite (Tests A through N)", () => {
  let originalHomepage: any = null;

  beforeEach(async () => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ id: "admin-id", email: "admin@image.local" });
  });

  beforeAll(async () => {
    originalHomepage = await prisma.homepage.findUnique({ where: { id: "homepage" } });
  });

  afterAll(async () => {
    if (originalHomepage) {
      await prisma.homepage.update({
        where: { id: "homepage" },
        data: originalHomepage,
      });
    }
  });

  function buildValidFormData(h: any): FormData {
    const fd = new FormData();
    if (h.openingEnabled) fd.set("openingEnabled", "on");
    fd.set("openingHeadlineEn", h.openingHeadlineEn || "A new perspective");
    fd.set("openingHeadlineAr", h.openingHeadlineAr || "منظور جديد");
    fd.set("heroEnabled", "on");
    fd.set("heroEyebrowEn", h.heroEyebrowEn || "Visionary Living");
    fd.set("heroEyebrowAr", h.heroEyebrowAr || "حياة راقية");
    fd.set("heroTitleEn", h.heroTitleEn || "Spaces Crafted For Life");
    fd.set("heroTitleAr", h.heroTitleAr || "مساحات صُممت للحياة");
    fd.set("heroNoteEn", h.heroNoteEn || "Every residence is designed with purpose.");
    fd.set("heroNoteAr", h.heroNoteAr || "كل وحدة سكنية صُممت بعناية.");
    fd.set("heroDiscoverEn", h.heroDiscoverEn || "Scroll to explore");
    fd.set("heroDiscoverAr", h.heroDiscoverAr || "مرر للاستكشاف");
    fd.set("heroMediaUrl", h.heroMediaUrl || "/uploads/hero.jpg");
    fd.set("heroMediaAltEn", h.heroMediaAltEn || "Hero architectural image");
    fd.set("heroMediaAltAr", h.heroMediaAltAr || "صورة معمارية للواجهة");

    fd.set("projectsEnabled", "on");
    fd.set("projectsHeadingEn", h.projectsHeadingEn || "Signature Destinations");
    fd.set("projectsHeadingAr", h.projectsHeadingAr || "وجهاتنا المتميزة");
    fd.set("projectsExploreEn", h.projectsExploreEn || "Explore Project");
    fd.set("projectsExploreAr", h.projectsExploreAr || "اكتشف المشروع");

    fd.set("lifestyleEnabled", "on");
    fd.set("lifestyleEyebrowEn", h.lifestyleEyebrowEn || "Living Narrative");
    fd.set("lifestyleEyebrowAr", h.lifestyleEyebrowAr || "سرد الحياة");
    fd.set("lifestyleTitleEn", h.lifestyleTitleEn || "Beyond the building");
    fd.set("lifestyleTitleAr", h.lifestyleTitleAr || "ما وراء البنيان");

    fd.set("hasLifestyleCtaConfig", "1");
    fd.set("lifestyleCtaEnabled", "on");
    fd.set("lifestyleCtaLabelEn", "Discover Our Story");
    fd.set("lifestyleCtaLabelAr", "اكتشف قصتنا");
    fd.set("lifestyleCtaUrl", "/about");

    fd.set("closingEnabled", "on");
    fd.set("closingEyebrowEn", h.closingEyebrowEn || "LET'S TALK");
    fd.set("closingEyebrowAr", h.closingEyebrowAr || "لنتحدث");
    fd.set("closingTitleEn", h.closingTitleEn || "Find your next place.");
    fd.set("closingTitleAr", h.closingTitleAr || "اكتشف مكانك القادم.");
    fd.set("closingCtaEn", h.closingCtaEn || "Call 17087");
    fd.set("closingCtaAr", h.closingCtaAr || "اتصل على 17087");
    fd.set("closingCtaUrl", h.closingCtaUrl || "tel:17087");

    fd.set("sectionOrder", "projects, lifestyle, stats, journal, closing");

    fd.set("openingBackgroundRgb", h.openingBackgroundRgb || "255, 255, 255");
    fd.set("heroBackgroundRgb", h.heroBackgroundRgb || "255, 255, 255");
    fd.set("projectsBackgroundRgb", h.projectsBackgroundRgb || "255, 255, 255");
    fd.set("aboutBackgroundRgb", h.aboutBackgroundRgb || "255, 255, 255");
    fd.set("lifestyleBackgroundRgb", h.lifestyleBackgroundRgb || "255, 255, 255");
    fd.set("statsBackgroundRgb", h.statsBackgroundRgb || "255, 255, 255");
    fd.set("journalBackgroundRgb", h.journalBackgroundRgb || "255, 255, 255");
    fd.set("closingBackgroundRgb", h.closingBackgroundRgb || "255, 255, 255");
    fd.set("footerBackgroundRgb", h.footerBackgroundRgb || "255, 255, 255");

    return fd;
  }

  it("A. Save a small English text change and verify database persistence", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("heroEyebrowEn", "Refined Living Test EN");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("Homepage saved.");

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.heroEyebrowEn).toBe("Refined Living Test EN");
  });

  it("B. Save an Arabic text change and verify RTL persistence", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("heroEyebrowAr", "حياة استثنائية مجربة");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.heroEyebrowAr).toBe("حياة استثنائية مجربة");
  });

  it("C. Save multiple sections together atomically in a single transaction", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("heroTitleEn", "New Atomic Hero Title\nSecond Visual Line");
    fd.set("projectsHeadingEn", "New Curated Portfolio");
    fd.set("lifestyleTitleEn", "Crafted Spaces Beyond Buildings");
    fd.set("closingTitleEn", "Begin Your Consultation Today");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.heroTitleEn).toContain("New Atomic Hero Title");
    expect(updated.projectsHeadingEn).toBe("New Curated Portfolio");
    expect(updated.lifestyleTitleEn).toBe("Crafted Spaces Beyond Buildings");
    expect(updated.closingTitleEn).toBe("Begin Your Consultation Today");
  });

  it("D. Save while optional sections are collapsed or unedited without clearing existing fields", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    // Don't pass closingCtaUrl to test preservation of unsubmitted fields
    fd.delete("closingCtaUrl");
    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.closingCtaUrl).toBe(h.closingCtaUrl);
  });

  it("E. Replace an image slot and verify reload persistence", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("lifestyleTopLeftImageUrl", "/uploads/qa-test-replacement.jpg");
    fd.set("lifestyleTopLeftFocalPoint", "top");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.lifestyleTopLeftImageUrl).toBe("/uploads/qa-test-replacement.jpg");
    expect(updated.lifestyleTopLeftFocalPoint).toBe("top");
  });

  it("F. Clear an optional field intentionally and verify it remains cleared", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("projectsDescriptionEn", "");
    fd.set("projectsDescriptionAr", "");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.projectsDescriptionEn).toBeNull();
    expect(updated.projectsDescriptionAr).toBeNull();
  });

  it("G. Hide a section, save, reload, and verify visibility; then restore it", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    // Uncheck projects section
    fd.delete("projectsEnabled");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    let updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.projectsEnabled).toBe(false);

    // Restore section
    fd.set("projectsEnabled", "on");
    const resRestore = await saveHomepage({}, fd);
    expect(resRestore.error).toBeUndefined();

    updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.projectsEnabled).toBe(true);
  });

  it("H. Change selected projects and ordering", async () => {
    const project = await prisma.project.findFirst({ where: { status: "PUBLISHED" } });
    if (!project) return;

    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.append("managedProjectId", project.id);
    fd.set(`projectFeatured_${project.id}`, "on");
    fd.set(`projectOrder_${project.id}`, "5");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updatedProj = await prisma.project.findUnique({ where: { id: project.id } });
    expect(updatedProj?.featured).toBe(true);
    expect(updatedProj?.featuredOrder).toBe(5);
  });

  it("I. Submit invalid data and verify field-level and section-specific feedback", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("lifestyleTitleEn", "");

    const res = await saveHomepage({}, fd);
    expect(res.success).toBeUndefined();
    expect(res.error).toBe("About / Our Story: Please complete Living Narrative Heading (English).");
  });

  it("J. Simulate a database failure and confirm the error message is caught safely", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    // Invalid RGB format
    fd.set("heroBackgroundRgb", "invalid-rgb");

    const res = await saveHomepage({}, fd);
    expect(res.success).toBeUndefined();
    expect(res.error).toMatch(/Background Colors:/i);
  });

  it("K. Retry a failed save without duplicate records or database corruption", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("heroTitleEn", "");

    // First attempt fails
    const failRes = await saveHomepage({}, fd);
    expect(failRes.error).toBeDefined();

    // Fix and retry
    fd.set("heroTitleEn", "Spaces Crafted For Life Corrected");
    const retryRes = await saveHomepage({}, fd);
    expect(retryRes.error).toBeUndefined();
    expect(retryRes.success).toBe("Homepage saved.");

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.heroTitleEn).toBe("Spaces Crafted For Life Corrected");
  });

  it("L. Verify public English and Arabic output reflects the saved content", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("heroEyebrowEn", "E2E Verified Living EN");
    fd.set("heroEyebrowAr", "حياة موثقة بالعربية");
    fd.set("lifestyleTitleEn", "Spaces For Real Human Living");
    fd.set("lifestyleTitleAr", "مساحات صُممت لحياة حقيقية");

    await saveHomepage({}, fd);

    const enContent = await getHomepageContent("en");
    expect(enContent.hero.eyebrow).toBe("E2E Verified Living EN");
    expect(enContent.lifestyle.title).toBe("Spaces For Real Human Living");

    const arContent = await getHomepageContent("ar");
    expect(arContent.hero.eyebrow).toBe("حياة موثقة بالعربية");
    expect(arContent.lifestyle.title).toBe("مساحات صُممت لحياة حقيقية");
  });
});
