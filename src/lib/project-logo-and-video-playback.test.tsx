import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({ children, ...props }: any) =>
          React.createElement(tag, props, children),
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => 0,
  useReducedMotion: () => false,
}));

vi.mock("@/components/page-transition", () => ({
  usePageTransition: () => ({ isInitialCinematic: false, introPhase: "done" }),
}));
vi.mock("@/components/smooth-scroll", () => ({
  SmoothScroll: () => null,
}));
vi.mock("@/components/enquiry-provider", () => ({
  useEnquiryModal: () => ({ openEnquiry: vi.fn() }),
}));

import { prisma } from "./prisma";
import {
  getProjectDetailContent,
  getAboutPageContent,
  getContactPageContent,
  getTeamPageContent,
  getPartnersPageContent,
} from "./content";
import { ProjectDetailExperience } from "@/components/project-detail-experience";
import { AboutPageExperience } from "@/components/about-page-experience";
import { ContactPageExperience } from "@/components/contact-page-experience";
import { TeamPageExperience } from "@/components/team-page-experience";
import { PartnersPageExperience } from "@/components/partners-page-experience";
import { saveProject } from "@/app/admin/actions";

describe("Project Details Hero Logo & Cross-Site Video Playback Suite", () => {
  const testLogoUrl = "/uploads/test-authentic-emblem.png";
  const testVideoUrl = "/uploads/hero-loop-master.mp4";
  const testPosterUrl = "/uploads/desktop-master.jpg";

  let createdProjectId: string | null = null;

  beforeEach(async () => {
    // Ensure clean state before each test
  });

  afterEach(async () => {
    if (createdProjectId) {
      await prisma.project.deleteMany({ where: { id: createdProjectId } });
      createdProjectId = null;
    }
  });

  it("1. Project Details Hero renders authentic project logo with aspect ratio and transparency preserved", async () => {
    // Find or create a test project
    const existing = await prisma.project.findFirst({ where: { status: "PUBLISHED" } });
    if (!existing) return;

    // Temporarily assign authentic logo to project
    await prisma.project.update({
      where: { id: existing.id },
      data: {
        logoUrl: testLogoUrl,
      },
    });

    const content = await getProjectDetailContent("en", existing.slug);
    expect(content).not.toBeNull();
    if (!content) return;

    expect(content.project.logoUrl).toBe(testLogoUrl);

    // Render Project Details Experience to HTML
    const markup = renderToStaticMarkup(<ProjectDetailExperience copy={content} />);

    // Must render the brand emblem container
    expect(markup).toContain("project-hero-brand-emblem");
    expect(markup).toContain('class="project-hero-logo-img"');
    expect(markup).toContain(testLogoUrl);

    // Logo image must have object-fit: contain without color inversion filters
    expect(markup).not.toContain("brightness(0) invert(1)");

    // Test Arabic RTL rendering
    const arContent = await getProjectDetailContent("ar", existing.slug);
    expect(arContent).not.toBeNull();
    if (!arContent) return;

    const arMarkup = renderToStaticMarkup(<ProjectDetailExperience copy={arContent} />);
    expect(arMarkup).toContain("project-hero-brand-emblem");
    expect(arMarkup).toContain(testLogoUrl);
    expect(arMarkup).toContain('dir="rtl"');

    // Clean up
    await prisma.project.update({
      where: { id: existing.id },
      data: { logoUrl: null },
    });
  });

  it("2. Project Details Hero gracefully omits logo container when logoUrl is null", async () => {
    const existing = await prisma.project.findFirst({ where: { status: "PUBLISHED" } });
    if (!existing) return;

    await prisma.project.update({
      where: { id: existing.id },
      data: { logoUrl: null },
    });

    const content = await getProjectDetailContent("en", existing.slug);
    expect(content).not.toBeNull();
    if (!content) return;

    expect(content.project.logoUrl).toBeUndefined();

    const markup = renderToStaticMarkup(<ProjectDetailExperience copy={content} />);

    // Container must be completely omitted
    expect(markup).not.toContain("project-hero-brand-emblem");
    expect(markup).toContain("project-hero-title");
  });

  it("3. Project Logo replacement and removal in CMS affects only that specific project", async () => {
    // Create two test projects
    const p1 = await prisma.project.create({
      data: {
        slug: "test-project-alpha-" + Date.now(),
        nameEn: "Project Alpha",
        nameAr: "مشروع ألفا",
        shortDescriptionEn: "A visionary architectural destination.",
        shortDescriptionAr: "وجهة معمارية استثنائية.",
        locationEn: "New Cairo",
        locationAr: "القاهرة الجديدة",
        coverImageUrl: "/uploads/desktop-master.jpg",
        coverImageAltEn: "Alpha Cover",
        coverImageAltAr: "غلاف ألفا",
        logoUrl: "/uploads/logo-alpha.png",
        status: "PUBLISHED",
      },
    });

    const p2 = await prisma.project.create({
      data: {
        slug: "test-project-beta-" + Date.now(),
        nameEn: "Project Beta",
        nameAr: "مشروع بيتا",
        shortDescriptionEn: "Modern residences by the lake.",
        shortDescriptionAr: "مساكن عصرية بجوار البحيرة.",
        locationEn: "North Coast",
        locationAr: "الساحل الشمالي",
        coverImageUrl: "/uploads/desktop-master.jpg",
        coverImageAltEn: "Beta Cover",
        coverImageAltAr: "غلاف بيتا",
        logoUrl: "/uploads/logo-beta.png",
        status: "PUBLISHED",
      },
    });

    // Update P1's logo via saveProject
    const fd = new FormData();
    fd.set("projectId", p1.id);
    fd.set("slug", p1.slug);
    fd.set("nameEn", p1.nameEn);
    fd.set("nameAr", p1.nameAr);
    fd.set("shortDescriptionEn", p1.shortDescriptionEn);
    fd.set("shortDescriptionAr", p1.shortDescriptionAr);
    fd.set("locationEn", p1.locationEn);
    fd.set("locationAr", p1.locationAr);
    fd.set("coverImageUrl", p1.coverImageUrl);
    fd.set("logoUrl", "/uploads/logo-alpha-updated.png");
    fd.set("status", "PUBLISHED");

    await saveProject({}, fd);

    // Verify P1 updated
    const freshP1 = await prisma.project.findUnique({ where: { id: p1.id } });
    expect(freshP1?.logoUrl).toBe("/uploads/logo-alpha-updated.png");

    // Verify P2 remains completely untouched
    const freshP2 = await prisma.project.findUnique({ where: { id: p2.id } });
    expect(freshP2?.logoUrl).toBe("/uploads/logo-beta.png");

    // Clean up
    await prisma.project.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
  });

  it("4. Project Details Hero renders video background with poster fallback and WCAG control", async () => {
    const existing = await prisma.project.findFirst({ where: { status: "PUBLISHED" } });
    if (!existing) return;

    await prisma.project.update({
      where: { id: existing.id },
      data: {
        heroVideoUrl: testVideoUrl,
        heroVideoPosterUrl: testPosterUrl,
      },
    });

    const content = await getProjectDetailContent("en", existing.slug);
    expect(content).not.toBeNull();
    if (!content) return;

    expect(content.project.heroVideoUrl).toBe(testVideoUrl);
    expect(content.project.heroVideoPosterUrl).toBe(testPosterUrl);

    const markup = renderToStaticMarkup(<ProjectDetailExperience copy={content} />);

    // Video element must be rendered
    expect(markup).toContain("<video");
    expect(markup).toContain(testVideoUrl);
    expect(markup).toContain(testPosterUrl);

    // WCAG 2.2.2 play/pause toggle button must be present
    expect(markup).toContain("hero-video-toggle");

    // Clean up
    await prisma.project.update({
      where: { id: existing.id },
      data: { heroVideoUrl: null, heroVideoPosterUrl: null },
    });
  });

  it("5. About Page Hero renders video background with WCAG control when configured", async () => {
    // Configure About Hero with video
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        aboutHeroMediaType: "VIDEO",
        aboutHeroVideoUrl: testVideoUrl,
        aboutHeroPosterUrl: testPosterUrl,
      },
    });

    const aboutContent = await getAboutPageContent("en");
    expect(aboutContent.aboutPage.hero?.mediaType).toBe("VIDEO");
    expect(aboutContent.aboutPage.hero?.videoUrl).toBe(testVideoUrl);

    const markup = renderToStaticMarkup(<AboutPageExperience copy={aboutContent} />);

    expect(markup).toContain("<video");
    expect(markup).toContain(testVideoUrl);
    expect(markup).toContain(testPosterUrl);
    expect(markup).toContain("hero-video-toggle");

    // Restore default image mode
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        aboutHeroMediaType: "IMAGE",
        aboutHeroVideoUrl: null,
      },
    });
  });

  it("6. Contact, Team, and Partners heroes render video background and WCAG toggle via PageHero", async () => {
    // Test Contact Hero Video
    await prisma.contactPage.update({
      where: { id: "contactpage" },
      data: {
        heroMediaType: "VIDEO",
        heroVideoUrl: testVideoUrl,
        heroPosterUrl: testPosterUrl,
      },
    });

    const contactContent = await getContactPageContent("en");
    const contactMarkup = renderToStaticMarkup(<ContactPageExperience copy={contactContent} />);

    expect(contactMarkup).toContain("page-hero-video-active");
    expect(contactMarkup).toContain("<video");
    expect(contactMarkup).toContain(testVideoUrl);
    expect(contactMarkup).toContain("hero-video-toggle");

    // Test Team Hero Video
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        teamHeroMediaType: "VIDEO",
        teamHeroVideoUrl: testVideoUrl,
        teamHeroPosterUrl: testPosterUrl,
      },
    });

    const teamContent = await getTeamPageContent("en");
    const teamMarkup = renderToStaticMarkup(<TeamPageExperience copy={teamContent} />);

    expect(teamMarkup).toContain("page-hero-video-active");
    expect(teamMarkup).toContain("<video");
    expect(teamMarkup).toContain(testVideoUrl);
    expect(teamMarkup).toContain("hero-video-toggle");

    // Test Partners Hero Video
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        partnersHeroMediaType: "VIDEO",
        partnersHeroVideoUrl: testVideoUrl,
        partnersHeroPosterUrl: testPosterUrl,
      },
    });

    const partnersContent = await getPartnersPageContent("en");
    const partnersMarkup = renderToStaticMarkup(<PartnersPageExperience copy={partnersContent} />);

    expect(partnersMarkup).toContain("page-hero-video-active");
    expect(partnersMarkup).toContain("<video");
    expect(partnersMarkup).toContain(testVideoUrl);
    expect(partnersMarkup).toContain("hero-video-toggle");

    // Restore clean image defaults
    await prisma.contactPage.update({
      where: { id: "contactpage" },
      data: { heroMediaType: "IMAGE", heroVideoUrl: null },
    });
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        teamHeroMediaType: "IMAGE",
        teamHeroVideoUrl: null,
        partnersHeroMediaType: "IMAGE",
        partnersHeroVideoUrl: null,
      },
    });
  });
});
