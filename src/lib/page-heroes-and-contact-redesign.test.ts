import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";

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
import { saveTeam, savePartners, saveContactPage } from "@/app/admin/actions";
import { submitContact } from "@/app/actions";
import { getTeamPageContent, getPartnersPageContent, getContactPageContent } from "@/lib/content";

function appendTeamMemberFields(fd: FormData) {
  fd.append("teamMemberId", "team-karim");
  fd.set("teamName_team-karimEn", "Karim Mansour");
  fd.set("teamName_team-karimAr", "كريم منصور");
  fd.set("teamRole_team-karimEn", "Founder & Chief Executive Officer");
  fd.set("teamRole_team-karimAr", "المؤسس والرئيس التنفيذي");
  fd.set("teamBio_team-karimEn", "Leading strategic vision with over twenty years of experience.");
  fd.set("teamBio_team-karimAr", "يقود الرؤية الاستراتيجية بخبرة تزيد عن عشرين عاماً.");
  fd.set("teamImage_team-karim", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=85");
  fd.set("teamImageAlt_team-karimEn", "Karim Mansour");
  fd.set("teamImageAlt_team-karimAr", "كريم منصور");
  fd.set("teamVisible_team-karim", "on");
}

function appendPartnerFields(fd: FormData) {
  fd.append("partnerId", "partner-foster");
  fd.set("partnerName_partner-fosterEn", "Foster + Partners");
  fd.set("partnerName_partner-fosterAr", "فوستر آند بارتنرز");
  fd.set("partnerDescription_partner-fosterEn", "International architecture practice.");
  fd.set("partnerDescription_partner-fosterAr", "مؤسسة معمارية عالمية.");
  fd.set("partnerLogo_partner-foster", "/partners/foster-partners.svg");
  fd.set("partnerLogoAlt_partner-fosterEn", "Foster + Partners");
  fd.set("partnerLogoAlt_partner-fosterAr", "فوستر آند بارتنرز");
  fd.set("partnerWebsite_partner-foster", "https://www.fosterandpartners.com");
  fd.set("partnerVisible_partner-foster", "on");
}

describe("Page Heroes & Contact Redesign Integration Suite", { timeout: 30000 }, () => {
  let originalHomepage: any = null;
  let originalContactPage: any = null;

  beforeAll(async () => {
    originalHomepage = await prisma.homepage.findUnique({ where: { id: "homepage" } });
    originalContactPage = await prisma.contactPage.findUnique({ where: { id: "contactpage" } });
  });

  afterAll(async () => {
    if (originalHomepage) {
      const defaultTeamHero = "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2400&q=88";
      const defaultPartnersHero = "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=2400&q=88";
      const teamImg = originalHomepage.teamHeroImageUrl && !originalHomepage.teamHeroImageUrl.includes("screenshot")
        ? originalHomepage.teamHeroImageUrl
        : defaultTeamHero;
      const partImg = originalHomepage.partnersHeroImageUrl || defaultPartnersHero;

      await prisma.homepage.update({
        where: { id: "homepage" },
        data: {
          teamHeroEnabled: originalHomepage.teamHeroEnabled ?? true,
          teamEyebrowEn: originalHomepage.teamEyebrowEn,
          teamEyebrowAr: originalHomepage.teamEyebrowAr,
          teamTitleEn: originalHomepage.teamTitleEn,
          teamTitleAr: originalHomepage.teamTitleAr,
          teamIntroEn: originalHomepage.teamIntroEn,
          teamIntroAr: originalHomepage.teamIntroAr,
          teamHeroImageUrl: teamImg,
          teamHeroMobileImageUrl: originalHomepage.teamHeroMobileImageUrl,
          teamHeroFocalPoint: originalHomepage.teamHeroFocalPoint,
          teamHeroMobileFocalPoint: originalHomepage.teamHeroMobileFocalPoint,
          teamHeroImageAltEn: originalHomepage.teamHeroImageAltEn,
          teamHeroImageAltAr: originalHomepage.teamHeroImageAltAr,
          teamHeroOverlay: originalHomepage.teamHeroOverlay,
          teamHeroAlignment: originalHomepage.teamHeroAlignment,
          teamHeroHeight: originalHomepage.teamHeroHeight,
          teamHeroCtaLabelEn: originalHomepage.teamHeroCtaLabelEn,
          teamHeroCtaLabelAr: originalHomepage.teamHeroCtaLabelAr,
          teamHeroCtaUrl: originalHomepage.teamHeroCtaUrl,

          partnersHeroEnabled: originalHomepage.partnersHeroEnabled ?? true,
          partnersEyebrowEn: originalHomepage.partnersEyebrowEn,
          partnersEyebrowAr: originalHomepage.partnersEyebrowAr,
          partnersTitleEn: originalHomepage.partnersTitleEn,
          partnersTitleAr: originalHomepage.partnersTitleAr,
          partnersIntroEn: originalHomepage.partnersIntroEn,
          partnersIntroAr: originalHomepage.partnersIntroAr,
          partnersHeroImageUrl: partImg,
          partnersHeroMobileImageUrl: originalHomepage.partnersHeroMobileImageUrl,
          partnersHeroFocalPoint: originalHomepage.partnersHeroFocalPoint,
          partnersHeroMobileFocalPoint: originalHomepage.partnersHeroMobileFocalPoint,
          partnersHeroImageAltEn: originalHomepage.partnersHeroImageAltEn,
          partnersHeroImageAltAr: originalHomepage.partnersHeroImageAltAr,
          partnersHeroOverlay: originalHomepage.partnersHeroOverlay,
          partnersHeroAlignment: originalHomepage.partnersHeroAlignment,
          partnersHeroHeight: originalHomepage.partnersHeroHeight,
          partnersHeroCtaLabelEn: originalHomepage.partnersHeroCtaLabelEn,
          partnersHeroCtaLabelAr: originalHomepage.partnersHeroCtaLabelAr,
          partnersHeroCtaUrl: originalHomepage.partnersHeroCtaUrl,
        },
      });
    }
    if (originalContactPage) {
      const defaultContactHero = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=88";
      await prisma.contactPage.update({
        where: { id: "contactpage" },
        data: {
          heroEnabled: originalContactPage.heroEnabled ?? true,
          heroEyebrowEn: originalContactPage.heroEyebrowEn,
          heroEyebrowAr: originalContactPage.heroEyebrowAr,
          heroTitleEn: originalContactPage.heroTitleEn,
          heroTitleAr: originalContactPage.heroTitleAr,
          heroBodyEn: originalContactPage.heroBodyEn,
          heroBodyAr: originalContactPage.heroBodyAr,
          heroImageUrl: originalContactPage.heroImageUrl || defaultContactHero,
          heroMobileImageUrl: originalContactPage.heroMobileImageUrl,
          heroFocalPoint: originalContactPage.heroFocalPoint,
          heroMobileFocalPoint: originalContactPage.heroMobileFocalPoint,
          heroImageAltEn: originalContactPage.heroImageAltEn,
          heroImageAltAr: originalContactPage.heroImageAltAr,
          heroOverlay: originalContactPage.heroOverlay,
          heroAlignment: originalContactPage.heroAlignment,
          heroHeight: originalContactPage.heroHeight,
          heroCtaLabelEn: originalContactPage.heroCtaLabelEn,
          heroCtaLabelAr: originalContactPage.heroCtaLabelAr,
          heroCtaUrl: originalContactPage.heroCtaUrl,
        },
      });
    }

    const teamMembers = [
      { id: "team-karim", nameEn: "Karim Mansour", nameAr: "كريم منصور", roleEn: "Founder & Chief Executive Officer", roleAr: "المؤسس والرئيس التنفيذي", bioEn: "Leading the strategic vision of Image Developments with over twenty years of experience creating landmark architectural destinations.", bioAr: "يقود الرؤية الاستراتيجية لشركة إيمدج للتطوير العقاري بخبرة تزيد عن عشرين عاماً في ابتكار وجهات معمارية رائدة.", imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=85", imageAltEn: "Karim Mansour, Founder & CEO", imageAltAr: "كريم منصور، المؤسس والرئيس التنفيذي", visible: true, sortOrder: 0, homepageId: "homepage" },
      { id: "team-layla", nameEn: "Layla El-Sayed", nameAr: "ليلى السيد", roleEn: "Head of Architecture & Design", roleAr: "رئيسة قطاع العمارة والتصميم", bioEn: "Directing design integrity across all masterplans, ensuring seamless harmony between built spaces and natural landscapes.", bioAr: "تشرف على جودة التصميم في جميع المخططات العامة، لضمان التناغم التام بين المساحات المبنية والمناظر الطبيعية.", imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=85", imageAltEn: "Layla El-Sayed, Head of Architecture & Design", imageAltAr: "ليلى السيد، رئيسة قطاع العمارة والتصميم", visible: true, sortOrder: 1, homepageId: "homepage" },
      { id: "team-tarek", nameEn: "Tarek Fahmy", nameAr: "طارق فهمي", roleEn: "Chief Development Officer", roleAr: "رئيس قطاع التطوير", bioEn: "Overseeing portfolio delivery, sustainable infrastructure, and execution standards from ground breaking to handover.", bioAr: "يشرف على تسليم المشروعات، والبنية التحتية المستدامة، ومعايير التنفيذ الدقيقة من التأسيس حتى التسليم.", imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=85", imageAltEn: "Tarek Fahmy, Chief Development Officer", imageAltAr: "طارق فهمي، رئيس قطاع التطوير", visible: true, sortOrder: 2, homepageId: "homepage" },
      { id: "team-nouran", nameEn: "Nouran El-Gendy", nameAr: "نوران الجندي", roleEn: "Director of Community & Client Experience", roleAr: "مديرة تجربة العملاء والمجتمعات", bioEn: "Shaping human-centred services and enduring community programming across every Image residential destination.", bioAr: "تصيغ خدمات متكاملة تركز على الإنسان وبرامج مجتمعية مستدامة في جميع وجهات إيمدج السكنية.", imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=1200&q=85", imageAltEn: "Nouran El-Gendy, Director of Community & Client Experience", imageAltAr: "نوران الجندي، مديرة تجربة العملاء والمجتمعات", visible: true, sortOrder: 3, homepageId: "homepage" }
    ];
    for (const m of teamMembers) await prisma.teamMember.upsert({ where: { id: m.id }, update: m, create: m });

    const partners = [
      { id: "partner-foster", nameEn: "Foster + Partners", nameAr: "فوستر آند بارتنرز", descriptionEn: "International architecture, planning and design practice leading landmark masterplans.", descriptionAr: "مؤسسة معمارية وتخطيطية عالمية رائدة في وضع المخططات العمرانية الاستثنائية.", logoUrl: "/partners/foster-partners.svg", logoAltEn: "Foster + Partners Architecture", logoAltAr: "فوستر آند بارتنرز للعمارة والتخطيط", websiteUrl: "https://www.fosterandpartners.com", visible: true, sortOrder: 0, homepageId: "homepage" },
      { id: "partner-edsa", nameEn: "EDSA", nameAr: "إي دي إس إيه", descriptionEn: "Global planning, landscape architecture, and urban design consultancy creating resilient environments.", descriptionAr: "استشارات عالمية رائدة في التخطيط العمراني وتنسيق المناظر الطبيعية المستدامة.", logoUrl: "/partners/edsa.svg", logoAltEn: "EDSA Planning & Landscape", logoAltAr: "إي دي إس إيه لتنسيق المواقع والتخطيط", websiteUrl: "https://www.edsaplan.com", visible: true, sortOrder: 1, homepageId: "homepage" },
      { id: "partner-dar", nameEn: "Dar Al-Handasah", nameAr: "دار الهندسة", descriptionEn: "Premier multidisciplinary engineering consultancy providing world-class infrastructure solutions.", descriptionAr: "استشارات هندسية عالمية متكاملة تقدم أرقى حلول البنية التحتية والإنشاءات.", logoUrl: "/partners/dar.svg", logoAltEn: "Dar Al-Handasah Consultants", logoAltAr: "دار الهندسة للاستشارات", websiteUrl: "https://www.dar.com", visible: true, sortOrder: 2, homepageId: "homepage" },
      { id: "partner-keo", nameEn: "KEO International Consultants", nameAr: "كيو العالمية للاستشارات", descriptionEn: "Leading design and project management firm shaping landmark destinations across the region.", descriptionAr: "شركة دولية رائدة في التصميم وإدارة المشروعات الكبرى في المنطقة.", logoUrl: "/partners/keo.svg", logoAltEn: "KEO International Consultants", logoAltAr: "كيو العالمية للاستشارات الهندسية", websiteUrl: "https://www.keoic.com", visible: true, sortOrder: 3, homepageId: "homepage" }
    ];
    for (const p of partners) await prisma.partner.upsert({ where: { id: p.id }, update: p, create: p });
  });

  beforeEach(async () => {
    // Ensure Homepage and ContactPage exist with baseline clean states
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        teamHeroEnabled: true,
        teamEyebrowEn: "The people behind Image",
        teamEyebrowAr: "فريق إيمدج",
        teamTitleEn: "Different perspectives. One shared vision.",
        teamTitleAr: "منظورات متعددة. رؤية واحدة مشتركة.",
        teamIntroEn: "Meet the people shaping thoughtful places for how Egypt lives next.",
        teamIntroAr: "تعرف على الأشخاص الذين يصنعون أماكن مدروسة لمستقبل الحياة في مصر.",
        teamHeroImageUrl: null,
        teamHeroMobileImageUrl: null,
        teamHeroOverlay: "medium",
        teamHeroAlignment: "start",
        teamHeroHeight: "standard",
        teamHeroCtaLabelEn: "Meet the Team",
        teamHeroCtaLabelAr: "تعرف على الفريق",
        teamHeroCtaUrl: "#team-roster",

        partnersHeroEnabled: true,
        partnersEyebrowEn: "Our partners",
        partnersEyebrowAr: "شركاؤنا",
        partnersTitleEn: "Built together. Made to last.",
        partnersTitleAr: "نبني معاً. لنصنع أثراً يدوم.",
        partnersIntroEn: "Thoughtful collaborations that create places with lasting value.",
        partnersIntroAr: "شراكات مدروسة تصنع أماكن ذات قيمة دائمة.",
        partnersHeroImageUrl: null,
        partnersHeroMobileImageUrl: null,
        partnersHeroOverlay: "medium",
        partnersHeroAlignment: "start",
        partnersHeroHeight: "standard",
        partnersHeroCtaLabelEn: "Explore Partners",
        partnersHeroCtaLabelAr: "استكشف الشركاء",
        partnersHeroCtaUrl: "#partners-directory",
      },
    });

    await prisma.contactPage.update({
      where: { id: "contactpage" },
      data: {
        heroEnabled: true,
        heroEyebrowEn: "Contact Us",
        heroEyebrowAr: "تواصل معنا",
        heroTitleEn: "Start a Conversation",
        heroTitleAr: "ابدأ حواراً معنا",
        heroBodyEn: "Tell us how we can help and our advisory team will connect with you.",
        heroBodyAr: "أخبرنا كيف يمكننا مساعدتك وسيتواصل معك فريقنا الاستشاري.",
        heroImageUrl: null,
        heroMobileImageUrl: null,
        heroOverlay: "medium",
        heroAlignment: "start",
        heroHeight: "standard",
        heroCtaLabelEn: "Send an Inquiry",
        heroCtaLabelAr: "أرسل استفسارك",
        heroCtaUrl: "#contact-form",
      },
    });
  });

  describe("1. Team Page Hero CMS Persistence & Loader", () => {
    it("persists all Team hero fields and loads them via getTeamPageContent", async () => {
      const formData = new FormData();
      formData.set("teamHeroEnabled", "on");
      formData.set("teamEyebrowEn", "Executive Leadership");
      formData.set("teamEyebrowAr", "القيادة التنفيذية");
      formData.set("teamTitleEn", "Architects of Progress");
      formData.set("teamTitleAr", "مهندسو التطور والريادة");
      formData.set("teamIntroEn", "Experienced industry pioneers guiding tomorrow's iconic developments.");
      formData.set("teamIntroAr", "رواد متخصصون في توجيه مشاريع الغد الاستثنائية.");
      formData.set("teamHeroImageUrl", "/uploads/team-desktop-flagship.webp");
      formData.set("teamHeroMobileImageUrl", "/uploads/team-mobile-flagship.webp");
      formData.set("teamHeroFocalPoint", "center 30%");
      formData.set("teamHeroMobileFocalPoint", "center 40%");
      formData.set("teamHeroImageAltEn", "Image Developments Executive Team");
      formData.set("teamHeroImageAltAr", "الفريق التنفيذي لإيمدج للتطوير");
      formData.set("teamHeroOverlay", "dark");
      formData.set("teamHeroAlignment", "center");
      formData.set("teamHeroHeight", "large");
      formData.set("teamHeroCtaLabelEn", "View Roster");
      formData.set("teamHeroCtaLabelAr", "شاهد الفريق");
      formData.set("teamHeroCtaUrl", "#team-roster");
      appendTeamMemberFields(formData);

      const res = await saveTeam({ status: "idle" }, formData);
      expect(res.error).toBeUndefined();
      expect(res.success).toBe("Team page saved.");

      const loadedEn = await getTeamPageContent("en");
      expect(loadedEn.teamPage.hero).toBeDefined();
      expect(loadedEn.teamPage.hero?.enabled).toBe(true);
      expect(loadedEn.teamPage.hero?.eyebrow).toBe("Executive Leadership");
      expect(loadedEn.teamPage.hero?.title).toBe("Architects of Progress");
      expect(loadedEn.teamPage.hero?.body).toBe("Experienced industry pioneers guiding tomorrow's iconic developments.");
      expect(loadedEn.teamPage.hero?.image).toBe("/uploads/team-desktop-flagship.webp");
      expect(loadedEn.teamPage.hero?.mobileImage).toBe("/uploads/team-mobile-flagship.webp");
      expect(loadedEn.teamPage.hero?.focalPoint).toBe("center 30%");
      expect(loadedEn.teamPage.hero?.mobileFocalPoint).toBe("center 40%");
      expect(loadedEn.teamPage.hero?.alt).toBe("Image Developments Executive Team");
      expect(loadedEn.teamPage.hero?.overlay).toBe("dark");
      expect(loadedEn.teamPage.hero?.alignment).toBe("center");
      expect(loadedEn.teamPage.hero?.height).toBe("large");
      expect(loadedEn.teamPage.hero?.ctaLabel).toBe("View Roster");
      expect(loadedEn.teamPage.hero?.ctaUrl).toBe("#team-roster");

      const loadedAr = await getTeamPageContent("ar");
      expect(loadedAr.teamPage.hero?.eyebrow).toBe("القيادة التنفيذية");
      expect(loadedAr.teamPage.hero?.title).toBe("مهندسو التطور والريادة");
      expect(loadedAr.teamPage.hero?.alt).toBe("الفريق التنفيذي لإيمدج للتطوير");
      expect(loadedAr.teamPage.hero?.ctaLabel).toBe("شاهد الفريق");
    });
  });

  describe("2. Partners Page Hero CMS Persistence & Loader", () => {
    it("persists all Partners hero fields and loads them via getPartnersPageContent", async () => {
      const formData = new FormData();
      formData.set("partnersHeroEnabled", "on");
      formData.set("partnersEyebrowEn", "Strategic Alliances");
      formData.set("partnersEyebrowAr", "تحالفات استراتيجية");
      formData.set("partnersTitleEn", "Synergy in Development");
      formData.set("partnersTitleAr", "تكامل وتناغم في التطوير");
      formData.set("partnersIntroEn", "Collaborating with world-class engineering, design, and management institutions.");
      formData.set("partnersIntroAr", "شراكات مع أرقى بيوت الخبرة الهندسية والتصميمية العالمية.");
      formData.set("partnersHeroImageUrl", "/uploads/partners-desktop.webp");
      formData.set("partnersHeroMobileImageUrl", "/uploads/partners-mobile.webp");
      formData.set("partnersHeroFocalPoint", "top center");
      formData.set("partnersHeroMobileFocalPoint", "center");
      formData.set("partnersHeroImageAltEn", "Collaborative architectural partner firms");
      formData.set("partnersHeroImageAltAr", "بيوت الخبرة والشركاء الهندسيين");
      formData.set("partnersHeroOverlay", "subtle");
      formData.set("partnersHeroAlignment", "start");
      formData.set("partnersHeroHeight", "compact");
      formData.set("partnersHeroCtaLabelEn", "Our Network");
      formData.set("partnersHeroCtaLabelAr", "شبكة شركائنا");
      formData.set("partnersHeroCtaUrl", "#partners-directory");
      appendPartnerFields(formData);

      const res = await savePartners({ status: "idle" }, formData);
      expect(res.error).toBeUndefined();
      expect(res.success).toBe("Partners page saved.");

      const loadedEn = await getPartnersPageContent("en");
      expect(loadedEn.partnersPage.hero).toBeDefined();
      expect(loadedEn.partnersPage.hero?.enabled).toBe(true);
      expect(loadedEn.partnersPage.hero?.eyebrow).toBe("Strategic Alliances");
      expect(loadedEn.partnersPage.hero?.title).toBe("Synergy in Development");
      expect(loadedEn.partnersPage.hero?.image).toBe("/uploads/partners-desktop.webp");
      expect(loadedEn.partnersPage.hero?.mobileImage).toBe("/uploads/partners-mobile.webp");
      expect(loadedEn.partnersPage.hero?.focalPoint).toBe("top center");
      expect(loadedEn.partnersPage.hero?.overlay).toBe("subtle");
      expect(loadedEn.partnersPage.hero?.height).toBe("compact");
      expect(loadedEn.partnersPage.hero?.ctaLabel).toBe("Our Network");

      const loadedAr = await getPartnersPageContent("ar");
      expect(loadedAr.partnersPage.hero?.eyebrow).toBe("تحالفات استراتيجية");
      expect(loadedAr.partnersPage.hero?.title).toBe("تكامل وتناغم في التطوير");
      expect(loadedAr.partnersPage.hero?.ctaLabel).toBe("شبكة شركائنا");
    });
  });

  describe("3. Contact Page Hero CMS Persistence & Loader", () => {
    it("persists Contact hero fields and loads them via getContactPageContent", async () => {
      const formData = new FormData();
      formData.set("contactHeroEnabled", "on");
      formData.set("contactHeroEyebrowEn", "Direct Inquiries");
      formData.set("contactHeroEyebrowAr", "استفسارات مباشرة");
      formData.set("contactHeroTitleEn", "Connect with Image Advisory");
      formData.set("contactHeroTitleAr", "تواصل مع الاستشارات العقارية");
      formData.set("contactHeroBodyEn", "Our residential and investment specialists are at your service.");
      formData.set("contactHeroBodyAr", "خبراء الاستثمار والمشاريع السكنية في خدمتكم دائماً.");
      formData.set("contactHeroImageUrl", "/uploads/contact-hero-hq.webp");
      formData.set("contactHeroMobileImageUrl", "/uploads/contact-hero-hq-mobile.webp");
      formData.set("contactHeroFocalPoint", "center 20%");
      formData.set("contactHeroMobileFocalPoint", "center 30%");
      formData.set("contactHeroImageAltEn", "Image Developments Headquarters Reception");
      formData.set("contactHeroImageAltAr", "استقبال المقر الرئيسي لإيمدج للتطوير");
      formData.set("contactHeroOverlay", "dark");
      formData.set("contactHeroAlignment", "start");
      formData.set("contactHeroHeight", "standard");
      formData.set("contactHeroCtaLabelEn", "Leave an Inquiry");
      formData.set("contactHeroCtaLabelAr", "أرسل استفسارك");
      formData.set("contactHeroCtaUrl", "#contact-form");

      const res = await saveContactPage({ status: "idle" }, formData);
      expect(res.error).toBeUndefined();
      expect(res.success).toBe("Contact page saved.");

      const loadedEn = await getContactPageContent("en");
      expect(loadedEn.contactPage.hero).toBeDefined();
      expect(loadedEn.contactPage.hero?.enabled).toBe(true);
      expect(loadedEn.contactPage.hero?.eyebrow).toBe("Direct Inquiries");
      expect(loadedEn.contactPage.hero?.title).toBe("Connect with Image Advisory");
      expect(loadedEn.contactPage.hero?.image).toBe("/uploads/contact-hero-hq.webp");
      expect(loadedEn.contactPage.hero?.mobileImage).toBe("/uploads/contact-hero-hq-mobile.webp");
      expect(loadedEn.contactPage.hero?.overlay).toBe("dark");
      expect(loadedEn.contactPage.hero?.height).toBe("standard");
      expect(loadedEn.contactPage.hero?.ctaLabel).toBe("Leave an Inquiry");
      expect(loadedEn.contactPage.hero?.ctaUrl).toBe("#contact-form");

      const loadedAr = await getContactPageContent("ar");
      expect(loadedAr.contactPage.hero?.eyebrow).toBe("استفسارات مباشرة");
      expect(loadedAr.contactPage.hero?.title).toBe("تواصل مع الاستشارات العقارية");
      expect(loadedAr.contactPage.hero?.ctaLabel).toBe("أرسل استفسارك");
    });
  });

  describe("4. Page Hero Configuration Independence & Strict Isolation", () => {
    it("guarantees updating Team hero never modifies Partners hero or Contact hero", async () => {
      // Setup distinct baseline values
      await prisma.homepage.update({
        where: { id: "homepage" },
        data: {
          teamTitleEn: "Initial Team Title",
          partnersTitleEn: "Partners Title Baseline",
        },
      });
      await prisma.contactPage.update({
        where: { id: "contactpage" },
        data: {
          heroTitleEn: "Contact Title Baseline",
        },
      });

      // Update Team hero only
      const teamForm = new FormData();
      teamForm.set("teamHeroEnabled", "on");
      teamForm.set("teamEyebrowEn", "New Team Eyebrow");
      teamForm.set("teamEyebrowAr", "جديد الفريق");
      teamForm.set("teamTitleEn", "Brand New Team Heading");
      teamForm.set("teamTitleAr", "عنوان فريق جديد");
      teamForm.set("teamIntroEn", "Updated intro narrative for team.");
      teamForm.set("teamIntroAr", "مقدمة محدثة للفريق.");
      teamForm.set("teamHeroImageUrl", "/uploads/new-team.webp");
      appendTeamMemberFields(teamForm);

      await saveTeam({ status: "idle" }, teamForm);

      // Verify Partners and Contact heroes remained completely untouched
      const homeAfter = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
      const contactAfter = await prisma.contactPage.findUniqueOrThrow({ where: { id: "contactpage" } });

      expect(homeAfter.teamTitleEn).toBe("Brand New Team Heading");
      expect(homeAfter.teamHeroImageUrl).toBe("/uploads/new-team.webp");
      // Partners unchanged
      expect(homeAfter.partnersTitleEn).toBe("Partners Title Baseline");
      // Contact unchanged
      expect(contactAfter.heroTitleEn).toBe("Contact Title Baseline");
    });

    it("guarantees updating Contact hero never modifies Team or Partners heroes", async () => {
      const contactForm = new FormData();
      contactForm.set("contactHeroEnabled", "on");
      contactForm.set("contactHeroEyebrowEn", "Unique Contact Eyebrow");
      contactForm.set("contactHeroEyebrowAr", "حاجب تواصل فريد");
      contactForm.set("contactHeroTitleEn", "Unique Contact Heading");
      contactForm.set("contactHeroTitleAr", "عنوان تواصل فريد");
      contactForm.set("contactHeroBodyEn", "Unique contact body.");
      contactForm.set("contactHeroBodyAr", "نص تواصل فريد.");
      contactForm.set("contactHeroImageUrl", "/uploads/contact-isolated.webp");

      await saveContactPage({ status: "idle" }, contactForm);

      const contactAfter = await prisma.contactPage.findUniqueOrThrow({ where: { id: "contactpage" } });
      const homeAfter = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });

      expect(contactAfter.heroTitleEn).toBe("Unique Contact Heading");
      expect(contactAfter.heroImageUrl).toBe("/uploads/contact-isolated.webp");
      // Team and Partners remained intact
      expect(homeAfter.teamTitleEn).not.toBe("Unique Contact Heading");
      expect(homeAfter.partnersTitleEn).not.toBe("Unique Contact Heading");
    });
  });

  describe("5. Desktop Fallback & Mobile Override Logic", () => {
    it("uses desktop image when mobile image is omitted, and restores fallback upon mobile removal without deleting desktop image", async () => {
      // Step A: Set desktop image with mobile image override
      const stepAForm = new FormData();
      stepAForm.set("teamHeroEnabled", "on");
      stepAForm.set("teamEyebrowEn", "Team");
      stepAForm.set("teamEyebrowAr", "الفريق");
      stepAForm.set("teamTitleEn", "Team Title");
      stepAForm.set("teamTitleAr", "عنوان الفريق");
      stepAForm.set("teamIntroEn", "Intro");
      stepAForm.set("teamIntroAr", "المقدمة");
      stepAForm.set("teamHeroImageUrl", "/uploads/permanent-desktop-asset.webp");
      stepAForm.set("teamHeroMobileImageUrl", "/uploads/temporary-mobile-override.webp");
      appendTeamMemberFields(stepAForm);

      await saveTeam({ status: "idle" }, stepAForm);

      let content = await getTeamPageContent("en");
      expect(content.teamPage.hero?.image).toBe("/uploads/permanent-desktop-asset.webp");
      expect(content.teamPage.hero?.mobileImage).toBe("/uploads/temporary-mobile-override.webp");

      // Step B: Remove mobile image override (empty string)
      const stepBForm = new FormData();
      stepBForm.set("teamHeroEnabled", "on");
      stepBForm.set("teamEyebrowEn", "Team");
      stepBForm.set("teamEyebrowAr", "الفريق");
      stepBForm.set("teamTitleEn", "Team Title");
      stepBForm.set("teamTitleAr", "عنوان الفريق");
      stepBForm.set("teamIntroEn", "Intro");
      stepBForm.set("teamIntroAr", "المقدمة");
      stepBForm.set("teamHeroImageUrl", "/uploads/permanent-desktop-asset.webp");
      stepBForm.set("teamHeroMobileImageUrl", ""); // Cleared mobile override
      appendTeamMemberFields(stepBForm);

      await saveTeam({ status: "idle" }, stepBForm);

      content = await getTeamPageContent("en");
      // Desktop image is preserved intact
      expect(content.teamPage.hero?.image).toBe("/uploads/permanent-desktop-asset.webp");
      // Mobile override is undefined, ensuring public PageHero uses desktop fallback across all viewports
      expect(content.teamPage.hero?.mobileImage).toBeUndefined();
    });
  });

  describe("6. Inquiry Workflow on Redesigned Contact Page", () => {
    it("successfully submits an inquiry originating from contact-page with Name + Phone and optional Email", async () => {
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const formData = new FormData();
      formData.set("name", `Inquiry Lead ${uniqueSuffix}`);
      formData.set("countryCode", "EG:+20");
      formData.set("phone", `109${Math.floor(1000000 + Math.random() * 9000000)}`);
      formData.set("email", `investor_${uniqueSuffix}@example.com`);
      formData.set("project", "West Cairo Commercial Park");
      formData.set("message", "Requesting brochure and floor plans for retail unit.");
      formData.set("consent", "on");
      formData.set("locale", "en");
      formData.set("website", "");
      formData.set("sourcePage", "contact-page");
      formData.set("sourceCta", "contact-split-form");
      formData.set("idempotencyKey", `idem_test_${uniqueSuffix}`);

      const result = await submitContact({ status: "idle" }, formData);
      expect(result.status).toBe("success");
      expect(result.message).toMatch(/Reference:|Ref:/);

      // Verify persisted in database
      const savedLead = await prisma.contactSubmission.findFirst({
        where: { name: `Inquiry Lead ${uniqueSuffix}` },
      });
      expect(savedLead).not.toBeNull();
      expect(savedLead?.email).toBe(`investor_${uniqueSuffix}@example.com`);
      expect(savedLead?.sourcePage).toBe("contact-page");
      expect(savedLead?.sourceCta).toBe("contact-split-form");
    });

    it("successfully submits when optional email is left completely blank", async () => {
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const formData = new FormData();
      formData.set("name", `Phone-Only Lead ${uniqueSuffix}`);
      formData.set("countryCode", "EG:+20");
      formData.set("phone", `102${Math.floor(1000000 + Math.random() * 9000000)}`);
      formData.set("email", ""); // Blank email
      formData.set("project", "General Residential");
      formData.set("consent", "on");
      formData.set("locale", "en");
      formData.set("website", "");
      formData.set("sourcePage", "contact-page");
      formData.set("idempotencyKey", `idem_blank_${uniqueSuffix}`);

      const result = await submitContact({ status: "idle" }, formData);
      expect(result.status).toBe("success");

      const savedLead = await prisma.contactSubmission.findFirst({
        where: { name: `Phone-Only Lead ${uniqueSuffix}` },
      });
      expect(savedLead).not.toBeNull();
      expect(savedLead?.email).toBeNull();
    });
  });

  describe("7. Defensive Saving Resilience & Diagnostics", () => {
    it("validates missing required fields on Contact page before touching database", async () => {
      const formData = new FormData();
      formData.set("contactHeroEyebrowEn", "");
      formData.set("contactHeroEyebrowAr", "");
      formData.set("contactHeroTitleEn", "");
      formData.set("contactHeroTitleAr", "");
      formData.set("contactHeroBodyEn", "");
      formData.set("contactHeroBodyAr", "");

      const res = await saveContactPage({ status: "idle" }, formData);
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/Complete all required page fields/);
    });

    it("validates missing required fields on Team page before touching database", async () => {
      const formData = new FormData();
      formData.set("teamEyebrowEn", "");
      formData.set("teamEyebrowAr", "");

      const res = await saveTeam({ status: "idle" }, formData);
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/Complete all required English and Arabic page fields/);
    });

    it("validates missing required fields on Partners page before touching database", async () => {
      const formData = new FormData();
      formData.set("partnersEyebrowEn", "");
      formData.set("partnersEyebrowAr", "");

      const res = await savePartners({ status: "idle" }, formData);
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/Complete all required English and Arabic page fields/);
    });
  });

  describe("8. Global Settings & Authoritative Contact Channels", () => {
    it("exposes company hotline, email, working hours, and address in contact content", async () => {
      const enContent = await getContactPageContent("en");
      expect(enContent.settings).toBeDefined();
      expect(enContent.settings?.hotline).toBeDefined();
      expect(enContent.settings?.email).toBeDefined();
      expect(enContent.settings?.address).toBeDefined();
      expect(enContent.settings?.workingHours).toBeDefined();

      const arContent = await getContactPageContent("ar");
      expect(arContent.settings).toBeDefined();
      expect(arContent.settings?.hotline).toBeDefined();
      expect(arContent.settings?.email).toBeDefined();
      expect(arContent.settings?.address).toBeDefined();
      expect(arContent.settings?.workingHours).toBeDefined();
    });
  });

  describe("9. CMS Dashboard Complete Form Saving & Live Runtime Propagation", () => {
    it("reliably saves every CMS dashboard hero field and propagates immediately to public content", async () => {
      const formData = new FormData();
      formData.set("contactHeroEnabled", "on");
      formData.set("contactHeroEyebrowEn", "Exclusive Advisory");
      formData.set("contactHeroEyebrowAr", "استشارات حصرية");
      formData.set("contactHeroTitleEn", "Luxury Masterplan Inquiries");
      formData.set("contactHeroTitleAr", "استفسارات المخططات الفاخرة");
      formData.set("contactHeroBodyEn", "Our senior partners are ready to assist with private consultations and off-market viewings.");
      formData.set("contactHeroBodyAr", "شركاؤنا التنفيذيون على أتم الاستعداد لتقديم استشارات خاصة وجولات حصرية.");
      formData.set("contactHeroCtaLabelEn", "Connect with Advisors");
      formData.set("contactHeroCtaLabelAr", "تواصل مع المستشارين");
      formData.set("contactHeroCtaUrl", "#contact-form");
      formData.set("contactHeroImageUrl", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=88");
      formData.set("contactHeroMobileImageUrl", "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=86");
      formData.set("contactHeroFocalPoint", "center 40%");
      formData.set("contactHeroMobileFocalPoint", "center 30%");
      formData.set("contactHeroImageAltEn", "Image Developments Executive Advisory Lounge");
      formData.set("contactHeroImageAltAr", "صالة الاستشارات التنفيذية لإيمدج للتطوير");
      formData.set("contactHeroOverlay", "dark");
      formData.set("contactHeroAlignment", "center");
      formData.set("contactHeroHeight", "large");

      const saveResult = await saveContactPage({ status: "idle" }, formData);
      expect(saveResult.error).toBeUndefined();
      expect(saveResult.success).toBe("Contact page saved.");

      // Verify in DB directly
      const savedPage = await prisma.contactPage.findUniqueOrThrow({ where: { id: "contactpage" } });
      expect(savedPage.heroEnabled).toBe(true);
      expect(savedPage.heroEyebrowEn).toBe("Exclusive Advisory");
      expect(savedPage.heroEyebrowAr).toBe("استشارات حصرية");
      expect(savedPage.heroTitleEn).toBe("Luxury Masterplan Inquiries");
      expect(savedPage.heroTitleAr).toBe("استفسارات المخططات الفاخرة");
      expect(savedPage.heroBodyEn).toBe("Our senior partners are ready to assist with private consultations and off-market viewings.");
      expect(savedPage.heroCtaLabelEn).toBe("Connect with Advisors");
      expect(savedPage.heroCtaLabelAr).toBe("تواصل مع المستشارين");
      expect(savedPage.heroCtaUrl).toBe("#contact-form");
      expect(savedPage.heroImageUrl).toBe("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=88");
      expect(savedPage.heroMobileImageUrl).toBe("https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=86");
      expect(savedPage.heroFocalPoint).toBe("center 40%");
      expect(savedPage.heroMobileFocalPoint).toBe("center 30%");
      expect(savedPage.heroImageAltEn).toBe("Image Developments Executive Advisory Lounge");
      expect(savedPage.heroOverlay).toBe("dark");
      expect(savedPage.heroAlignment).toBe("center");
      expect(savedPage.heroHeight).toBe("large");

      // Verify public content loader in both English and Arabic
      const enContent = await getContactPageContent("en");
      expect(enContent.contactPage.hero?.enabled).toBe(true);
      expect(enContent.contactPage.hero?.eyebrow).toBe("Exclusive Advisory");
      expect(enContent.contactPage.hero?.title).toBe("Luxury Masterplan Inquiries");
      expect(enContent.contactPage.hero?.body).toBe("Our senior partners are ready to assist with private consultations and off-market viewings.");
      expect(enContent.contactPage.hero?.ctaLabel).toBe("Connect with Advisors");
      expect(enContent.contactPage.hero?.ctaUrl).toBe("#contact-form");
      expect(enContent.contactPage.hero?.image).toBe("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=88");
      expect(enContent.contactPage.hero?.mobileImage).toBe("https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=86");
      expect(enContent.contactPage.hero?.overlay).toBe("dark");
      expect(enContent.contactPage.hero?.alignment).toBe("center");
      expect(enContent.contactPage.hero?.height).toBe("large");

      const arContent = await getContactPageContent("ar");
      expect(arContent.contactPage.hero?.enabled).toBe(true);
      expect(arContent.contactPage.hero?.eyebrow).toBe("استشارات حصرية");
      expect(arContent.contactPage.hero?.title).toBe("استفسارات المخططات الفاخرة");
      expect(arContent.contactPage.hero?.ctaLabel).toBe("تواصل مع المستشارين");
    });
  });
});
