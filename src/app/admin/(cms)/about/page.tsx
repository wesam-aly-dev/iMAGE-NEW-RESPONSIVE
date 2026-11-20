import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/action-form";
import { Bilingual, Check } from "@/components/admin/fields";
import { AboutMagazineEditor } from "@/components/admin/about-magazine-editor";
import { AboutContentEditor } from "@/components/admin/about-content-editor";
import { MediaField } from "@/components/admin/media-field";
import { MediaUploadField } from "@/components/admin/media-upload-field";
import { saveAbout } from "../../actions";
import { TypographyFields } from "@/components/admin/typography-fields";

export default async function AboutAdmin() {
  const [home, global, milestones, blocks, images] = await Promise.all([
    prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } }),
    prisma.globalSettings.findUniqueOrThrow({ where: { id: "global" } }),
    prisma.aboutMilestone.findMany({ where: { homepageId: "homepage" }, orderBy: { sortOrder: "asc" } }),
    prisma.aboutContentBlock.findMany({ where: { homepageId: "homepage" }, orderBy: { sortOrder: "asc" } }),
    prisma.mediaAsset.findMany({ where: { kind: "IMAGE" }, orderBy: { createdAt: "desc" }, select: { id: true, url: true, filename: true, mimeType: true, size: true, kind: true } }),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <p>Standalone page</p>
          <h1>About us page</h1>
          <span>Control the page hero, Who We Are, interactive timeline, Vision &amp; Mission, Achievements, Leadership, and flexible content sections.</span>
        </div>
      </header>
      <ActionForm action={saveAbout} className="admin-form" submitLabel="Save About Page">
        {/* 1. About Page Hero */}
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>1. About Page Hero</h2>
              <p className="hint" style={{ margin: "2px 0 0", fontSize: "13px" }}>
                High-impact hero header for the standalone About Us page.
              </p>
            </div>
            <Check name="aboutHeroEnabled" label="Visible" checked={home.aboutHeroEnabled} />
          </div>

          {/* Group 1: Content & Copy */}
          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 12px", color: "var(--foreground)" }}>
              Content &amp; Copy / النصوص والمحتوى
            </h3>
            <Bilingual base="aboutHeroEyebrow" label="Eyebrow" en={home.aboutHeroEyebrowEn} ar={home.aboutHeroEyebrowAr} required />
            <Bilingual base="aboutHeroTitle" label="Heading" en={home.aboutHeroTitleEn} ar={home.aboutHeroTitleAr} textarea required />
            <Bilingual base="aboutHeroBody" label="Introduction / Supporting narrative" en={home.aboutHeroBodyEn} ar={home.aboutHeroBodyAr} textarea required />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "12px" }}>
              <Bilingual base="aboutHeroCtaLabel" label="Scroll CTA button label" en={home.aboutHeroCtaLabelEn || "Explore Our Journey"} ar={home.aboutHeroCtaLabelAr || "اكتشف رحلتنا"} />
              <div className="field">
                <label htmlFor="aboutHeroCtaUrl">Scroll CTA destination</label>
                <input
                  type="text"
                  id="aboutHeroCtaUrl"
                  name="aboutHeroCtaUrl"
                  defaultValue={home.aboutHeroCtaUrl || "#about"}
                  placeholder="#about or /projects"
                />
                <span className="field-hint" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
                  Timeline anchor (<code>#about</code>) or destination URL.
                </span>
              </div>
            </div>
          </div>

          {/* Group 2: Media & Imagery */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 6px", color: "var(--foreground)" }}>
              Media &amp; Imagery / وسائط وخلفيات الهيرو
            </h3>
            <p className="hint" style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "16px" }}>
              The desktop hero image serves as the primary visual and acts as the fallback for mobile screens. The mobile hero image is an optional override; removing it immediately restores the desktop fallback without deleting the desktop asset.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "16px" }}>
              {/* Desktop Hero Image */}
              <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "#fafbfa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>Desktop Hero Image (Primary)</h4>
                  <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Required</span>
                </div>
                <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "0 0 12px" }}>
                  High-resolution landscape image displayed on desktop &amp; tablet viewports (and on mobile whenever no mobile override is supplied).
                </p>
                <MediaUploadField
                  name="aboutHeroImageUrl"
                  label="Desktop Hero Image"
                  value={home.aboutHeroImageUrl ?? home.heroMediaUrl}
                  existingAssets={images}
                  kind="IMAGE"
                  required
                  showFocalPoint
                  focalPointName="aboutHeroFocalPoint"
                  focalPointValue={home.aboutHeroFocalPoint || "center"}
                />
              </div>

              {/* Mobile Hero Image (Optional Override) */}
              <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "#fafbfa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>Mobile Hero Image (Optional Override)</h4>
                  <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Mobile only (≤ 800px)</span>
                </div>
                <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "0 0 12px" }}>
                  Independent image tailored for vertical mobile viewports. If left blank or removed, the desktop image is seamlessly used as the fallback.
                </p>
                <MediaUploadField
                  name="aboutHeroMobileImageUrl"
                  label="Mobile Hero Image"
                  value={home.aboutHeroMobileImageUrl || ""}
                  existingAssets={images}
                  kind="IMAGE"
                  showFocalPoint
                  focalPointName="aboutHeroMobileFocalPoint"
                  focalPointValue={home.aboutHeroMobileFocalPoint || "center"}
                />
              </div>
            </div>

            {/* Accessibility Alt Text */}
            <Bilingual
              base="aboutHeroImageAlt"
              label="Hero image alt text (Accessibility &amp; SEO)"
              en={home.aboutHeroImageAltEn}
              ar={home.aboutHeroImageAltAr}
              required
            />
          </div>
        </section>

        {/* B. Who We Are */}
        <section className="panel">
          <div className="section-title">
            <h2>2. Who We Are</h2>
            <Check name="aboutWhoWeAreEnabled" label="Visible" checked={home.aboutWhoWeAreEnabled} />
          </div>
          <Bilingual base="aboutWhoWeAreEyebrow" label="Eyebrow" en={home.aboutWhoWeAreEyebrowEn} ar={home.aboutWhoWeAreEyebrowAr} required />
          <Bilingual base="aboutWhoWeAreTitle" label="Heading" en={home.aboutWhoWeAreTitleEn} ar={home.aboutWhoWeAreTitleAr} required />
          <Bilingual base="aboutWhoWeAreBody" label="Company Introduction &amp; Activities" en={home.aboutWhoWeAreBodyEn} ar={home.aboutWhoWeAreBodyAr} textarea required />
          <Bilingual base="aboutWhoWeAreApproach" label="Approach &amp; Methodology (Optional)" en={home.aboutWhoWeAreApproachEn || ""} ar={home.aboutWhoWeAreApproachAr || ""} textarea />
          <MediaField name="aboutWhoWeAreImageUrl" label="Section project image" value={home.aboutWhoWeAreImageUrl ?? home.lifestyleMediaUrl} assets={images} kind="IMAGE" />
          <Bilingual base="aboutWhoWeAreImageAlt" label="Image alt text" en={home.aboutWhoWeAreImageAltEn || ""} ar={home.aboutWhoWeAreImageAltAr || ""} />
          <Bilingual base="aboutWhoWeArePrimaryCta" label="Primary CTA label" en={home.aboutWhoWeArePrimaryCtaEn || "Explore Our Projects"} ar={home.aboutWhoWeArePrimaryCtaAr || "استكشف مشاريعنا"} />
          <div className="field">
            <label htmlFor="aboutWhoWeArePrimaryCtaUrl">Primary CTA destination</label>
            <input type="text" id="aboutWhoWeArePrimaryCtaUrl" name="aboutWhoWeArePrimaryCtaUrl" defaultValue={home.aboutWhoWeArePrimaryCtaUrl || "/projects"} />
          </div>
          <Bilingual base="aboutWhoWeAreBrochureCta" label="Brochure CTA label" en={home.aboutWhoWeAreBrochureCtaEn || "Download Brochure"} ar={home.aboutWhoWeAreBrochureCtaAr || "تحميل البروشور"} />
          <div className="field">
            <label htmlFor="companyBrochureUrl">Company Brochure URL / Download Link (Brochure CTA is shown only when populated)</label>
            <input type="text" id="companyBrochureUrl" name="companyBrochureUrl" defaultValue={global.companyBrochureUrl || ""} placeholder="https://... or /brochures/company-profile.pdf" />
          </div>
        </section>

        {/* C. Protected Horizontal History Timeline */}
        <section className="panel">
          <div className="section-title">
            <h2>3. Interactive timeline (Our Journey)</h2>
            <Check name="aboutEnabled" label="Visible" checked={home.aboutEnabled} />
          </div>
          <p className="hint">The horizontal scroll milestone experience. Preserve milestone cards, timing, and progress indicators.</p>
          <Bilingual base="aboutEyebrow" label="Eyebrow" en={home.aboutEyebrowEn} ar={home.aboutEyebrowAr} required />
          <Bilingual base="aboutTitle" label="Heading" en={home.aboutTitleEn} ar={home.aboutTitleAr} textarea required />
          <Bilingual base="aboutIntro" label="Introduction" en={home.aboutIntroEn} ar={home.aboutIntroAr} textarea required />
        </section>

        <AboutMagazineEditor initialPages={milestones} assets={images} />

        {/* D. Vision & Mission */}
        <section className="panel">
          <div className="section-title">
            <h2>4. Vision &amp; Mission</h2>
            <Check name="aboutVisionMissionEnabled" label="Visible" checked={home.aboutVisionMissionEnabled} />
          </div>
          <Bilingual base="aboutVisionEyebrow" label="Vision Eyebrow" en={home.aboutVisionEyebrowEn} ar={home.aboutVisionEyebrowAr} required />
          <Bilingual base="aboutVisionTitle" label="Vision Heading" en={home.aboutVisionTitleEn} ar={home.aboutVisionTitleAr} required />
          <Bilingual base="aboutVisionBody" label="Vision Statement" en={home.aboutVisionBodyEn} ar={home.aboutVisionBodyAr} textarea required />
          <hr style={{ margin: "24px 0", borderColor: "rgba(24, 91, 42, 0.12)" }} />
          <Bilingual base="aboutMissionEyebrow" label="Mission Eyebrow" en={home.aboutMissionEyebrowEn} ar={home.aboutMissionEyebrowAr} required />
          <Bilingual base="aboutMissionTitle" label="Mission Heading" en={home.aboutMissionTitleEn} ar={home.aboutMissionTitleAr} required />
          <Bilingual base="aboutMissionBody" label="Mission Statement" en={home.aboutMissionBodyEn} ar={home.aboutMissionBodyAr} textarea required />
          <MediaField name="aboutVisionMissionImageUrl" label="Supporting architectural image" value={home.aboutVisionMissionImageUrl ?? home.heroMediaUrl} assets={images} kind="IMAGE" />
          <Bilingual base="aboutVisionMissionImageAlt" label="Image alt text" en={home.aboutVisionMissionImageAltEn || ""} ar={home.aboutVisionMissionImageAltAr || ""} />
          <Bilingual base="aboutVisionMissionCta" label="CTA button label" en={home.aboutVisionMissionCtaEn || "Explore Our Projects"} ar={home.aboutVisionMissionCtaAr || "استكشف مشاريعنا"} />
          <div className="field">
            <label htmlFor="aboutVisionMissionCtaUrl">CTA destination</label>
            <input type="text" id="aboutVisionMissionCtaUrl" name="aboutVisionMissionCtaUrl" defaultValue={home.aboutVisionMissionCtaUrl || "/projects"} />
          </div>
        </section>

        {/* E. Our Achievements */}
        <section className="panel">
          <div className="section-title">
            <h2>5. Our Achievements</h2>
            <Check name="aboutAchievementsEnabled" label="Visible" checked={home.aboutAchievementsEnabled} />
          </div>
          <p className="hint">Achievement figures are dynamically loaded from verified records. Manage figures in <Link href="/admin/homepage">Homepage Stats</Link>.</p>
          <Bilingual base="aboutAchievementsEyebrow" label="Eyebrow" en={home.aboutAchievementsEyebrowEn} ar={home.aboutAchievementsEyebrowAr} required />
          <Bilingual base="aboutAchievementsTitle" label="Heading" en={home.aboutAchievementsTitleEn} ar={home.aboutAchievementsTitleAr} required />
          <Bilingual base="aboutAchievementsDescription" label="Description" en={home.aboutAchievementsDescriptionEn || ""} ar={home.aboutAchievementsDescriptionAr || ""} textarea />
          <Bilingual base="aboutAchievementsCta" label="CTA button label" en={home.aboutAchievementsCtaEn || "View Our Track Record"} ar={home.aboutAchievementsCtaAr || "استعرض سجل إنجازاتنا"} />
          <div className="field">
            <label htmlFor="aboutAchievementsCtaUrl">CTA destination</label>
            <input type="text" id="aboutAchievementsCtaUrl" name="aboutAchievementsCtaUrl" defaultValue={home.aboutAchievementsCtaUrl || "/projects"} />
          </div>
        </section>

        {/* F. Executive Leadership */}
        <section className="panel">
          <div className="section-title">
            <h2>6. Executive Leadership</h2>
            <Check name="aboutLeadershipEnabled" label="Visible" checked={home.aboutLeadershipEnabled} />
          </div>
          <p className="hint">Leadership profiles are dynamically loaded from team records. Manage executive profiles in <Link href="/admin/team">Team CMS</Link>. Hidden automatically if zero members are visible.</p>
          <Bilingual base="aboutLeadershipEyebrow" label="Eyebrow" en={home.aboutLeadershipEyebrowEn} ar={home.aboutLeadershipEyebrowAr} required />
          <Bilingual base="aboutLeadershipTitle" label="Heading" en={home.aboutLeadershipTitleEn} ar={home.aboutLeadershipTitleAr} required />
          <Bilingual base="aboutLeadershipDescription" label="Description" en={home.aboutLeadershipDescriptionEn || ""} ar={home.aboutLeadershipDescriptionAr || ""} textarea />
          <Bilingual base="aboutLeadershipCta" label="CTA button label" en={home.aboutLeadershipCtaEn || "Contact Our Team"} ar={home.aboutLeadershipCtaAr || "تواصل مع فريقنا"} />
          <div className="field">
            <label htmlFor="aboutLeadershipCtaUrl">CTA destination</label>
            <input type="text" id="aboutLeadershipCtaUrl" name="aboutLeadershipCtaUrl" defaultValue={home.aboutLeadershipCtaUrl || "/contact"} />
          </div>
        </section>

        <TypographyFields fields={[{ key: "aboutHero", label: "About page — Hero" }, { key: "aboutTimeline", label: "About page — Timeline" }, { key: "aboutBlocks", label: "About page — Content sections" }]} />
        <AboutContentEditor initialBlocks={blocks} assets={images} />
      </ActionForm>
    </>
  );
}
