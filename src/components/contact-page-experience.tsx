"use client";

import { useState } from "react";
import type { ContactPageContent } from "@/content/home";
import { SiteHeader } from "./site-header";
import { Footer } from "./homepage-experience";
import { ContactForm } from "./contact-form";
import { PageHero } from "./page-hero";

export function ContactPageExperience({ copy }: { copy: ContactPageContent }) {
  const ar = copy.locale === "ar";
  const s = copy.settings;
  const hotline = s?.hotline || "17087";
  const email = s?.email || "hello@imagedevelopments.com";
  const address = s?.address || (ar ? "القاهرة · جمهورية مصر العربية" : "Cairo, Arab Republic of Egypt");
  const workingHours = s?.workingHours || (ar ? "الأحد - الخميس: ٩:٠٠ ص - ٦:٠٠ م" : "Sunday - Thursday: 9:00 AM - 6:00 PM");
  const [mapActive, setMapActive] = useState(false);

  return (
    <>
      <SiteHeader copy={copy} page="contact" />
      <main className="contact-page-redesign" dir={copy.dir}>
        {/* Section 1: CMS-Configurable Hero */}
        <PageHero
          locale={copy.locale}
          hero={copy.contactPage.hero}
          breadcrumbLabel={ar ? "تواصل معنا" : "Contact Us"}
          indexNumber="01"
          id="top"
          scrollTargetId="#contact-form"
          secondaryCta={{
            label: ar ? `اتصل بنا ${hotline}` : `Call ${hotline}`,
            href: `tel:${hotline}`,
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            ),
          }}
          quickBadges={[
            {
              label: ar ? "الخط المباشر" : "Direct Hotline",
              value: hotline,
              href: `tel:${hotline}`,
            },
            {
              label: ar ? "فريق الاستشارات" : "Advisory Care",
              value: ar ? "خلال ٢٤ ساعة" : "Within 24 Hours",
            },
            {
              label: ar ? "المقر الرئيسي" : "Headquarters",
              value: ar ? "القاهرة الجديدة" : "New Cairo, Egypt",
            },
          ]}
        />

        {/* Section 2: Balanced Two-Column Main Stage (Details & Inquiry Form) */}
        <section id="contact-form" className="contact-split-stage stage-pad">
          <div className="contact-desktop-split">
            {/* Column 1: Contact Details & Direct Channels */}
            <aside className="contact-details-panel">
              <div className="contact-details-card">
                <div className="contact-panel-head">
                  <span className="contact-section-num">02</span>
                  <h2 className="contact-panel-title">
                    {ar ? "قنوات التواصل والمقر" : "Direct Channels & Office"}
                  </h2>
                  <p className="contact-panel-sub">
                    {ar
                      ? "طرق مباشرة وموثوقة للتواصل مع مستشارينا العقاريين."
                      : "Direct, reliable channels to reach our property advisory team."}
                  </p>
                </div>

                <div className="contact-channels-stack">
                  {/* Hotline Card */}
                  <div className="contact-channel-item highlight-card">
                    <div className="contact-card-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <div className="contact-channel-body">
                      <span className="contact-card-label">{ar ? "الخط الساخن المباشر" : "Direct Hotline"}</span>
                      <strong className="contact-card-value contact-hotline-val" dir="ltr">{hotline}</strong>
                      <p className="contact-card-sub">{ar ? "خدمة العملاء والاستفسارات على مدار الأسبوع" : "Customer care & general enquiries"}</p>
                    </div>
                    <a href={`tel:${hotline}`} className="contact-card-cta" aria-label={ar ? `اتصل على ${hotline}` : `Call ${hotline}`}>
                      <span>{ar ? "اتصل الآن" : "Call Now"}</span>
                      <span aria-hidden="true">{ar ? "←" : "→"}</span>
                    </a>
                  </div>

                  {/* Email Card */}
                  <div className="contact-channel-item">
                    <div className="contact-card-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    <div className="contact-channel-body">
                      <span className="contact-card-label">{ar ? "البريد الإلكتروني" : "Official Email"}</span>
                      <strong className="contact-card-value text-normal text-break" dir="ltr">{email}</strong>
                      <p className="contact-card-sub">{ar ? "للطلبات والمراسلات الرسمية والشراكات" : "For enquiries, partnerships, and official notices"}</p>
                    </div>
                    <a href={`mailto:${email}`} className="contact-card-cta" aria-label={ar ? `مراسلة ${email}` : `Email ${email}`}>
                      <span>{ar ? "إرسال بريد إلكتروني" : "Send Email"}</span>
                      <span aria-hidden="true">{ar ? "←" : "→"}</span>
                    </a>
                  </div>

                  {/* Working Hours Card */}
                  <div className="contact-channel-item compact">
                    <div className="contact-card-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="contact-channel-body">
                      <span className="contact-card-label">{ar ? "ساعات العمل" : "Working Hours"}</span>
                      <strong className="contact-card-value text-normal">{workingHours}</strong>
                      <p className="contact-card-sub">{ar ? "المكتب الرئيسي وصالات الاستقبال" : "Head office & client reception"}</p>
                    </div>
                  </div>

                  {/* Address Card */}
                  <div className="contact-channel-item compact">
                    <div className="contact-card-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className="contact-channel-body">
                      <span className="contact-card-label">{ar ? "المقر الرئيسي" : "Headquarters"}</span>
                      <strong className="contact-card-value text-normal">{address}</strong>
                      <p className="contact-card-sub">{ar ? "نرحب بزيارتكم بموعد مسبق" : "Visits welcomed by appointment"}</p>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                {s?.socials && s.socials.length > 0 && (
                  <div className="contact-social-bar">
                    <span className="contact-social-title">{ar ? "المنصات الرسمية:" : "Official Channels:"}</span>
                    <div className="contact-social-links">
                      {s.socials.map((soc) => (
                        <a
                          key={soc.label}
                          href={soc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="contact-social-item"
                        >
                          <span>{soc.label}</span>
                          <span aria-hidden="true" style={{ fontSize: "11px" }}>↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Column 2: Inquiry Form Card */}
            <div className="contact-form-panel">
              <div className="contact-form-card-luxury">
                <div className="contact-form-header">
                  <span className="contact-form-badge">{ar ? "استفسار مباشر" : "INQUIRY"}</span>
                  <h2 className="contact-form-title">
                    {ar ? "أرسل لنا استفسارك" : "Send Us an Inquiry"}
                  </h2>
                  <p className="contact-form-desc">
                    {ar
                      ? "املأ النموذج أدناه وسيتواصل معك مستشارونا العقاريون. الاسم ورقم الهاتف مطلوبان، والبريد الإلكتروني اختياري."
                      : "Fill out the form below and our property advisors will guide you through every step. Name and phone number are required; email is optional."}
                  </p>
                </div>
                <ContactForm
                  copy={copy}
                  variant="contact"
                  sourcePage="contact-page"
                  sourceCta="contact-split-form"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Location Map */}
        <section className="contact-map-section stage-pad">
          <div className="contact-section-header">
            <span className="contact-section-num">03</span>
            <h2>{ar ? "موقع المقر الرئيسي" : "Headquarters Location"}</h2>
            <p>{ar ? "يسعدنا استقبالكم في مقر إيمدج للتطوير العقاري." : "We welcome you at the Image Developments headquarters."}</p>
          </div>

          <div className="contact-map-card">
            <div
              className={`contact-map-embed${mapActive ? " is-active" : ""}`}
              onClick={() => setMapActive(true)}
              onFocus={() => setMapActive(true)}
              tabIndex={0}
              role="region"
              aria-label={ar ? "خريطة تفاعلية — انقر للتفعيل" : "Interactive map — click to activate"}
              style={!mapActive ? { cursor: "pointer", position: "relative" } : {}}
            >
              {!mapActive && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(21,42,32,0.04)",
                  zIndex: 2,
                  pointerEvents: "none",
                }}>
                  <span style={{
                    background: "rgba(21,42,32,0.85)",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "8px 18px",
                    borderRadius: "24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    {ar ? "انقر لتفعيل الخريطة" : "Click to enable map"}
                  </span>
                </div>
              )}
              <iframe
                title={ar ? "خريطة مقر إيمدج" : "Image Developments Office Map"}
                src="https://maps.google.com/maps?q=New%20Cairo,%20Cairo%20Governorate,%20Egypt&t=&z=14&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, pointerEvents: mapActive ? "auto" : "none" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="contact-map-details">
              <div className="contact-map-info-block">
                <span className="contact-map-sub">{ar ? "العنوان بالتفصيل" : "Office Address"}</span>
                <p className="contact-map-addr">{address}</p>
              </div>
              <a
                href="https://maps.google.com/?q=New+Cairo+Egypt"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-directions-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                <span>{ar ? "الاتجاهات على الخريطة" : "Get Directions"}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer copy={copy} page="contact" />
    </>
  );
}
