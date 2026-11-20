import { describe, expect, it, vi, beforeAll } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin" }),
  getAdminSession: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin" }),
}));
vi.mock("next/image", () => ({
  default: ({ fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    void fill;
    return <img {...props} />;
  },
}));
vi.mock("framer-motion", () => ({
  motion: {
    header: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <header {...props}>{children}</header>,
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => 0,
}));

import { prisma } from "./prisma";
import {
  getTeamPageContent,
  getPartnersPageContent,
  getContactPageContent,
  getCareersPageContent,
  getAboutPageContent,
} from "./content";
import { PageHero } from "../components/page-hero";
import { CareersPageExperience } from "../components/careers-page-experience";
import { TeamPageExperience } from "../components/team-page-experience";
import { ContactPageExperience } from "../components/contact-page-experience";
import {
  saveContactPage,
  saveTeam,
  savePartners,
  saveCareersPageContent,
  saveAbout,
} from "../app/admin/actions";

describe("Hero Media Saving, Reloading, and Viewport Rendering Verification", () => {
  const resetDefaults = async () => {
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        teamHeroMediaType: "IMAGE",
        teamHeroVideoUrl: null,
        teamHeroPosterUrl: null,
        teamHeroImageUrl: "/uploads/desktop-master.jpg",
        teamHeroHeight: "standard",
        partnersHeroMediaType: "IMAGE",
        partnersHeroVideoUrl: null,
        partnersHeroPosterUrl: null,
        partnersHeroImageUrl: "/uploads/desktop-master.jpg",
        careersHeroMediaType: "IMAGE",
        careersHeroVideoUrl: null,
        careersHeroPosterUrl: null,
        careersHeroImageUrl: "/uploads/desktop-master.jpg",
        careersHeroHeight: "fullscreen",
        aboutHeroMediaType: "IMAGE",
        aboutHeroVideoUrl: null,
        aboutHeroPosterUrl: null,
        aboutHeroImageUrl: "/uploads/desktop-master.jpg",
      },
    });

    await prisma.contactPage.update({
      where: { id: "contactpage" },
      data: {
        heroMediaType: "IMAGE",
        heroVideoUrl: null,
        heroImageUrl: "/uploads/desktop-master.jpg",
        heroMobileMediaType: "INHERIT",
        heroMobileImageUrl: null,
        heroPosterUrl: null,
        heroFocalPoint: "center",
        heroOverlay: "medium",
        heroAlignment: "start",
        heroHeight: "standard",
        heroEnabled: true,
      },
    });
  };

  beforeAll(async () => {
    await resetDefaults();
  });
  it("1. Careers page hero fills initial viewport with PageHero and action CTAs", async () => {
    const careersContent = await getCareersPageContent("en");
    expect(careersContent.careersPage.hero).toBeDefined();
    expect(careersContent.careersPage.hero?.height).toBe("fullscreen");
    expect(careersContent.careersPage.hero?.ctaUrl).toBe("#open-positions");
    expect(careersContent.careersPage.hero?.image).toBe("/uploads/desktop-master.jpg");

    // Render Careers experience and verify PageHero markup
    const markup = renderToStaticMarkup(<CareersPageExperience copy={careersContent} />);
    expect(markup).toContain("page-hero");
    expect(markup).toContain("page-hero--fullscreen");
    expect(markup).toContain("has-media");
    expect(markup).toContain("page-hero-img-desktop");
    expect(markup).toContain("#open-positions");
    expect(markup).toContain("btn-page-hero-secondary");
    expect(markup).toContain("#life-at-image");
  });

  it("2. Team, Partners, Contact, and About heroes render authentic media without gradient fallback", async () => {
    const [teamContent, partnersContent, contactContent, aboutContent] = await Promise.all([
      getTeamPageContent("en"),
      getPartnersPageContent("en"),
      getContactPageContent("en"),
      getAboutPageContent("en"),
    ]);

    // Team hero
    expect(teamContent.teamPage.hero?.image).toBe("/uploads/desktop-master.jpg");
    const teamMarkup = renderToStaticMarkup(<TeamPageExperience copy={teamContent} />);
    expect(teamMarkup).toContain("page-hero");
    expect(teamMarkup).toContain("has-media");
    expect(teamMarkup).not.toContain("has-brand-bg");
    expect(teamMarkup).toContain("page-hero-img-desktop is-universal");

    // Contact hero
    expect(contactContent.contactPage.hero?.image).toBe("/uploads/desktop-master.jpg");
    const contactMarkup = renderToStaticMarkup(<ContactPageExperience copy={contactContent} />);
    expect(contactMarkup).toContain("page-hero");
    expect(contactMarkup).toContain("has-media");
    expect(contactMarkup).not.toContain("has-brand-bg");
    expect(contactMarkup).toContain("page-hero-img-desktop is-universal");

    // Partners hero
    expect(partnersContent.partnersPage.hero?.image).toBe("/uploads/desktop-master.jpg");
    const partnersMarkup = renderToStaticMarkup(
      <PageHero
        locale="en"
        hero={partnersContent.partnersPage.hero}
        breadcrumbLabel="Our Partners"
        id="top"
        scrollTargetId="#partners-directory"
      />
    );
    expect(partnersMarkup).toContain("page-hero");
    expect(partnersMarkup).toContain("has-media");
    expect(partnersMarkup).not.toContain("has-brand-bg");

    // About hero
    expect(aboutContent.aboutPage.hero?.image).toBe("/uploads/desktop-master.jpg");
    const aboutMarkup = renderToStaticMarkup(
      <PageHero
        locale="en"
        hero={aboutContent.aboutPage.hero}
        breadcrumbLabel="About Us"
        id="top"
        scrollTargetId="#about"
      />
    );
    expect(aboutMarkup).toContain("page-hero");
    expect(aboutMarkup).toContain("has-media");
    expect(aboutMarkup).not.toContain("has-brand-bg");
  });

  it("3. Contact Page hero persists image, video, and presentation presets through saveContactPage", async () => {
    const testImageUrl = "/uploads/test-contact-facade.jpg";
    const testVideoUrl = "/uploads/test-contact-drone.mp4";
    const testPosterUrl = "/uploads/test-contact-poster.jpg";

    const fd = new FormData();
    fd.append("contactHeroEnabled", "on");
    fd.append("contactHeroEyebrowEn", "Get in Touch");
    fd.append("contactHeroEyebrowAr", "تواصل معنا");
    fd.append("contactHeroTitleEn", "Architecture Starts with Dialogue");
    fd.append("contactHeroTitleAr", "العمارة تبدأ بالحوار");
    fd.append("contactHeroBodyEn", "Our advisory directors are ready to discuss your property requirements.");
    fd.append("contactHeroBodyAr", "فريقنا الاستشاري جاهز لمناقشة متطلباتكم العقارية.");
    fd.append("contactHeroCtaLabelEn", "Book Consultation");
    fd.append("contactHeroCtaLabelAr", "احجز استشارة");
    fd.append("contactHeroCtaUrl", "#contact-form");
    fd.append("contactHeroMediaType", "VIDEO");
    fd.append("contactHeroVideoUrl", testVideoUrl);
    fd.append("contactHeroImageUrl", testImageUrl);
    fd.append("contactHeroPosterUrl", testPosterUrl);
    fd.append("contactHeroFocalPoint", "top");
    fd.append("contactHeroMobileMediaType", "IMAGE");
    fd.append("contactHeroMobileImageUrl", testImageUrl);
    fd.append("contactHeroMobileFocalPoint", "center");
    fd.append("contactHeroImageAltEn", "Image Developments Advisory Lounge");
    fd.append("contactHeroImageAltAr", "صالة استشارات إيمدج للتطوير");
    fd.append("contactHeroOverlay", "dark");
    fd.append("contactHeroAlignment", "center");
    fd.append("contactHeroHeight", "fullscreen");

    const res = await saveContactPage({} as any, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("Contact page saved.");

    // Verify database record
    const updated = await prisma.contactPage.findUniqueOrThrow({ where: { id: "contactpage" } });
    expect(updated.heroMediaType).toBe("VIDEO");
    expect(updated.heroVideoUrl).toBe(testVideoUrl);
    expect(updated.heroImageUrl).toBe(testImageUrl);
    expect(updated.heroPosterUrl).toBe(testPosterUrl);
    expect(updated.heroFocalPoint).toBe("top");
    expect(updated.heroMobileMediaType).toBe("IMAGE");
    expect(updated.heroMobileImageUrl).toBe(testImageUrl);
    expect(updated.heroOverlay).toBe("dark");
    expect(updated.heroAlignment).toBe("center");
    expect(updated.heroHeight).toBe("fullscreen");

    // Verify content loader reflects new values
    const content = await getContactPageContent("en");
    expect(content.contactPage.hero?.mediaType).toBe("VIDEO");
    expect(content.contactPage.hero?.videoUrl).toBe(testVideoUrl);
    expect(content.contactPage.hero?.posterUrl).toBe(testPosterUrl);
    expect(content.contactPage.hero?.height).toBe("fullscreen");

    // Verify video markup rendering
    const videoMarkup = renderToStaticMarkup(
      <PageHero
        locale="en"
        hero={content.contactPage.hero}
        breadcrumbLabel="Contact Us"
        id="top"
        scrollTargetId="#contact-form"
      />
    );
    expect(videoMarkup).toContain("page-hero-video-desktop");
    expect(videoMarkup).toContain("<video");
    expect(videoMarkup).toContain(testVideoUrl);
    expect(videoMarkup).toContain(testPosterUrl);
    expect(videoMarkup).toContain("page-hero-img-mobile"); // Mobile image override active

    // Restore clean defaults
    await prisma.contactPage.update({
      where: { id: "contactpage" },
      data: {
        heroMediaType: "IMAGE",
        heroVideoUrl: null,
        heroImageUrl: "/uploads/desktop-master.jpg",
        heroMobileMediaType: "INHERIT",
        heroMobileImageUrl: null,
        heroPosterUrl: null,
        heroFocalPoint: "center",
        heroOverlay: "medium",
        heroAlignment: "start",
        heroHeight: "standard",
      },
    });
  });

  it("4. Team hero persists video and mobile media options through saveTeam", async () => {
    const existingMembers = await prisma.teamMember.findMany({ where: { homepageId: "homepage" } });
    const fd = new FormData();
    fd.append("teamHeroEnabled", "on");
    fd.append("teamEyebrowEn", "Executive Leadership");
    fd.append("teamEyebrowAr", "القيادة التنفيذية");
    fd.append("teamTitleEn", "Visionary Minds Behind Image");
    fd.append("teamTitleAr", "العقول الرائدة وراء إيمدج");
    fd.append("teamIntroEn", "Meet the leadership team shaping architectural excellence.");
    fd.append("teamIntroAr", "تعرف على القيادة التي تصنع التميز المعماري.");
    fd.append("teamHeroCtaLabelEn", "View Team");
    fd.append("teamHeroCtaLabelAr", "عرض الفريق");
    fd.append("teamHeroCtaUrl", "#team-roster");
    fd.append("teamHeroMediaType", "VIDEO");
    fd.append("teamHeroVideoUrl", "/uploads/team-intro.mp4");
    fd.append("teamHeroPosterUrl", "/uploads/desktop-master.jpg");
    fd.append("teamHeroImageUrl", "/uploads/desktop-master.jpg");
    fd.append("teamHeroMobileMediaType", "INHERIT");
    fd.append("teamHeroFocalPoint", "top");
    fd.append("teamHeroOverlay", "subtle");
    fd.append("teamHeroAlignment", "start");
    fd.append("teamHeroHeight", "fullscreen");

    for (const m of existingMembers) {
      fd.append("teamMemberId", m.id);
      fd.append(`teamName_${m.id}En`, m.nameEn);
      fd.append(`teamName_${m.id}Ar`, m.nameAr);
      fd.append(`teamRole_${m.id}En`, m.roleEn);
      fd.append(`teamRole_${m.id}Ar`, m.roleAr);
      fd.append(`teamBio_${m.id}En`, m.bioEn);
      fd.append(`teamBio_${m.id}Ar`, m.bioAr);
      fd.append(`teamImage_${m.id}`, m.imageUrl);
      fd.append(`teamImageAlt_${m.id}En`, m.imageAltEn);
      fd.append(`teamImageAlt_${m.id}Ar`, m.imageAltAr);
      if (m.visible) fd.append(`teamVisible_${m.id}`, "on");
    }

    const res = await saveTeam({} as any, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("Team page saved.");

    const home = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(home.teamHeroMediaType).toBe("VIDEO");
    expect(home.teamHeroVideoUrl).toBe("/uploads/team-intro.mp4");
    expect(home.teamHeroPosterUrl).toBe("/uploads/desktop-master.jpg");
    expect(home.teamHeroHeight).toBe("fullscreen");

    // Restore clean defaults
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        teamHeroMediaType: "IMAGE",
        teamHeroVideoUrl: null,
        teamHeroPosterUrl: null,
        teamHeroImageUrl: "/uploads/desktop-master.jpg",
        teamHeroHeight: "standard",
        teamEyebrowEn: "The people behind Image",
        teamEyebrowAr: "فريق إيمدج",
        teamTitleEn: "Different perspectives. One shared vision.",
        teamTitleAr: "منظورات متعددة. رؤية واحدة مشتركة.",
      },
    });
  });

  it("5. Mode switching preserves existing values without dropping inputs", async () => {
    // Both image and video values should coexist in database so switching back immediately recovers the visual
    const fd = new FormData();
    fd.append("careersHeroEnabled", "on");
    fd.append("careersHeroTitleEn", "Join the Team");
    fd.append("careersHeroTitleAr", "انضم إلى الفريق");
    fd.append("careersHeroIntroEn", "Build enduring destinations with us.");
    fd.append("careersHeroIntroAr", "ابنِ وجهات معمارية خالدة معنا.");
    fd.append("careersHeroMediaType", "IMAGE");
    fd.append("careersHeroImageUrl", "/uploads/desktop-master.jpg");
    fd.append("careersHeroVideoUrl", "/uploads/careers-loop.mp4"); // Preserved in state
    fd.append("careersHeroPosterUrl", "/uploads/desktop-master.jpg");
    fd.append("careersHeroMobileMediaType", "INHERIT");

    const res = await saveCareersPageContent({} as any, fd);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe("Careers page content saved successfully.");

    const home = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
    expect(home.careersHeroImageUrl).toBe("/uploads/desktop-master.jpg");
    expect(home.careersHeroVideoUrl).toBe("/uploads/careers-loop.mp4");
  });
});
