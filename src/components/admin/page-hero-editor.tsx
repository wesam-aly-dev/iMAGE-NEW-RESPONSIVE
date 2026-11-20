"use client";

import React, { useState } from "react";
import { Bilingual, Check } from "@/components/admin/fields";
import { MediaUploadField } from "@/components/admin/media-upload-field";
import type { UploadedMedia } from "@/app/admin/actions";

export interface PageHeroEditorProps {
  prefix: string;
  sectionTitle?: string;
  eyebrowBase?: string;
  titleBase?: string;
  bodyBase?: string;
  defaultCtaUrl?: string;
  defaultCtaLabelEn?: string;
  defaultCtaLabelAr?: string;
  values: {
    enabled?: boolean;
    eyebrowEn?: string | null;
    eyebrowAr?: string | null;
    titleEn?: string | null;
    titleAr?: string | null;
    bodyEn?: string | null;
    bodyAr?: string | null;
    ctaLabelEn?: string | null;
    ctaLabelAr?: string | null;
    ctaUrl?: string | null;
    imageUrl?: string | null;
    mobileImageUrl?: string | null;
    mediaType?: "IMAGE" | "VIDEO" | string | null;
    videoUrl?: string | null;
    mobileMediaType?: "INHERIT" | "IMAGE" | "VIDEO" | string | null;
    mobileVideoUrl?: string | null;
    posterUrl?: string | null;
    focalPoint?: string | null;
    mobileFocalPoint?: string | null;
    imageAltEn?: string | null;
    imageAltAr?: string | null;
    overlay?: string | null;
    alignment?: string | null;
    height?: string | null;
  };
  assets: UploadedMedia[];
}

export function PageHeroEditor({
  prefix,
  sectionTitle = "1. Page Hero Section",
  eyebrowBase,
  titleBase,
  bodyBase,
  defaultCtaUrl = "#top",
  defaultCtaLabelEn = "Learn More",
  defaultCtaLabelAr = "اكتشف المزيد",
  values,
  assets,
}: PageHeroEditorProps) {
  const eyBase = eyebrowBase || `${prefix}Eyebrow`;
  const tBase = titleBase || `${prefix}Title`;
  const bBase = bodyBase || `${prefix}Body`;

  // Persistent editor state preserving all media URLs across tab/type switches
  const [desktopType, setDesktopType] = useState<"IMAGE" | "VIDEO">(
    values.mediaType === "VIDEO" || (values.videoUrl && !values.imageUrl) ? "VIDEO" : "IMAGE"
  );
  const [desktopImageUrl, setDesktopImageUrl] = useState<string>(values.imageUrl || "");
  const [desktopVideoUrl, setDesktopVideoUrl] = useState<string>(values.videoUrl || "");
  const [posterUrl, setPosterUrl] = useState<string>(values.posterUrl || "");
  const [desktopFocalPoint, setDesktopFocalPoint] = useState<string>(values.focalPoint || "center");

  const [mobileMode, setMobileMode] = useState<"INHERIT" | "IMAGE" | "VIDEO">(
    (values.mobileMediaType as any) || (values.mobileVideoUrl ? "VIDEO" : values.mobileImageUrl ? "IMAGE" : "INHERIT")
  );
  const [mobileImageUrl, setMobileImageUrl] = useState<string>(values.mobileImageUrl || "");
  const [mobileVideoUrl, setMobileVideoUrl] = useState<string>(values.mobileVideoUrl || "");
  const [mobileFocalPoint, setMobileFocalPoint] = useState<string>(values.mobileFocalPoint || "center");

  // Separate image and video assets for respective pickers
  const imageAssets = assets.filter((a) => a.kind === "IMAGE" || a.mimeType?.startsWith("image/"));
  const videoAssets = assets.filter((a) => a.kind === "VIDEO" || a.mimeType?.startsWith("video/"));

  return (
    <section className="panel" style={{ marginBottom: "28px" }}>
      <div className="section-title">
        <div>
          <h2>{sectionTitle}</h2>
          <p className="hint" style={{ margin: "2px 0 0", fontSize: "13px" }}>
            Configure the prominent architectural hero section for this standalone page.
          </p>
        </div>
        <Check
          name={`${prefix}Enabled`}
          label="Hero Visible"
          checked={values.enabled !== false}
        />
      </div>

      {/* Hidden inputs to guarantee 100% preservation across mode switches and submissions */}
      <input type="hidden" name={`${prefix}MediaType`} value={desktopType} />
      <input type="hidden" name={`${prefix}ImageUrl`} value={desktopImageUrl} />
      <input type="hidden" name={`${prefix}VideoUrl`} value={desktopVideoUrl} />
      <input type="hidden" name={`${prefix}PosterUrl`} value={posterUrl} />
      <input type="hidden" name={`${prefix}FocalPoint`} value={desktopFocalPoint} />

      <input type="hidden" name={`${prefix}MobileMediaType`} value={mobileMode} />
      <input type="hidden" name={`${prefix}MobileImageUrl`} value={mobileImageUrl} />
      <input type="hidden" name={`${prefix}MobileVideoUrl`} value={mobileVideoUrl} />
      <input type="hidden" name={`${prefix}MobileFocalPoint`} value={mobileFocalPoint} />

      {/* Group 1: Content & Copy */}
      <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--line, #dfe4dc)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px", color: "var(--foreground)" }}>
          Content &amp; Text / النصوص والمحتوى
        </h3>
        <Bilingual
          base={eyBase}
          label="Eyebrow"
          en={values.eyebrowEn || ""}
          ar={values.eyebrowAr || ""}
          required
        />
        <Bilingual
          base={tBase}
          label="Heading"
          en={values.titleEn || ""}
          ar={values.titleAr || ""}
          textarea
          required
        />
        <Bilingual
          base={bBase}
          label="Introduction / Supporting narrative"
          en={values.bodyEn || ""}
          ar={values.bodyAr || ""}
          textarea
          required
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "12px" }}>
          <Bilingual
            base={`${prefix}CtaLabel`}
            label="Optional CTA button label"
            en={values.ctaLabelEn || ""}
            ar={values.ctaLabelAr || ""}
          />
          <div className="field">
            <label htmlFor={`${prefix}CtaUrl`}>CTA button destination</label>
            <input
              type="text"
              id={`${prefix}CtaUrl`}
              name={`${prefix}CtaUrl`}
              defaultValue={values.ctaUrl || defaultCtaUrl}
              placeholder={defaultCtaUrl}
            />
            <span className="field-hint" style={{ fontSize: "11px", color: "var(--muted, #6b7280)", marginTop: "4px", display: "block" }}>
              Anchor link (e.g. <code>{defaultCtaUrl}</code>) or page URL (e.g. <code>/contact</code>).
            </span>
          </div>
        </div>
      </div>

      {/* Group 2: Media & Imagery (Image & Video Workflows) */}
      <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--line, #dfe4dc)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)" }}>
              Media &amp; Imagery / وسائط وخلفيات الهيرو
            </h3>
            <p className="hint" style={{ fontSize: "12.5px", color: "var(--muted, #6b7280)", margin: 0 }}>
              Supports high-resolution architectural imagery and looping cinematic MP4/WebM video with poster fallbacks.
            </p>
          </div>

          {/* Desktop Media Type Switcher */}
          <div style={{ display: "inline-flex", background: "#f0f2ee", padding: "3px", borderRadius: "8px", border: "1px solid var(--line, #dfe4dc)" }}>
            <button
              type="button"
              onClick={() => setDesktopType("IMAGE")}
              style={{
                padding: "5px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: desktopType === "IMAGE" ? "#ffffff" : "transparent",
                color: desktopType === "IMAGE" ? "var(--forest, #152a20)" : "var(--muted, #6b7280)",
                boxShadow: desktopType === "IMAGE" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              📷 Image Mode
            </button>
            <button
              type="button"
              onClick={() => setDesktopType("VIDEO")}
              style={{
                padding: "5px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: desktopType === "VIDEO" ? "#ffffff" : "transparent",
                color: desktopType === "VIDEO" ? "var(--forest, #152a20)" : "var(--muted, #6b7280)",
                boxShadow: desktopType === "VIDEO" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              🎬 Video Mode
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginTop: "16px", marginBottom: "16px" }}>
          {/* Primary Desktop Media */}
          <div style={{ border: "1px solid var(--line, #dfe4dc)", borderRadius: "8px", padding: "16px", background: "#fafbfa" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>
                Desktop Hero {desktopType === "VIDEO" ? "Video (Cinematic Loop)" : "Image (Primary)"}
              </h4>
              <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--muted, #6b7280)", textTransform: "uppercase" }}>
                Desktop &amp; Fallback
              </span>
            </div>
            <p style={{ fontSize: "11.5px", color: "var(--muted, #6b7280)", margin: "0 0 12px" }}>
              {desktopType === "VIDEO"
                ? "Autoplaying muted architectural loop (MP4/WebM). Include an optional poster image below for instant loading."
                : "High-resolution architectural landscape image displayed across desktop & tablet screens."}
            </p>

            {desktopType === "VIDEO" ? (
              <>
                <MediaUploadField
                  name="_desktopHeroVideoInput"
                  label="Desktop Hero Video"
                  value={desktopVideoUrl}
                  existingAssets={videoAssets}
                  kind="VIDEO"
                  onChange={(val) => setDesktopVideoUrl(val)}
                />
                <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px dashed var(--line, #dfe4dc)" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "4px" }}>
                    Video Poster / Fallback Image (Recommended)
                  </label>
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px" }}>
                    Displayed while the video buffers, on low-bandwidth connections, or when reduced-motion is preferred.
                  </p>
                  <MediaUploadField
                    name="_desktopHeroPosterInput"
                    label="Poster Frame Image"
                    value={posterUrl}
                    existingAssets={imageAssets}
                    kind="IMAGE"
                    onChange={(val) => setPosterUrl(val)}
                  />
                </div>
              </>
            ) : (
              <MediaUploadField
                name="_desktopHeroImageInput"
                label="Desktop Hero Image"
                value={desktopImageUrl}
                existingAssets={imageAssets}
                kind="IMAGE"
                showFocalPoint
                focalPointValue={desktopFocalPoint}
                onChange={(val, asset) => {
                  setDesktopImageUrl(val);
                  if (asset?.focalPoint) setDesktopFocalPoint(asset.focalPoint);
                }}
              />
            )}
          </div>

          {/* Mobile Media Configuration */}
          <div style={{ border: "1px solid var(--line, #dfe4dc)", borderRadius: "8px", padding: "16px", background: "#fafbfa" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>Mobile Hero Media (≤ 768px)</h4>
              <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--muted, #6b7280)", textTransform: "uppercase" }}>
                Mobile Adaptation
              </span>
            </div>
            <p style={{ fontSize: "11.5px", color: "var(--muted, #6b7280)", margin: "0 0 12px" }}>
              Tailor vertical viewports with an independent crop or let mobile inherit the desktop visual seamlessly.
            </p>

            {/* Mobile Mode Switcher */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "6px" }}>
                Mobile Media Strategy
              </label>
              <select
                value={mobileMode}
                onChange={(e) => setMobileMode(e.target.value as any)}
                style={{ width: "100%", padding: "7px 10px", fontSize: "12.5px", borderRadius: "6px", border: "1px solid var(--line, #dfe4dc)" }}
              >
                <option value="INHERIT">Inherit Desktop Media (Recommended — Zero Extra Bandwidth)</option>
                <option value="IMAGE">Custom Mobile Image Override (Vertical Crop)</option>
                <option value="VIDEO">Custom Mobile Video Override (Vertical Loop)</option>
              </select>
            </div>

            {mobileMode === "INHERIT" ? (
              <div style={{ padding: "14px", borderRadius: "6px", background: "#f3f5f1", border: "1px dashed var(--line, #dfe4dc)", fontSize: "12px", color: "var(--forest, #152a20)" }}>
                <strong>Responsive Fallback Active</strong>
                <p style={{ margin: "4px 0 0", color: "var(--muted, #6b7280)", fontSize: "11.5px" }}>
                  Mobile screens will automatically display the desktop visual (
                  {desktopType === "VIDEO" ? "video loop with poster frame" : "architectural image"}
                  ) scaled and centered appropriately.
                </p>
              </div>
            ) : mobileMode === "IMAGE" ? (
              <MediaUploadField
                name="_mobileHeroImageInput"
                label="Mobile Hero Image"
                value={mobileImageUrl}
                existingAssets={imageAssets}
                kind="IMAGE"
                showFocalPoint
                focalPointValue={mobileFocalPoint}
                onChange={(val, asset) => {
                  setMobileImageUrl(val);
                  if (asset?.focalPoint) setMobileFocalPoint(asset.focalPoint);
                }}
              />
            ) : (
              <MediaUploadField
                name="_mobileHeroVideoInput"
                label="Mobile Hero Video"
                value={mobileVideoUrl}
                existingAssets={videoAssets}
                kind="VIDEO"
                onChange={(val) => setMobileVideoUrl(val)}
              />
            )}
          </div>
        </div>

        <Bilingual
          base={`${prefix}ImageAlt`}
          label="Hero image alt text (Accessibility &amp; SEO)"
          en={values.imageAltEn || ""}
          ar={values.imageAltAr || ""}
        />
      </div>

      {/* Group 3: Presentation & Appearance */}
      <div>
        <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 6px", color: "var(--foreground)" }}>
          Presentation &amp; Layout / خيارات العرض والتنسيق
        </h3>
        <p className="hint" style={{ fontSize: "12.5px", color: "var(--muted, #6b7280)", marginBottom: "16px" }}>
          Tailor overlay density, text alignment, and vertical height for optimum internal-page balance.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {/* Overlay Strength */}
          <div className="field">
            <label htmlFor={`${prefix}Overlay`}>Overlay Contrast / تدرج التعتيم</label>
            <select
              id={`${prefix}Overlay`}
              name={`${prefix}Overlay`}
              defaultValue={values.overlay || "medium"}
              style={{ width: "100%", padding: "8px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--line, #dfe4dc)" }}
            >
              <option value="subtle">Subtle (Light Darkening — 45%)</option>
              <option value="medium">Medium (Balanced Readability — 65% — Recommended)</option>
              <option value="dark">Dark (Maximum Contrast — 82%)</option>
            </select>
            <span style={{ fontSize: "11px", color: "var(--muted, #6b7280)", marginTop: "4px", display: "block" }}>
              Controls architectural gradient density over background media.
            </span>
          </div>

          {/* Text Alignment */}
          <div className="field">
            <label htmlFor={`${prefix}Alignment`}>Text Alignment / محاذاة النص</label>
            <select
              id={`${prefix}Alignment`}
              name={`${prefix}Alignment`}
              defaultValue={values.alignment || "start"}
              style={{ width: "100%", padding: "8px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--line, #dfe4dc)" }}
            >
              <option value="start">Natural Reading Flow (Left in EN, Right in AR — Recommended)</option>
              <option value="center">Centered (Editorial Statement)</option>
            </select>
            <span style={{ fontSize: "11px", color: "var(--muted, #6b7280)", marginTop: "4px", display: "block" }}>
              Aligns hero copy and action buttons.
            </span>
          </div>

          {/* Hero Height Preset */}
          <div className="field">
            <label htmlFor={`${prefix}Height`}>Hero Height / ارتفاع الهيرو</label>
            <select
              id={`${prefix}Height`}
              name={`${prefix}Height`}
              defaultValue={values.height || "standard"}
              style={{ width: "100%", padding: "8px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--line, #dfe4dc)" }}
            >
              <option value="compact">Compact (420px min-height — Space Saving)</option>
              <option value="standard">Standard (540px min-height — Balanced — Recommended)</option>
              <option value="large">Large (680px min-height — High Impact)</option>
              <option value="fullscreen">Full Viewport (100svh — Cinematic Hero — Recommended)</option>
            </select>
            <span style={{ fontSize: "11px", color: "var(--muted, #6b7280)", marginTop: "4px", display: "block" }}>
              Select an internal-page height preset.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
