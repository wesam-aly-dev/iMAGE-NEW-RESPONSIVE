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
import { saveNavigation } from "@/app/admin/actions";
import { getHomepageContent } from "./content";

describe("Navigation Configuration & Workflow E2E Suite", () => {
  let originalItems: any[] = [];
  let originalSettings: any = null;

  beforeEach(async () => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ id: "admin-qa-id", email: "admin@image.local" });
  });

  beforeAll(async () => {
    // Snapshot original configuration to restore cleanly afterward
    originalItems = await prisma.navigationItem.findMany({ orderBy: { sortOrder: "asc" } });
    originalSettings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
  });

  afterAll(async () => {
    // Restore original items and settings
    if (originalSettings) {
      await prisma.globalSettings.update({
        where: { id: "global" },
        data: {
          menuMediaUrl: originalSettings.menuMediaUrl,
          menuMediaAltEn: originalSettings.menuMediaAltEn,
          menuMediaAltAr: originalSettings.menuMediaAltAr,
          menuMediaFocalPoint: originalSettings.menuMediaFocalPoint,
          morePagesLabelEn: originalSettings.morePagesLabelEn,
          morePagesLabelAr: originalSettings.morePagesLabelAr,
          menuFontSizeDesktop: originalSettings.menuFontSizeDesktop,
          menuFontSizeMobile: originalSettings.menuFontSizeMobile,
        },
      });
    }

    if (originalItems.length > 0) {
      await prisma.navigationItem.deleteMany({});
      for (const item of originalItems) {
        await prisma.navigationItem.create({
          data: {
            id: item.id,
            labelEn: item.labelEn,
            labelAr: item.labelAr,
            url: item.url,
            visible: item.visible,
            mobileVisible: item.mobileVisible,
            external: item.external,
            sortOrder: item.sortOrder,
            group: item.group,
            previewImageUrl: item.previewImageUrl,
            previewImageUrlAr: item.previewImageUrlAr,
            previewImageAltEn: item.previewImageAltEn,
            previewImageAltAr: item.previewImageAltAr,
            focalPoint: item.focalPoint,
          },
        });
      }
    }
  });

  it("1. Persists navigation labels, focal points, and localized alt texts round trip", async () => {
    const fd = new FormData();
    const itemId = "nav-test-about";
    fd.append("id", itemId);
    fd.set(`labelEn_${itemId}`, "About Our Architecture");
    fd.set(`labelAr_${itemId}`, "عن عمارتنا وتاريخنا");
    fd.set(`url_${itemId}`, "/about");
    fd.set(`visible_${itemId}`, "on");
    fd.set(`mobileVisible_${itemId}`, "on");
    fd.set(`group_${itemId}`, "primary");
    fd.set(`previewImageUrl_${itemId}`, "/uploads/custom-about.webp");
    fd.set(`previewImageAltEn_${itemId}`, "Interior architectural lounge");
    fd.set(`previewImageAltAr_${itemId}`, "صالة داخلية معمارية راقية");
    fd.set(`focalPoint_${itemId}`, "top");

    fd.set("defaultMenuMediaUrl", "/images/menu.jpg");
    fd.set("defaultMenuMediaFocalPoint", "center");
    fd.set("defaultMenuMediaAltEn", "Image Developments default photograph");
    fd.set("defaultMenuMediaAltAr", "الصورة الافتراضية لقائمة إيمدج");
    fd.set("morePagesLabelEn", "Explore More");
    fd.set("morePagesLabelAr", "استكشف المزيد");
    fd.set("menuFontSizeDesktop", "1.25rem");
    fd.set("menuFontSizeMobile", "1.125rem");

    const res = await saveNavigation({}, fd);
    expect(res.error).toBeUndefined();

    // Verify in database
    const savedItem = await prisma.navigationItem.findUnique({ where: { id: itemId } });
    expect(savedItem).toBeDefined();
    expect(savedItem!.labelEn).toBe("About Our Architecture");
    expect(savedItem!.labelAr).toBe("عن عمارتنا وتاريخنا");
    expect(savedItem!.previewImageAltEn).toBe("Interior architectural lounge");
    expect(savedItem!.previewImageAltAr).toBe("صالة داخلية معمارية راقية");
    expect(savedItem!.focalPoint).toBe("top");

    const savedSettings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
    expect(savedSettings!.morePagesLabelEn).toBe("Explore More");
    expect(savedSettings!.morePagesLabelAr).toBe("استكشف المزيد");
    expect(savedSettings!.menuFontSizeDesktop).toBe("1.25rem");
  });

  it("2. Reflects custom More Pages label and primary order in public getHomepageContent", async () => {
    // Save 4 standard primary items in order, and 1 secondary item
    const fd = new FormData();
    const itemsToSave = [
      { id: "test-home", labelEn: "Home", labelAr: "الرئيسية", url: "#top", group: "primary" },
      { id: "test-about", labelEn: "About Us", labelAr: "من نحن", url: "/about", group: "primary" },
      { id: "test-projects", labelEn: "Projects", labelAr: "المشاريع", url: "/projects", group: "primary" },
      { id: "test-contact", labelEn: "Contact Us", labelAr: "تواصل معنا", url: "/contact", group: "primary" },
      { id: "test-careers", labelEn: "Careers", labelAr: "الوظائف", url: "/careers", group: "secondary" },
    ];

    for (const it of itemsToSave) {
      fd.append("id", it.id);
      fd.set(`labelEn_${it.id}`, it.labelEn);
      fd.set(`labelAr_${it.id}`, it.labelAr);
      fd.set(`url_${it.id}`, it.url);
      fd.set(`visible_${it.id}`, "on");
      fd.set(`mobileVisible_${it.id}`, "on");
      fd.set(`group_${it.id}`, it.group);
      fd.set(`focalPoint_${it.id}`, "center");
    }

    fd.set("morePagesLabelEn", "Additional Pages");
    fd.set("morePagesLabelAr", "صفحات إضافية");

    await saveNavigation({}, fd);

    // Verify English public content
    const enContent = await getHomepageContent("en");
    expect(enContent.common.morePages).toBe("Additional Pages");
    const enNav = enContent.nav;
    expect(enNav[0].label).toBe("Home");
    expect(enNav[1].label).toBe("About Us");
    expect(enNav[2].label).toBe("Projects");
    expect(enNav[3].label).toBe("Contact Us");
    expect(enNav[4].label).toBe("Careers");
    expect(enNav[4].group).toBe("secondary");

    // Verify Arabic public content
    const arContent = await getHomepageContent("ar");
    expect(arContent.common.morePages).toBe("صفحات إضافية");
    const arNav = arContent.nav;
    expect(arNav[0].label).toBe("الرئيسية");
    expect(arNav[1].label).toBe("من نحن");
    expect(arNav[2].label).toBe("المشاريع");
    expect(arNav[3].label).toBe("تواصل معنا");
    expect(arNav[4].label).toBe("الوظائف");
  });

  it("3. Moving a link between primary and secondary groups updates public grouping", async () => {
    // Move Careers to primary group
    const fd = new FormData();
    const itemsToSave = [
      { id: "test-home", labelEn: "Home", labelAr: "الرئيسية", url: "#top", group: "primary" },
      { id: "test-careers", labelEn: "Careers", labelAr: "الوظائف", url: "/careers", group: "primary" },
      { id: "test-about", labelEn: "About Us", labelAr: "من نحن", url: "/about", group: "secondary" },
    ];

    for (const it of itemsToSave) {
      fd.append("id", it.id);
      fd.set(`labelEn_${it.id}`, it.labelEn);
      fd.set(`labelAr_${it.id}`, it.labelAr);
      fd.set(`url_${it.id}`, it.url);
      fd.set(`visible_${it.id}`, "on");
      fd.set(`mobileVisible_${it.id}`, "on");
      fd.set(`group_${it.id}`, it.group);
    }

    await saveNavigation({}, fd);

    const enContent = await getHomepageContent("en");
    const careers = enContent.nav.find((n) => n.id === "test-careers");
    const about = enContent.nav.find((n) => n.id === "test-about");

    expect(careers?.group).toBe("primary");
    expect(about?.group).toBe("secondary");
  });

  it("4. Desktop and Mobile visibility flags filter navigation appropriately", async () => {
    const fd = new FormData();
    // Item 1: Visible on desktop, hidden on mobile
    fd.append("id", "test-desktop-only");
    fd.set("labelEn_test-desktop-only", "Desktop Only Link");
    fd.set("labelAr_test-desktop-only", "رابط لسطح المكتب");
    fd.set("url_test-desktop-only", "/desktop-only");
    fd.set("visible_test-desktop-only", "on");
    // mobileVisible not checked (omitted)

    // Item 2: Hidden on desktop, visible on mobile
    fd.append("id", "test-mobile-only");
    fd.set("labelEn_test-mobile-only", "Mobile Only Link");
    fd.set("labelAr_test-mobile-only", "رابط للجوال");
    fd.set("url_test-mobile-only", "/mobile-only");
    // visible omitted
    fd.set("mobileVisible_test-mobile-only", "on");

    await saveNavigation({}, fd);

    const savedDesktopOnly = await prisma.navigationItem.findUnique({
      where: { id: "test-desktop-only" },
    });
    expect(savedDesktopOnly!.visible).toBe(true);
    expect(savedDesktopOnly!.mobileVisible).toBe(false);

    const savedMobileOnly = await prisma.navigationItem.findUnique({
      where: { id: "test-mobile-only" },
    });
    expect(savedMobileOnly!.visible).toBe(false);
    expect(savedMobileOnly!.mobileVisible).toBe(true);
  });

  it("5. Image fallback hierarchy: item dedicated image overrides global default", async () => {
    const fd = new FormData();
    fd.append("id", "test-custom-img");
    fd.set("labelEn_test-custom-img", "Custom Image Link");
    fd.set("labelAr_test-custom-img", "رابط مع صورة خاصة");
    fd.set("url_test-custom-img", "/custom-img");
    fd.set("visible_test-custom-img", "on");
    fd.set("previewImageUrl_test-custom-img", "/uploads/dedicated.jpg");
    fd.set("previewImageAltEn_test-custom-img", "Dedicated image alt text");

    fd.append("id", "test-global-img");
    fd.set("labelEn_test-global-img", "Global Image Link");
    fd.set("labelAr_test-global-img", "رابط يستخدم الصورة العامة");
    fd.set("url_test-global-img", "/global-img");
    fd.set("visible_test-global-img", "on");
    // previewImageUrl omitted

    fd.set("defaultMenuMediaUrl", "/images/menu.jpg");
    fd.set("defaultMenuMediaAltEn", "Global Fallback Image");

    await saveNavigation({}, fd);

    const enContent = await getHomepageContent("en");
    const itemWithCustom = enContent.nav.find((n) => n.id === "test-custom-img");
    const itemWithGlobal = enContent.nav.find((n) => n.id === "test-global-img");

    expect(itemWithCustom?.previewImage).toBe("/uploads/dedicated.jpg");
    expect(itemWithCustom?.imageAlt).toBe("Dedicated image alt text");

    // Link without previewImage has undefined previewImage, so SiteHeader uses defaultMenuImage
    expect(itemWithGlobal?.previewImage).toBeUndefined();
    expect(enContent.settings?.menuImage).toBe("/images/menu.jpg");
  });

  it("6. Rejects unauthorized attempts to save navigation", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Unauthorized"));
    const fd = new FormData();
    fd.append("id", "hacker-item");

    await expect(saveNavigation({}, fd)).rejects.toThrow("Unauthorized");
  });
});
