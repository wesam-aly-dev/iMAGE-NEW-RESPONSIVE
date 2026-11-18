import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/action-form";
import { Bilingual, Field } from "@/components/admin/fields";
import { SocialLinksEditor } from "@/components/admin/social-links-editor";
import { NotificationTestForm } from "@/components/admin/notification-test-form";
import { getResolvedNotificationSettings } from "@/lib/notifications/email-service";
import { saveSettings } from "../../actions";

export default async function Settings() {
  const [s, notificationMeta, recentJobs] = await Promise.all([
    prisma.globalSettings.findUniqueOrThrow({
      where: { id: "global" },
      include: { socialLinks: { orderBy: { sortOrder: "asc" } } },
    }),
    getResolvedNotificationSettings(),
    prisma.notificationJob.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <p>Global content</p>
          <h1>Settings</h1>
          <span>Manage company identity, hotline, form notifications, working hours, and brochure downloads.</span>
        </div>
      </header>

      <ActionForm action={saveSettings} className="admin-form">
        <section className="panel">
          <h2>Identity & contact</h2>
          <Bilingual base="siteName" label="Site name" en={s.siteNameEn} ar={s.siteNameAr} />
          <Field name="hotline" label="Hotline (e.g. 17087)" value={s.hotline ?? "17087"} />
          <Field name="contactEmail" label="Contact email" type="email" value={s.contactEmail} />
          <Field name="phone" label="Landline / Direct phone" value={s.phone} />
          <Field name="mapUrl" label="Map destination / Directions URL" value={s.mapUrl ?? ""} />
          <Field name="companyBrochureUrl" label="Company Brochure URL / PDF" value={s.companyBrochureUrl ?? ""} />
          <Bilingual
            base="workingHours"
            label="Working hours"
            en={s.workingHoursEn ?? "Sunday - Thursday: 9:00 AM - 6:00 PM"}
            ar={s.workingHoursAr ?? "الأحد - الخميس: ٩:٠٠ ص - ٦:٠٠ م"}
          />
          <Bilingual base="address" label="Address" en={s.addressEn} ar={s.addressAr} />
        </section>

        <section className="panel">
          <h2>Form & Lead Notifications / إشعارات النماذج والمبيعات</h2>
          <p style={{ color: "var(--muted, #6b7280)", fontSize: "14px", marginTop: "-6px", marginBottom: "16px" }}>
            Configure destination mailboxes for website inquiries, callback requests, and job applications.
          </p>
          <div className="checkbox-row">
            <input
              type="checkbox"
              id="notificationEmailEnabled"
              name="notificationEmailEnabled"
              defaultChecked={s.notificationEmailEnabled !== false}
            />
            <label htmlFor="notificationEmailEnabled">
              Enable automated email notifications for incoming website form submissions
            </label>
          </div>
          <Field
            name="notificationRecipientEmail"
            label="Inquiries recipient email / بريد استلام استفسارات العملاء"
            type="email"
            value={s.notificationRecipientEmail || ""}
          />
          <Field
            name="careersRecipientEmail"
            label="Careers recipient email / بريد استلام طلبات التوظيف (leave empty to reuse inquiries recipient)"
            type="email"
            value={s.careersRecipientEmail || ""}
          />
          <Field
            name="notificationSenderEmail"
            label="Sender email override (From header, e.g. notifications@imagedevelopments.com)"
            type="email"
            value={s.notificationSenderEmail || ""}
          />
        </section>

        <SocialLinksEditor initialLinks={s.socialLinks} />

        <section className="panel">
          <h2>Footer</h2>
          <Bilingual
            base="description"
            label="Company description (Brand column copy)"
            en={s.descriptionEn ?? ""}
            ar={s.descriptionAr ?? ""}
            textarea
          />
          <Bilingual
            base="footerExploreHeading"
            label="Explore column heading"
            en={s.footerExploreHeadingEn ?? "Explore"}
            ar={s.footerExploreHeadingAr ?? "استكشف"}
          />
          <Bilingual
            base="footerProjectsHeading"
            label="Projects column heading"
            en={s.footerProjectsHeadingEn ?? "Our Projects"}
            ar={s.footerProjectsHeadingAr ?? "مشاريعنا"}
          />
          <Bilingual
            base="footerContactHeading"
            label="Contact column heading"
            en={s.footerContactHeadingEn ?? "Contact"}
            ar={s.footerContactHeadingAr ?? "تواصل معنا"}
          />
          <div className="checkbox-row">
            <input
              type="checkbox"
              id="callbackEnabled"
              name="callbackEnabled"
              defaultChecked={s.callbackEnabled !== false}
            />
            <label htmlFor="callbackEnabled">Enable Request a Call Back action in Contact column</label>
          </div>
          <Bilingual
            base="callbackLabel"
            label="Callback action button label"
            en={s.callbackLabelEn ?? "Request a Call Back"}
            ar={s.callbackLabelAr ?? "طلب معاودة الاتصال"}
          />
          <Bilingual base="copyright" label="Copyright" en={s.copyrightEn} ar={s.copyrightAr} />
        </section>

        <section className="panel">
          <h2>Default SEO</h2>
          <Bilingual base="defaultSeoTitle" label="SEO title" en={s.defaultSeoTitleEn} ar={s.defaultSeoTitleAr} />
          <Bilingual
            base="defaultSeoDescription"
            label="SEO description"
            en={s.defaultSeoDescriptionEn}
            ar={s.defaultSeoDescriptionAr}
            textarea
          />
          <Field name="defaultOgImageUrl" label="Default OG image URL" value={s.defaultOgImageUrl ?? ""} />
        </section>

        <section className="panel">
          <h2>Fullscreen menu media</h2>
          <Field name="menuMediaUrl" label="Image URL" value={s.menuMediaUrl} />
          <Bilingual base="menuMediaAlt" label="Image alt text" en={s.menuMediaAltEn} ar={s.menuMediaAltAr} />
        </section>
      </ActionForm>

      <section className="panel" style={{ marginTop: "32px" }}>
        <h2>Test Email Connectivity / اختبار اتصال خادم البريد</h2>
        <p style={{ color: "var(--muted, #6b7280)", fontSize: "14px", marginTop: "-6px" }}>
          Verify that outgoing notification emails reach the designated recipient inbox.
        </p>
        <NotificationTestForm
          defaultEmail={s.notificationRecipientEmail || ""}
          savedRecipient={s.notificationRecipientEmail || ""}
          lastTestAt={s.lastNotificationTestAt ? s.lastNotificationTestAt.toISOString() : null}
          lastTestResult={s.lastNotificationTestResult}
          smtpConfigured={notificationMeta.smtpConfigured}
          hasResend={notificationMeta.hasResend}
        />
      </section>

      {recentJobs.length > 0 && (
        <section className="panel" style={{ marginTop: "32px" }}>
          <h2>Recent Notification Attempts / سجل الإرسال الحديث</h2>
          <p style={{ color: "var(--muted, #6b7280)", fontSize: "14px", marginTop: "-6px", marginBottom: "16px" }}>
            Audit log of recent system and inquiry notifications, their dispatch status, and delivery attempts.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Type</th>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Details / Error</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                      {job.createdAt.toLocaleString("en-GB")}
                    </td>
                    <td>
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f3f4f6" }}>
                        {job.jobType}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", fontFamily: "monospace" }}>{job.recipientEmail}</td>
                    <td style={{ fontSize: "12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.subject}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor:
                            job.status === "DELIVERED"
                              ? "#dcfce7"
                              : job.status === "ACCEPTED"
                              ? "#dbeafe"
                              : job.status === "BLOCKED"
                              ? "#fef3c7"
                              : job.status === "FAILED"
                              ? "#fee2e2"
                              : "#f3f4f6",
                          color:
                            job.status === "DELIVERED"
                              ? "#15803d"
                              : job.status === "ACCEPTED"
                              ? "#1d4ed8"
                              : job.status === "BLOCKED"
                              ? "#b45309"
                              : job.status === "FAILED"
                              ? "#b91c1c"
                              : "#4b5563",
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "11px", color: "var(--muted, #6b7280)", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.lastError || (job.status === "DELIVERED" || job.status === "ACCEPTED" ? "Dispatched successfully" : "Pending")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
