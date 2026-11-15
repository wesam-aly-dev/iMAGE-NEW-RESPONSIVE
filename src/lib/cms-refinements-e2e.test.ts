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
import { saveProject, uploadProjectVisualTour, saveHomepage } from "@/app/admin/actions";
import { getProjectDetailContent, getHomepageContent } from "./content";

describe("CMS Refinements & Virtual Tour E2E Suite", () => {
  const testProjectSlug = "qa-tour-refinement-test";
  let testProjectId: string = "";

  function buildProjectFormData(status: "DRAFT" | "PUBLISHED" = "DRAFT") {
    const fd = new FormData();
    fd.set("id", testProjectId);
    fd.set("slug", testProjectSlug);
    fd.set("nameEn", "QA Tour Test Project");
    fd.set("nameAr", "مشروع فحص الجولة الافتراضية");
    fd.set("shortDescriptionEn", "A high-end residential sanctuary.");
    fd.set("shortDescriptionAr", "ملاذ سكني راقٍ.");
    fd.set("locationEn", "New Cairo");
    fd.set("locationAr", "القاهرة الجديدة");
    fd.set("coverImageUrl", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=88");
    fd.set("coverImageAltEn", "QA Tour Test Cover");
    fd.set("coverImageAltAr", "غلاف مشروع فحص الجولة");
    fd.set("status", status);
    return fd;
  }

  function buildHomepageFormData() {
    const fd = new FormData();
    fd.set("heroEyebrowEn", "Building a new point of view");
    fd.set("heroEyebrowAr", "نبني منظوراً جديداً");
    fd.set("heroTitleEn", "Space,\nimagined\ndifferently.");
    fd.set("heroTitleAr", "مساحات\nنتخيلها\nبشكل مختلف.");
    fd.set("heroNoteEn", "Thoughtful communities for the way Egypt lives next.");
    fd.set("heroNoteAr", "مجتمعات مدروسة لحياة مصر في الغد.");
    fd.set("heroDiscoverEn", "Discover");
    fd.set("heroDiscoverAr", "اكتشف");
    fd.set("heroMediaUrl", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c");
    fd.set("heroMediaAltEn", "Hero image");
    fd.set("heroMediaAltAr", "صورة الواجهة");

    fd.set("lifestyleTitleEn", "The most memorable spaces leave room for life to happen.");
    fd.set("lifestyleTitleAr", "أكثر الأماكن حضوراً هي التي تترك للحياة مساحتها.");
    fd.set("lifestyleEyebrowEn", "Beyond the building");
    fd.set("lifestyleEyebrowAr", "أبعد من المباني");
    fd.set("lifestyleMediaUrl", "https://images.unsplash.com/photo-1600607688969-a5bfcd646154");
    fd.set("lifestyleMediaAltEn", "Lifestyle");
    fd.set("lifestyleMediaAltAr", "نمط الحياة");

    fd.set("closingTitleEn", "Your next view starts here.");
    fd.set("closingTitleAr", "إطلالتك القادمة تبدأ من هنا.");
    fd.set("closingEyebrowEn", "Begin a conversation");
    fd.set("closingEyebrowAr", "ابدأ حواراً معنا");
    fd.set("closingCtaEn", "Talk to us");
    fd.set("closingCtaAr", "تحدث معنا");
    fd.set("closingCtaUrl", "mailto:hello@imagedevelopments.com");

    fd.set("openingBackgroundRgb", "21, 42, 32");
    fd.set("heroBackgroundRgb", "21, 42, 32");
    fd.set("projectsBackgroundRgb", "245, 243, 238");
    fd.set("aboutBackgroundRgb", "245, 243, 238");
    fd.set("lifestyleBackgroundRgb", "21, 42, 32");
    fd.set("statsBackgroundRgb", "21, 42, 32");
    fd.set("journalBackgroundRgb", "245, 243, 238");
    fd.set("closingBackgroundRgb", "21, 42, 32");
    fd.set("footerBackgroundRgb", "15, 30, 23");

    fd.set("sectionOrder", "projects, lifestyle, stats, journal, closing");
    return fd;
  }

  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ id: "admin-qa-id", email: "admin@image.local" });
  });

  beforeAll(async () => {
    // Clean up any lingering test project
    await prisma.project.deleteMany({ where: { slug: testProjectSlug } });

    // Create a base published test project
    const created = await prisma.project.create({
      data: {
        slug: testProjectSlug,
        nameEn: "QA Tour Test Project",
        nameAr: "مشروع فحص الجولة الافتراضية",
        shortDescriptionEn: "A high-end residential sanctuary.",
        shortDescriptionAr: "ملاذ سكني راقٍ.",
        locationEn: "New Cairo",
        locationAr: "القاهرة الجديدة",
        status: "PUBLISHED",
        coverImageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=88",
        coverImageAltEn: "QA Tour Test Cover",
        coverImageAltAr: "غلاف مشروع فحص الجولة",
        gallery: "[]",
      },
    });
    testProjectId = created.id;
  });

  afterAll(async () => {
    if (testProjectId) {
      await prisma.project.deleteMany({ where: { id: testProjectId } });
    }
  });

  describe("Requirement 1: External Virtual Tour ONLY", () => {
    it("rejects non-HTTPS tour URL when virtual tour is enabled", async () => {
      const fd = buildProjectFormData("DRAFT");
      fd.set("virtualTourEnabled", "on");
      fd.set("virtualTourUrl", "http://insecure-tour.imagedevelopments.com/aera");

      const res = await saveProject({}, fd);
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/Virtual Tour URL must be a valid external HTTPS URL/i);
    });

    it("rejects dangerous or unsafe schemes such as javascript:", async () => {
      const fd = buildProjectFormData("DRAFT");
      fd.set("virtualTourEnabled", "on");
      fd.set("virtualTourUrl", "javascript:alert(1)");

      const res = await saveProject({}, fd);
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/HTTPS/i);
    });

    it("rejects non-HTTPS in optional Arabic URL override", async () => {
      const fd = buildProjectFormData("DRAFT");
      fd.set("virtualTourEnabled", "on");
      fd.set("virtualTourUrl", "https://tours.imagedevelopments.com/aera");
      fd.set("virtualTourUrlAr", "http://insecure-arabic.imagedevelopments.com");

      const res = await saveProject({}, fd);
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/Arabic Virtual Tour URL override must be a valid external HTTPS URL/i);
    });

    it("successfully saves valid HTTPS Virtual Tour configuration with bilingual metadata", async () => {
      const fd = buildProjectFormData("PUBLISHED");
      fd.set("virtualTourEnabled", "on");
      fd.set("virtualTourUrl", "https://tours.imagedevelopments.com/aera-residences");
      fd.set("virtualTourUrlAr", "https://tours.imagedevelopments.com/aera-residences?locale=ar");
      fd.set("virtualTourLabelEn", "Experience Virtual Walkthrough");
      fd.set("virtualTourLabelAr", "شاهد الجولة الافتراضية ثلاثية الأبعاد");
      fd.set("virtualTourDescriptionEn", "Walk through model villas and landscape corridors in full 360°.");
      fd.set("virtualTourDescriptionAr", "تجول داخل الفلل والممرات الخضراء بتقنية ٣٦٠ درجة التفاعلية.");

      const res = await saveProject({}, fd);
      expect(res.error).toBeUndefined();
      expect(res.success).toBeDefined();

      const updated = await prisma.project.findUnique({ where: { id: testProjectId } });
      expect(updated?.virtualTourEnabled).toBe(true);
      expect(updated?.virtualTourUrl).toBe("https://tours.imagedevelopments.com/aera-residences");
      expect(updated?.virtualTourUrlAr).toBe("https://tours.imagedevelopments.com/aera-residences?locale=ar");
      expect(updated?.virtualTourLabelEn).toBe("Experience Virtual Walkthrough");
      expect(updated?.virtualTourLabelAr).toBe("شاهد الجولة الافتراضية ثلاثية الأبعاد");
      expect(updated?.virtualTourDescriptionEn).toBe("Walk through model villas and landscape corridors in full 360°.");
      expect(updated?.virtualTourDescriptionAr).toBe("تجول داخل الفلل والممرات الخضراء بتقنية ٣٦٠ درجة التفاعلية.");
    });

    it("public getProjectDetailContent exposes virtualTour with correct locale-specific fields", async () => {
      // Test English
      const enContent = await getProjectDetailContent("en", testProjectSlug);
      expect(enContent).not.toBeNull();
      expect(enContent?.project?.virtualTour).toBeDefined();
      expect(enContent?.project?.virtualTour?.enabled).toBe(true);
      expect(enContent?.project?.virtualTour?.url).toBe("https://tours.imagedevelopments.com/aera-residences");
      expect(enContent?.project?.virtualTour?.label).toBe("Experience Virtual Walkthrough");
      expect(enContent?.project?.virtualTour?.description).toBe("Walk through model villas and landscape corridors in full 360°.");

      // Test Arabic
      const arContent = await getProjectDetailContent("ar", testProjectSlug);
      expect(arContent).not.toBeNull();
      expect(arContent?.project?.virtualTour).toBeDefined();
      expect(arContent?.project?.virtualTour?.enabled).toBe(true);
      expect(arContent?.project?.virtualTour?.url).toBe("https://tours.imagedevelopments.com/aera-residences?locale=ar");
      expect(arContent?.project?.virtualTour?.label).toBe("شاهد الجولة الافتراضية ثلاثية الأبعاد");
      expect(arContent?.project?.virtualTour?.description).toBe("تجول داخل الفلل والممرات الخضراء بتقنية ٣٦٠ درجة التفاعلية.");
    });

    it("public getProjectDetailContent returns virtualTour: undefined when disabled", async () => {
      const fd = buildProjectFormData("PUBLISHED");
      // virtualTourEnabled omitted (false)
      fd.set("virtualTourUrl", "");

      const res = await saveProject({}, fd);
      expect(res.error).toBeUndefined();

      const enContent = await getProjectDetailContent("en", testProjectSlug);
      expect(enContent?.project?.virtualTour).toBeUndefined();
    });

    it("retired uploadProjectVisualTour returns informative error guiding to external HTTPS URLs", async () => {
      const fd = new FormData();
      fd.set("projectId", testProjectId);
      const fakeFile = new File(["dummy"], "tour.zip", { type: "application/zip" });
      fd.set("tourArchive", fakeFile);

      const res = await uploadProjectVisualTour({}, fd);
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/HTML\/ZIP visual tour file uploads have been retired/i);
    });
  });

  describe("Requirement 2: Homepage Company Statistics CMS Editor", () => {
    it("updates company statistics through saveHomepage and renders on public getHomepageContent", async () => {
      const originalStats = await prisma.stat.findMany({ where: { homepageId: "homepage" } });
      expect(originalStats.length).toBeGreaterThan(0);
      const firstStat = originalStats[0];

      const fd = buildHomepageFormData();

      // Company stat fields
      fd.append("statId", firstStat.id);
      fd.set(`statValueEn_${firstStat.id}`, "25+");
      fd.set(`statValueAr_${firstStat.id}`, "+25");
      fd.set(`statUnitEn_${firstStat.id}`, "Yrs");
      fd.set(`statUnitAr_${firstStat.id}`, "عام");
      fd.set(`statLabelEn_${firstStat.id}`, "Years of Architectural Excellence");
      fd.set(`statLabelAr_${firstStat.id}`, "عاماً من التميز المعماري والريادة");
      fd.set(`statVisible_${firstStat.id}`, "on");
      fd.set(`statOrder_${firstStat.id}`, "0");

      const res = await saveHomepage({}, fd);
      expect(res.error).toBeUndefined();
      expect(res.success).toBeDefined();

      // Verify database update
      const updatedStat = await prisma.stat.findUnique({ where: { id: firstStat.id } });
      expect(updatedStat?.valueEn).toBe("25+");
      expect(updatedStat?.valueAr).toBe("+25");
      expect(updatedStat?.labelEn).toBe("Years of Architectural Excellence");
      expect(updatedStat?.labelAr).toBe("عاماً من التميز المعماري والريادة");

      // Verify public getHomepageContent
      const enHome = await getHomepageContent("en");
      const matchedStatEn = enHome.stats.find(s => s.value === "25+");
      expect(matchedStatEn).toBeDefined();
      expect(matchedStatEn?.label).toBe("Years of Architectural Excellence");

      const arHome = await getHomepageContent("ar");
      const matchedStatAr = arHome.stats.find(s => s.value === "+25");
      expect(matchedStatAr).toBeDefined();
      expect(matchedStatAr?.label).toBe("عاماً من التميز المعماري والريادة");

      // Restore original stat values
      await prisma.stat.update({
        where: { id: firstStat.id },
        data: {
          valueEn: firstStat.valueEn,
          valueAr: firstStat.valueAr,
          unitEn: firstStat.unitEn,
          unitAr: firstStat.unitAr,
          labelEn: firstStat.labelEn,
          labelAr: firstStat.labelAr,
          visible: firstStat.visible,
          sortOrder: firstStat.sortOrder,
        },
      });
    });
  });

  describe("Requirement 3: Demo Content Seeding Verification", () => {
    it("ensures Aera, Solaya, and Marea all have external virtual tour configured and published", async () => {
      const projects = await prisma.project.findMany({
        where: { slug: { in: ["aera", "solaya", "marea"] } },
        include: { galleryItemList: true },
      });

      expect(projects.length).toBe(3);
      for (const p of projects) {
        expect(p.virtualTourEnabled).toBe(true);
        expect(p.virtualTourUrl).toMatch(/^https:\/\//);
        expect(p.virtualTourLabelEn).toBe("Explore Virtual Tour");
        expect(p.virtualTourLabelAr).toBe("استكشف الجولة الافتراضية");
        expect(p.galleryItemList.length).toBeGreaterThan(0);
      }
    });
  });
});
