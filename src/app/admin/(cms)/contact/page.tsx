import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeroEditor } from "@/components/admin/page-hero-editor";
import { saveContactPage } from "../../actions";

export default async function ContactAdmin() {
  const [page, images, submissions, settings] = await Promise.all([
    prisma.contactPage.findUniqueOrThrow({ where: { id: "contactpage" } }),
    prisma.mediaAsset.findMany({
      where: { OR: [{ kind: "IMAGE" }, { kind: "VIDEO" }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        filename: true,
        mimeType: true,
        size: true,
        kind: true,
      },
    }),
    prisma.contactSubmission
      .findMany({ orderBy: { createdAt: "desc" }, take: 10 })
      .catch(async () => {
        try {
          const raw = await prisma.$queryRaw<Array<any>>`SELECT * FROM "ContactSubmission" ORDER BY "createdAt" DESC LIMIT 10`;
          return raw.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
        } catch {
          return [];
        }
      }),
    prisma.globalSettings.findUniqueOrThrow({ where: { id: "global" } }),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <p>Standalone page</p>
          <h1>Contact page</h1>
          <span>
            Manage the Contact page hero, introductory narrative, and presentation presets. Follow up on submissions from the Leads section.
          </span>
        </div>
      </header>
      <ActionForm action={saveContactPage} className="admin-form" submitLabel="Save Contact Page">
        <PageHeroEditor
          prefix="contactHero"
          sectionTitle="1. Contact Page Hero"
          eyebrowBase="contactEyebrow"
          titleBase="contactPageTitle"
          bodyBase="contactIntro"
          defaultCtaUrl="#contact-form"
          defaultCtaLabelEn="Send an Inquiry"
          defaultCtaLabelAr="أرسل استفسارك"
          values={{
            enabled: page.heroEnabled ?? true,
            eyebrowEn: page.heroEyebrowEn,
            eyebrowAr: page.heroEyebrowAr,
            titleEn: page.heroTitleEn,
            titleAr: page.heroTitleAr,
            bodyEn: page.heroBodyEn,
            bodyAr: page.heroBodyAr,
            ctaLabelEn: page.heroCtaLabelEn ?? "Send an Inquiry",
            ctaLabelAr: page.heroCtaLabelAr ?? "أرسل استفسارك",
            ctaUrl: page.heroCtaUrl ?? "#contact-form",
            imageUrl: page.heroImageUrl,
            mobileImageUrl: page.heroMobileImageUrl,
            mediaType: page.heroMediaType,
            videoUrl: page.heroVideoUrl,
            mobileMediaType: page.heroMobileMediaType,
            mobileVideoUrl: page.heroMobileVideoUrl,
            posterUrl: page.heroPosterUrl,
            focalPoint: page.heroFocalPoint ?? "center",
            mobileFocalPoint: page.heroMobileFocalPoint ?? "center",
            imageAltEn: page.heroImageAltEn,
            imageAltAr: page.heroImageAltAr,
            overlay: page.heroOverlay ?? "medium",
            alignment: page.heroAlignment ?? "start",
            height: page.heroHeight ?? "standard",
          }}
          assets={images}
        />

        {/* Section 2: Authoritative Company Channels & Direct Contact Info */}
        <section className="panel" style={{ marginTop: "24px" }}>
          <div className="section-title">
            <div>
              <h2>2. Authoritative Company Channels &amp; Office Info</h2>
              <p className="hint" style={{ margin: "2px 0 0", fontSize: "13px" }}>
                Public hotline, email, working hours, and headquarters address displayed on the Contact page. These values are centrally managed in Global Settings.
              </p>
            </div>
            <Link
              href="/admin/settings"
              className="ghost-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                background: "var(--background-soft)",
                color: "var(--foreground)",
              }}
            >
              <span>Edit in Global Settings</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                background: "var(--background-soft)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "4px" }}>
                Direct Hotline
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--foreground)" }} dir="ltr">
                {settings.hotline || "17087"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                Primary phone: {settings.phone || "Not configured"}
              </div>
            </div>

            <div
              style={{
                background: "var(--background-soft)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "4px" }}>
                Official Email
              </div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", wordBreak: "break-all" }} dir="ltr">
                {settings.contactEmail || "info@image-developments.com"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                Receives all website visitor inquiries
              </div>
            </div>

            <div
              style={{
                background: "var(--background-soft)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "4px" }}>
                Working Hours
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
                {settings.workingHoursEn || "Sunday - Thursday: 9:00 AM - 6:00 PM"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }} dir="rtl">
                {settings.workingHoursAr || "الأحد - الخميس: ٩:٠٠ ص - ٦:٠٠ م"}
              </div>
            </div>

            <div
              style={{
                background: "var(--background-soft)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "4px" }}>
                Headquarters Address
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
                {settings.addressEn || "New Cairo, Egypt"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }} dir="rtl">
                {settings.addressAr || "القاهرة الجديدة، مصر"}
              </div>
            </div>
          </div>
        </section>
      </ActionForm>

      <section className="table-wrap">
        <h2>Latest leads</h2>
        {submissions.length ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Contact</th>
                <th>Project</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((item) => (
                <tr key={item.id}>
                  <td>{item.createdAt.toLocaleDateString("en-GB")}</td>
                  <td>
                    {item.name}
                    <small>
                      {item.email ? (
                        <a href={`mailto:${item.email}`}>{item.email}</a>
                      ) : (
                        <span>No email provided</span>
                      )}
                      {item.phone && <> · {item.phone}</>}
                    </small>
                  </td>
                  <td>{item.subject}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">No leads yet.</p>
        )}
      </section>
    </>
  );
}
