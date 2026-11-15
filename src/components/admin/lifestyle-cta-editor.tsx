"use client";

import { useState } from "react";

export type PublishedProjectItem = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
};

const STANDARD_INTERNAL_DESTINATIONS = [
  { value: "/about", labelEn: "About Page", labelAr: "صفحة من نحن" },
  { value: "/projects", labelEn: "Projects Listing", labelAr: "صفحة المشاريع" },
  { value: "/contact", labelEn: "Contact Us", labelAr: "تواصل معنا" },
  { value: "/careers", labelEn: "Careers", labelAr: "الوظائف" },
  { value: "/journal", labelEn: "Journal / News", labelAr: "يومياتنا" },
  { value: "/history", labelEn: "History", labelAr: "تاريخنا" },
  { value: "/team", labelEn: "Team", labelAr: "فريقنا" },
  { value: "/partners", labelEn: "Partners", labelAr: "شركاؤنا" },
];

export function LifestyleCtaEditor({
  initialEnabled = true,
  initialLabelEn = "Discover Our Story",
  initialLabelAr = "اكتشف قصتنا",
  initialUrl = "/about",
  initialExternal = false,
  publishedProjects = [],
}: {
  initialEnabled?: boolean;
  initialLabelEn?: string;
  initialLabelAr?: string;
  initialUrl?: string;
  initialExternal?: boolean;
  publishedProjects?: PublishedProjectItem[];
}) {
  const isInitiallyExternal =
    initialExternal || /^(?:https?:|mailto:|tel:)/i.test(initialUrl);

  const [enabled, setEnabled] = useState(initialEnabled);
  const [labelEn, setLabelEn] = useState(initialLabelEn);
  const [labelAr, setLabelAr] = useState(initialLabelAr);
  const [destType, setDestType] = useState<"internal" | "external">(
    isInitiallyExternal ? "external" : "internal"
  );
  const [internalPath, setInternalPath] = useState(
    isInitiallyExternal ? "/about" : initialUrl || "/about"
  );
  const [externalUrl, setExternalUrl] = useState(
    isInitiallyExternal ? initialUrl : "https://"
  );
  const [openInNewTab, setOpenInNewTab] = useState(initialExternal);

  // Normalize internal destination (strip accidental /en/ or /ar/)
  const handleInternalPathChange = (val: string) => {
    let clean = val.trim();
    if (clean.startsWith("/en/")) clean = clean.replace("/en/", "/");
    else if (clean.startsWith("/ar/")) clean = clean.replace("/ar/", "/");
    else if (clean === "/en" || clean === "/ar") clean = "/about";
    setInternalPath(clean);
  };

  const currentDestination = destType === "external" ? externalUrl : internalPath;

  return (
    <div
      className="section-cta-editor"
      style={{
        border: "1px solid var(--line, #e2ded7)",
        borderRadius: "10px",
        background: "#faf9f6",
        padding: "20px",
        marginTop: "16px",
        marginBottom: "20px",
      }}
    >
      {/* Hidden inputs submitted in form */}
      <input type="hidden" name="hasLifestyleCtaConfig" value="1" />
      <input type="hidden" name="lifestyleCtaEnabled" value={enabled ? "on" : "off"} />
      <input type="hidden" name="lifestyleCtaLabelEn" value={labelEn} />
      <input type="hidden" name="lifestyleCtaLabelAr" value={labelAr} />
      <input type="hidden" name="lifestyleCtaUrl" value={currentDestination} />
      <input
        type="hidden"
        name="lifestyleCtaExternal"
        value={openInNewTab || destType === "external" ? "on" : "off"}
      />

      {/* Header and Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          paddingBottom: "12px",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "15px", margin: "0 0 2px", color: "var(--forest, #152a20)" }}>
            Section CTA (Primary Call to Action)
          </h3>
          <p className="hint" style={{ margin: 0, fontSize: "12px" }}>
            The primary pill button positioned directly beneath the narrative heading. Defaults to &ldquo;Discover Our Story&rdquo; opening the About page.
          </p>
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          <span>Show Section CTA Button</span>
        </label>
      </div>

      {enabled ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Labels Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <label style={{ margin: 0, fontSize: "12.5px" }}>
              English Button Label
              <input
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                placeholder="Discover Our Story"
                required={enabled}
                maxLength={60}
                style={{ marginTop: "4px", padding: "8px 12px", fontSize: "13px" }}
              />
            </label>

            <label style={{ margin: 0, fontSize: "12.5px" }}>
              Arabic Button Label (العربية)
              <input
                value={labelAr}
                onChange={(e) => setLabelAr(e.target.value)}
                dir="rtl"
                placeholder="اكتشف قصتنا"
                required={enabled}
                maxLength={60}
                style={{ marginTop: "4px", padding: "8px 12px", fontSize: "13px" }}
              />
            </label>
          </div>

          {/* Destination Type & Selector */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--line, #e2ded7)",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "13px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="ctaDestTypeChoice"
                  checked={destType === "internal"}
                  onChange={() => setDestType("internal")}
                />
                <strong>Internal Page / Project</strong>
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "13px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="ctaDestTypeChoice"
                  checked={destType === "external"}
                  onChange={() => setDestType("external")}
                />
                <strong>External Website URL</strong>
              </label>
            </div>

            {destType === "internal" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "14px", alignItems: "center" }}>
                <div>
                  <label style={{ fontSize: "12px", margin: "0 0 4px" }}>Preset Destination:</label>
                  <select
                    value={internalPath}
                    onChange={(e) => handleInternalPathChange(e.target.value)}
                    style={{ padding: "8px 10px", fontSize: "13px", width: "100%" }}
                  >
                    <optgroup label="Standard Pages">
                      {STANDARD_INTERNAL_DESTINATIONS.map((dest) => (
                        <option key={dest.value} value={dest.value}>
                          {dest.labelEn} ({dest.value})
                        </option>
                      ))}
                    </optgroup>
                    {publishedProjects.length > 0 && (
                      <optgroup label="Published Projects">
                        {publishedProjects.map((proj) => (
                          <option key={proj.id} value={`/projects/${proj.slug}`}>
                            {proj.nameEn} (/projects/{proj.slug})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", margin: "0 0 4px" }}>Internal Route Path:</label>
                  <input
                    value={internalPath}
                    onChange={(e) => handleInternalPathChange(e.target.value)}
                    placeholder="/about or /projects"
                    style={{ padding: "8px 10px", fontSize: "13px", width: "100%" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--muted, #666)" }}>
                    Locale prefix (e.g. <code>/en</code> or <code>/ar</code>) is handled automatically.
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "12px", margin: 0 }}>
                  External Destination URL
                  <input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://example.com"
                    style={{ marginTop: "4px", padding: "8px 10px", fontSize: "13px" }}
                  />
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "12.5px" }}>
                  <input
                    type="checkbox"
                    checked={openInNewTab}
                    onChange={(e) => setOpenInNewTab(e.target.checked)}
                  />
                  <span>Open destination in a new browser tab (target=&quot;_blank&quot;)</span>
                </label>
              </div>
            )}
          </div>

          {/* Small Live Button Previews */}
          <div
            style={{
              background: "#152a20",
              borderRadius: "8px",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#b36f55", fontWeight: 700 }}>
                Live Button Preview
              </span>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                Renders with brand forest styling (#152a20) and localized directional arrows.
              </p>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              {/* English preview */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "11px 24px",
                  borderRadius: "999px",
                  background: "#223d2f",
                  color: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <span>{labelEn || "Discover Our Story"}</span>
                <span style={{ fontSize: "14px", color: "#b36f55" }}>→</span>
              </div>

              {/* Arabic preview */}
              <div
                dir="rtl"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "11px 24px",
                  borderRadius: "999px",
                  background: "#223d2f",
                  color: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <span>{labelAr || "اكتشف قصتنا"}</span>
                <span style={{ fontSize: "14px", color: "#b36f55" }}>←</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.03)", borderRadius: "6px", fontSize: "12.5px", color: "var(--muted, #666)" }}>
          Section CTA is currently <strong>hidden</strong>. The narrative text and surrounding architectural images will render without a button.
        </div>
      )}
    </div>
  );
}

