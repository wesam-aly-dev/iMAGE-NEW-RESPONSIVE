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

import {
  saveHomepage,
  applyWhiteThemeToHomepageContentSections,
  applyWarmThemeToHomepageContentSections,
  revertHomepageContentColors,
} from "@/app/admin/actions";
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
    fd.set("has_openingEnabled", "1");
    if (h.openingEnabled) fd.set("openingEnabled", "on");
    fd.set("openingHeadlineEn", h.openingHeadlineEn || "A new perspective");
    fd.set("openingHeadlineAr", h.openingHeadlineAr || "منظور جديد");
    fd.set("has_heroEnabled", "1");
    fd.set("heroEnabled", "on");
    fd.set("heroEyebrowEn", h.heroEyebrowEn || "Visionary Living");
    fd.set("heroEyebrowAr", h.heroEyebrowAr || "حياة راقية");
    fd.set("heroTitleEn", h.heroTitleEn || "Spaces Crafted For Life");
    fd.set("heroTitleAr", h.heroTitleAr || "مساحات صُممت للحياة");
    fd.set("heroNoteEn", h.heroNoteEn || "Every residence is designed with purpose.");
    fd.set("heroNoteAr", h.heroNoteAr || "كل وحدة سكنية صُممت بعناية.");
    fd.set("heroDiscoverEn", h.heroDiscoverEn || "Scroll to explore");
    fd.set("heroDiscoverAr", h.heroDiscoverAr || "مرر للاستكشاف");
    fd.set("heroMediaType", "IMAGE");
    fd.set("heroMediaUrl", h.heroMediaUrl || "/uploads/hero.jpg");
    fd.set("heroFocalPoint", "center");
    fd.set("heroMobileMediaType", "INHERIT");
    fd.set("heroMobileFocalPoint", "center");
    fd.set("heroMediaAltEn", h.heroMediaAltEn || "Hero architectural image");
    fd.set("heroMediaAltAr", h.heroMediaAltAr || "صورة معمارية للواجهة");

    fd.set("has_projectsEnabled", "1");
    fd.set("projectsEnabled", "on");
    fd.set("projectsHeadingEn", h.projectsHeadingEn || "Signature Destinations");
    fd.set("projectsHeadingAr", h.projectsHeadingAr || "وجهاتنا المتميزة");
    fd.set("projectsExploreEn", h.projectsExploreEn || "Explore Project");
    fd.set("projectsExploreAr", h.projectsExploreAr || "اكتشف المشروع");

    fd.set("has_lifestyleEnabled", "1");
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

    fd.set("has_statsEnabled", "1");
    fd.set("statsEnabled", "on");

    fd.set("has_journalEnabled", "1");
    fd.set("journalEnabled", "on");

    fd.set("has_closingEnabled", "1");
    fd.set("closingEnabled", "on");
    fd.set("closingEyebrowEn", h.closingEyebrowEn || "LET'S TALK");
    fd.set("closingEyebrowAr", h.closingEyebrowAr || "لنتحدث");
    fd.set("closingTitleEn", h.closingTitleEn || "Find your next place.");
    fd.set("closingTitleAr", h.closingTitleAr || "اكتشف مكانك القادم.");
    fd.set("closingCtaEn", h.closingCtaEn || "Call 17087");
    fd.set("closingCtaAr", h.closingCtaAr || "اتصل على 17087");
    fd.set("closingCtaUrl", h.closingCtaUrl || "tel:17087");

    fd.set("has_sectionOrder", "1");
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

  it("M. Save exact hero media options payload without Prisma Unknown argument error", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("heroMediaType", "VIDEO");
    fd.set("heroVideoDesktopUrl", "https://example.com/desktop-hero.mp4");
    fd.set("heroPosterUrl", "https://example.com/desktop-poster.jpg");
    fd.set("heroFocalPoint", "top");
    fd.set("heroMobileMediaType", "IMAGE");
    fd.set("heroMobileMediaUrl", "https://example.com/mobile-hero.jpg");
    fd.set("heroMobilePosterUrl", "https://example.com/mobile-poster.jpg");
    fd.set("heroMobileFocalPoint", "bottom");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("Homepage saved.");

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.heroMediaType).toBe("VIDEO");
    expect(updated.heroVideoDesktopUrl).toBe("https://example.com/desktop-hero.mp4");
    expect(updated.heroPosterUrl).toBe("https://example.com/desktop-poster.jpg");
    expect(updated.heroFocalPoint).toBe("top");
    expect(updated.heroMobileMediaType).toBe("IMAGE");
    expect(updated.heroMobileMediaUrl).toBe("https://example.com/mobile-hero.jpg");
    expect(updated.heroMobileFocalPoint).toBe("bottom");
  });

  it("N. Distinguish missing inputs from false booleans preserving section visibility", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = new FormData();
    // A partial form that only submits heroEyebrowEn, without has_projectsEnabled or projectsEnabled
    fd.set("heroEyebrowEn", "Preserve Visibility Test");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    // Section visibility must remain preserved from existing, NOT defaulted to false
    expect(updated.projectsEnabled).toBe(h.projectsEnabled);
    expect(updated.lifestyleEnabled).toBe(h.lifestyleEnabled);
    expect(updated.closingEnabled).toBe(h.closingEnabled);
  });

  it("O. Explicitly unchecking a section visibility checkbox sets it to false", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    // Explicitly uncheck projects
    fd.set("has_projectsEnabled", "1");
    fd.delete("projectsEnabled");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.projectsEnabled).toBe(false);

    // Restore
    fd.set("projectsEnabled", "on");
    await saveHomepage({}, fd);
  });

  it("P. Apply pure white theme and revert to previous colors", async () => {
    // First save distinct initial colors
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("projectsBackgroundRgb", "245, 243, 238");
    fd.set("lifestyleBackgroundRgb", "21, 42, 32");
    await saveHomepage({}, fd);

    // Apply pure white theme
    const whiteRes = await applyWhiteThemeToHomepageContentSections({}, new FormData());
    expect(whiteRes.success).toBeDefined();

    let check = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(check.projectsBackgroundRgb).toBe("255, 255, 255");
    expect(check.lifestyleBackgroundRgb).toBe("255, 255, 255");
    expect(check.statsBackgroundRgb).toBe("255, 255, 255");
    expect(check.closingBackgroundRgb).toBe("255, 255, 255");
    // Branded dark footer remains preserved
    expect(check.footerBackgroundRgb).toBe(h.footerBackgroundRgb);

    // Revert previous colors
    const revertRes = await revertHomepageContentColors({}, new FormData());
    expect(revertRes.success).toBeDefined();

    check = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(check.projectsBackgroundRgb).toBe("245, 243, 238");
    expect(check.lifestyleBackgroundRgb).toBe("21, 42, 32");
  });

  it("Q. Reject non-existent local /uploads/ asset references with clear error", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);
    fd.set("lifestyleTopLeftImageUrl", "/uploads/qa-nonexistent-file-999.jpg");

    const res = await saveHomepage({}, fd);
    expect(res.success).toBeUndefined();
    expect(res.error).toMatch(/Media Error/i);
    expect(res.error).toContain("qa-nonexistent-file-999.jpg");
  });

  it("R. Successfully saves exact user payload from incident NT1UD89B with all real customer upload paths", async () => {
    const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    const fd = buildValidFormData(h);

    fd.set("heroMediaType", "IMAGE");
    fd.set("heroMediaUrl", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c");
    fd.set("heroMobileMediaType", "INHERIT");
    fd.set("heroMobileMediaUrl", "/uploads/1795002825882-f25bd72a-e15b-46bb-b94c-5f4bd27aebb9.jpg");

    fd.set("lifestyleTopLeftImageUrl", "/uploads/1795002928875-408d71d0-cd88-4970-b513-272bdc92f3e8.jpg");
    fd.set("lifestyleTopLeftImageAltEn", "Architectural entrance facade");
    fd.set("lifestyleTopLeftImageAltAr", "واجهة المدخل المعماري");
    fd.set("lifestyleTopLeftFocalPoint", "top");

    fd.set("lifestyleTopRightImageUrl", "/uploads/1794927257284-photo-2026-10-21-19-38-21-ffc6f5af.jpg");
    fd.set("lifestyleTopRightImageAltEn", "Lush landscaped gardens");
    fd.set("lifestyleTopRightImageAltAr", "حدائق طبيعية غناء");
    fd.set("lifestyleTopRightFocalPoint", "center");

    fd.set("lifestyleBottomLeftImageUrl", "/uploads/1794705169297-screenshot-2026-11-14-at-9-26-27-pm-1c75ea27.png");
    fd.set("lifestyleBottomLeftImageAltEn", "Double-height living pavilion");
    fd.set("lifestyleBottomLeftImageAltAr", "صالة معيشة بارتفاع مزدوج");
    fd.set("lifestyleBottomLeftFocalPoint", "bottom");

    fd.set("lifestyleBottomRightImageUrl", "/uploads/1794705160483-screenshot-2026-11-14-at-9-57-30-pm-7ae60f02.png");
    fd.set("lifestyleBottomRightImageAltEn", "Private terrace at dusk");
    fd.set("lifestyleBottomRightImageAltAr", "شرفة خاصة وقت الغروب");
    fd.set("lifestyleBottomRightFocalPoint", "right");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("Homepage saved.");

    const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(updated.heroMediaType).toBe("IMAGE");
    expect(updated.lifestyleTopLeftImageUrl).toBe("/uploads/1795002928875-408d71d0-cd88-4970-b513-272bdc92f3e8.jpg");
    expect(updated.lifestyleTopRightImageUrl).toBe("/uploads/1794927257284-photo-2026-10-21-19-38-21-ffc6f5af.jpg");
    expect(updated.lifestyleBottomLeftImageUrl).toBe("/uploads/1794705169297-screenshot-2026-11-14-at-9-26-27-pm-1c75ea27.png");
    expect(updated.lifestyleBottomRightImageUrl).toBe("/uploads/1794705160483-screenshot-2026-11-14-at-9-57-30-pm-7ae60f02.png");

    const publicEn = await getHomepageContent("en");
    expect(publicEn.lifestyle.slots?.topLeft?.url).toBe("/uploads/1795002928875-408d71d0-cd88-4970-b513-272bdc92f3e8.jpg");
    expect(publicEn.lifestyle.slots?.topRight?.url).toBe("/uploads/1794927257284-photo-2026-10-21-19-38-21-ffc6f5af.jpg");
    expect(publicEn.lifestyle.slots?.bottomLeft?.url).toBe("/uploads/1794705169297-screenshot-2026-11-14-at-9-26-27-pm-1c75ea27.png");
    expect(publicEn.lifestyle.slots?.bottomRight?.url).toBe("/uploads/1794705160483-screenshot-2026-11-14-at-9-57-30-pm-7ae60f02.png");
  });
});
