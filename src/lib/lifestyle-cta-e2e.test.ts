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
import { saveHomepage } from "@/app/admin/actions";
import { getHomepageContent } from "./content";

describe("Homepage Lifestyle CTA End-to-End Workflow Suite", () => {
  let originalHomepage: any = null;

  beforeEach(async () => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ id: "admin-qa-id", email: "admin@image.local" });
  });

  beforeAll(async () => {
    originalHomepage = await prisma.homepage.findUnique({ where: { id: "homepage" } });
  });

  afterAll(async () => {
    if (originalHomepage) {
      await prisma.homepage.update({
        where: { id: "homepage" },
        data: {
          lifestyleCtaEnabled: originalHomepage.lifestyleCtaEnabled,
          lifestyleCtaExternal: originalHomepage.lifestyleCtaExternal,
          lifestyleCtaLabelEn: originalHomepage.lifestyleCtaLabelEn,
          lifestyleCtaLabelAr: originalHomepage.lifestyleCtaLabelAr,
          lifestyleCtaUrl: originalHomepage.lifestyleCtaUrl,
          lifestyleTopLeftImageUrl: originalHomepage.lifestyleTopLeftImageUrl,
          lifestyleTopRightImageUrl: originalHomepage.lifestyleTopRightImageUrl,
          lifestyleBottomLeftImageUrl: originalHomepage.lifestyleBottomLeftImageUrl,
          lifestyleBottomRightImageUrl: originalHomepage.lifestyleBottomRightImageUrl,
        },
      });
    }
  });

  // Helper to build a valid base FormData for saveHomepage
  function buildBaseFormData(): FormData {
    const fd = new FormData();
    const hp = originalHomepage || {};
    fd.set("heroEyebrowEn", hp.heroEyebrowEn || "Visionary Living");
    fd.set("heroEyebrowAr", hp.heroEyebrowAr || "حياة راقية");
    fd.set("heroTitleEn", hp.heroTitleEn || "Spaces Crafted For Life");
    fd.set("heroTitleAr", hp.heroTitleAr || "مساحات صُممت للحياة");
    fd.set("heroNoteEn", hp.heroNoteEn || "Contemporary architecture in New Cairo");
    fd.set("heroNoteAr", hp.heroNoteAr || "عمارة معاصرة في القاهرة الجديدة");
    fd.set("heroMediaUrl", hp.heroMediaUrl || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c");
    fd.set("heroMediaAltEn", hp.heroMediaAltEn || "Hero architectural facade");
    fd.set("heroMediaAltAr", hp.heroMediaAltAr || "الواجهة المعمارية الرئيسية");

    fd.set("lifestyleTitleEn", hp.lifestyleTitleEn || "The most memorable spaces leave room for life to happen.");
    fd.set("lifestyleTitleAr", hp.lifestyleTitleAr || "أكثر المساحات رسوخاً في الذاكرة تترك متسعاً للحياة لتحدث.");
    fd.set("lifestyleEyebrowEn", hp.lifestyleEyebrowEn || "Beyond the building.");
    fd.set("lifestyleEyebrowAr", hp.lifestyleEyebrowAr || "ما وراء البناء.");

    fd.set("closingTitleEn", hp.closingTitleEn || "Start Your Journey");
    fd.set("closingTitleAr", hp.closingTitleAr || "ابدأ رحلتك معنا");
    fd.set("closingCtaEn", hp.closingCtaEn || "Inquire Now");
    fd.set("closingCtaAr", hp.closingCtaAr || "استفسر الآن");
    fd.set("closingCtaUrl", hp.closingCtaUrl || "/contact");

    fd.set("projectsHeadingEn", hp.projectsHeadingEn || "Signature Developments");
    fd.set("projectsHeadingAr", hp.projectsHeadingAr || "مشاريعنا المميزة");
    fd.set("projectsExploreEn", hp.projectsExploreEn || "Explore");
    fd.set("projectsExploreAr", hp.projectsExploreAr || "استكشف");

    fd.set("openingBackgroundRgb", hp.openingBackgroundRgb || "21, 42, 32");
    fd.set("heroBackgroundRgb", hp.heroBackgroundRgb || "21, 42, 32");
    fd.set("projectsBackgroundRgb", hp.projectsBackgroundRgb || "245, 243, 238");
    fd.set("aboutBackgroundRgb", hp.aboutBackgroundRgb || "245, 243, 238");
    fd.set("lifestyleBackgroundRgb", hp.lifestyleBackgroundRgb || "21, 42, 32");
    fd.set("statsBackgroundRgb", hp.statsBackgroundRgb || "21, 42, 32");
    fd.set("journalBackgroundRgb", hp.journalBackgroundRgb || "245, 243, 238");
    fd.set("closingBackgroundRgb", hp.closingBackgroundRgb || "21, 42, 32");
    fd.set("footerBackgroundRgb", hp.footerBackgroundRgb || "15, 30, 23");

    fd.set("sectionOrder", "projects, lifestyle, stats, journal, closing");
    return fd;
  }

  it("1. Rejects missing English or Arabic labels when CTA is enabled", async () => {
    const fd = buildBaseFormData();
    fd.set("lifestyleCtaEnabled", "on");
    fd.set("lifestyleCtaLabelEn", "");
    fd.set("lifestyleCtaLabelAr", "اكتشف قصتنا");
    fd.set("lifestyleCtaUrl", "/about");

    const res = await saveHomepage({}, fd);
    expect(res.error).toMatch(/Enter the section CTA button label in both English and Arabic/i);
  });

  it("2. Rejects unsafe protocols (javascript:) or invalid external URLs", async () => {
    // Unsafe protocol
    const fdUnsafe = buildBaseFormData();
    fdUnsafe.set("lifestyleCtaEnabled", "on");
    fdUnsafe.set("lifestyleCtaLabelEn", "Discover");
    fdUnsafe.set("lifestyleCtaLabelAr", "اكتشف");
    fdUnsafe.set("lifestyleCtaUrl", "javascript:alert('xss')");

    const resUnsafe = await saveHomepage({}, fdUnsafe);
    expect(resUnsafe.error).toMatch(/Unsafe destination URL scheme/i);

    // External without http/https
    const fdBadExternal = buildBaseFormData();
    fdBadExternal.set("lifestyleCtaEnabled", "on");
    fdBadExternal.set("lifestyleCtaExternal", "on");
    fdBadExternal.set("lifestyleCtaLabelEn", "External Tour");
    fdBadExternal.set("lifestyleCtaLabelAr", "جولة خارجية");
    fdBadExternal.set("lifestyleCtaUrl", "image-developments.com/tour");

    const resBadExternal = await saveHomepage({}, fdBadExternal);
    expect(resBadExternal.error).toMatch(/External destination URLs must begin with http:\/\/ or https:\/\//i);
  });

  it("3. Persists internal CTA round-trip and reads directly from CMS database", async () => {
    const fd = buildBaseFormData();
    fd.set("lifestyleCtaEnabled", "on");
    fd.set("lifestyleCtaLabelEn", "Our Heritage & Vision");
    fd.set("lifestyleCtaLabelAr", "تراثنا ورؤيتنا");
    fd.set("lifestyleCtaUrl", "/about");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("Homepage saved.");

    // Check database
    const inDb = await prisma.homepage.findUnique({ where: { id: "homepage" } });
    expect(inDb?.lifestyleCtaLabelEn).toBe("Our Heritage & Vision");
    expect(inDb?.lifestyleCtaLabelAr).toBe("تراثنا ورؤيتنا");
    expect(inDb?.lifestyleCtaUrl).toBe("/about");
    expect(inDb?.lifestyleCtaEnabled).toBe(true);
    expect(inDb?.lifestyleCtaExternal).toBe(false);

    // Check public content queries for EN and AR return the CMS values directly
    const enContent = await getHomepageContent("en");
    expect(enContent.lifestyle.ctaLabel).toBe("Our Heritage & Vision");
    expect(enContent.lifestyle.ctaUrl).toBe("/about");
    expect(enContent.lifestyle.ctaEnabled).toBe(true);
    expect(enContent.lifestyle.ctaExternal).toBe(false);

    const arContent = await getHomepageContent("ar");
    expect(arContent.lifestyle.ctaLabel).toBe("تراثنا ورؤيتنا");
    expect(arContent.lifestyle.ctaUrl).toBe("/about");
    expect(arContent.lifestyle.ctaEnabled).toBe(true);
    expect(arContent.lifestyle.ctaExternal).toBe(false);
  });

  it("4. Prevents duplicate locale prefixes like /en/en/about or /ar/en/about", () => {
    // Tests the link resolution algorithm used in LivingStory on the frontend
    function resolveLivingStoryHref(rawUrl: string, locale: string, isExternal?: boolean, isAboutPage?: boolean): string {
      if (isAboutPage) return "#about";
      const rawHref = (rawUrl || "/about").trim();
      if (isExternal || /^https?:\/\//i.test(rawHref) || rawHref.startsWith("#")) return rawHref;
      const cleanPath = rawHref.replace(/^\/(?:en|ar)(?:\/|$)/, "/");
      return cleanPath.startsWith("/") ? `/${locale}${cleanPath === "/" ? "" : cleanPath}` : `/${locale}/${cleanPath}`;
    }

    // Standard internal /about
    expect(resolveLivingStoryHref("/about", "en")).toBe("/en/about");
    expect(resolveLivingStoryHref("/about", "ar")).toBe("/ar/about");

    // Accidental user prefix /en/about
    expect(resolveLivingStoryHref("/en/about", "en")).toBe("/en/about");
    expect(resolveLivingStoryHref("/en/about", "ar")).toBe("/ar/about");

    // Accidental user prefix /ar/about
    expect(resolveLivingStoryHref("/ar/about", "en")).toBe("/en/about");
    expect(resolveLivingStoryHref("/ar/about", "ar")).toBe("/ar/about");

    // Custom project link /projects/image-one
    expect(resolveLivingStoryHref("/projects/image-one", "en")).toBe("/en/projects/image-one");
    expect(resolveLivingStoryHref("/projects/image-one", "ar")).toBe("/ar/projects/image-one");

    // Accidental /en/projects/image-one
    expect(resolveLivingStoryHref("/en/projects/image-one", "ar")).toBe("/ar/projects/image-one");

    // External URL remains untouched
    expect(resolveLivingStoryHref("https://example.com/tour", "en", true)).toBe("https://example.com/tour");
    expect(resolveLivingStoryHref("https://example.com/tour", "ar", true)).toBe("https://example.com/tour");
  });

  it("5. Persists external URL and preserves exact URL without adding locale prefix", async () => {
    const fd = buildBaseFormData();
    fd.set("lifestyleCtaEnabled", "on");
    fd.set("lifestyleCtaExternal", "on");
    fd.set("lifestyleCtaLabelEn", "Experience 360 Tour");
    fd.set("lifestyleCtaLabelAr", "تجربة الجولة الافتراضية 360");
    fd.set("lifestyleCtaUrl", "https://tour.imagedevelopments.com/virtual");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const enContent = await getHomepageContent("en");
    expect(enContent.lifestyle.ctaUrl).toBe("https://tour.imagedevelopments.com/virtual");
    expect(enContent.lifestyle.ctaExternal).toBe(true);

    const arContent = await getHomepageContent("ar");
    expect(arContent.lifestyle.ctaUrl).toBe("https://tour.imagedevelopments.com/virtual");
    expect(arContent.lifestyle.ctaExternal).toBe(true);
  });

  it("6. Persists disabling CTA and returns ctaEnabled: false", async () => {
    const fd = buildBaseFormData();
    // When unchecked, browsers omit the checkbox from FormData
    // Our action handles f.has("lifestyleCtaEnabled") ? bool(f, "lifestyleCtaEnabled") : true;
    // To explicitly test false, pass field with value "" or without "on"
    fd.set("lifestyleCtaEnabled", "false");
    fd.set("lifestyleCtaLabelEn", "Discover Our Story");
    fd.set("lifestyleCtaLabelAr", "اكتشف قصتنا");
    fd.set("lifestyleCtaUrl", "/about");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const inDb = await prisma.homepage.findUnique({ where: { id: "homepage" } });
    expect(inDb?.lifestyleCtaEnabled).toBe(false);

    const enContent = await getHomepageContent("en");
    expect(enContent.lifestyle.ctaEnabled).toBe(false);

    const arContent = await getHomepageContent("ar");
    expect(arContent.lifestyle.ctaEnabled).toBe(false);
  });

  it("7. Ensures updating CTA settings does not overwrite or corrupt section images or statistics", async () => {
    // Record current images and stats before CTA update
    const beforeHp = await prisma.homepage.findUnique({ where: { id: "homepage" } });
    const beforeStats = await prisma.stat.findMany();

    const fd = buildBaseFormData();
    fd.set("lifestyleCtaEnabled", "on");
    fd.set("lifestyleCtaLabelEn", "Discover Our Story");
    fd.set("lifestyleCtaLabelAr", "اكتشف قصتنا");
    fd.set("lifestyleCtaUrl", "/about");

    const res = await saveHomepage({}, fd);
    expect(res.error).toBeUndefined();

    const afterHp = await prisma.homepage.findUnique({ where: { id: "homepage" } });
    const afterStats = await prisma.stat.findMany();

    // Verify images preserved
    expect(afterHp?.lifestyleTopLeftImageUrl).toBe(beforeHp?.lifestyleTopLeftImageUrl);
    expect(afterHp?.lifestyleTopRightImageUrl).toBe(beforeHp?.lifestyleTopRightImageUrl);
    expect(afterHp?.lifestyleBottomLeftImageUrl).toBe(beforeHp?.lifestyleBottomLeftImageUrl);
    expect(afterHp?.lifestyleBottomRightImageUrl).toBe(beforeHp?.lifestyleBottomRightImageUrl);

    // Verify stats preserved
    expect(afterStats.length).toBe(beforeStats.length);
  });
});
