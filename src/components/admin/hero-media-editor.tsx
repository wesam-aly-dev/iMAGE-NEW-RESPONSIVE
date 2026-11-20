"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MediaField } from "./media-field";
import { Bilingual } from "./fields";
import type { UploadedMedia } from "@/app/admin/actions";

interface HeroMediaEditorProps {
  initialDesktopType: "IMAGE" | "VIDEO";
  initialDesktopImage: string;
  initialDesktopVideo?: string | null;
  initialDesktopPoster?: string | null;
  initialDesktopFocalPoint?: string;
  initialMobileType: "INHERIT" | "IMAGE" | "VIDEO";
  initialMobileImage?: string | null;
  initialMobileVideo?: string | null;
  initialMobilePoster?: string | null;
  initialMobileFocalPoint?: string;
  initialAltEn: string;
  initialAltAr: string;
  images: UploadedMedia[];
  videos: UploadedMedia[];
}

export function HeroMediaEditor({
  initialDesktopType,
  initialDesktopImage,
  initialDesktopVideo,
  initialDesktopPoster,
  initialDesktopFocalPoint = "center",
  initialMobileType,
  initialMobileImage,
  initialMobileVideo,
  initialMobilePoster,
  initialMobileFocalPoint = "center",
  initialAltEn,
  initialAltAr,
  images,
  videos,
}: HeroMediaEditorProps) {
  const [desktopType, setDesktopType] = useState<"IMAGE" | "VIDEO">(initialDesktopType || (initialDesktopVideo ? "VIDEO" : "IMAGE"));
  const [desktopImage, setDesktopImage] = useState(initialDesktopImage || "");
  const [desktopVideo, setDesktopVideo] = useState(initialDesktopVideo || "");
  const [desktopPoster, setDesktopPoster] = useState(initialDesktopPoster || "");
  const [desktopFocalPoint, setDesktopFocalPoint] = useState(initialDesktopFocalPoint || "center");

  const [mobileType, setMobileType] = useState<"INHERIT" | "IMAGE" | "VIDEO">(initialMobileType || "INHERIT");
  const [mobileImage, setMobileImage] = useState(initialMobileImage || "");
  const [mobileVideo, setMobileVideo] = useState(initialMobileVideo || "");
  const [mobilePoster, setMobilePoster] = useState(initialMobilePoster || "");
  const [mobileFocalPoint, setMobileFocalPoint] = useState(initialMobileFocalPoint || "center");

  // Determine what will actually be resolved for Desktop viewport (> 800px)
  const resolvedDesktopAsset =
    desktopType === "VIDEO"
      ? { type: "VIDEO", url: desktopVideo, poster: desktopPoster || desktopImage }
      : { type: "IMAGE", url: desktopImage, focalPoint: desktopFocalPoint };

  // Determine what will actually be resolved for Mobile viewport (<= 800px)
  const effectiveMobileType = mobileType === "INHERIT" ? desktopType : mobileType;
  const resolvedMobileAsset =
    effectiveMobileType === "VIDEO"
      ? {
          type: "VIDEO",
          url: (mobileType === "VIDEO" ? mobileVideo : (mobileVideo || desktopVideo)) || desktopVideo,
          poster: mobilePoster || mobileImage || desktopPoster || desktopImage,
          inherited: mobileType === "INHERIT",
        }
      : {
          type: "IMAGE",
          url: (mobileType === "IMAGE" ? mobileImage : (mobileImage || desktopImage)) || desktopImage,
          focalPoint: mobileType === "IMAGE" ? mobileFocalPoint : desktopFocalPoint,
          inherited: mobileType === "INHERIT",
        };

  return (
    <div className="hero-media-editor" style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "16px" }}>
      {/* Hidden inputs to guarantee 100% preservation across type switches and form submit */}
      <input type="hidden" name="heroMediaType" value={desktopType} />
      <input type="hidden" name="heroMediaUrl" value={desktopImage} />
      <input type="hidden" name="heroVideoDesktopUrl" value={desktopVideo} />
      <input type="hidden" name="heroPosterUrl" value={desktopPoster} />
      <input type="hidden" name="heroFocalPoint" value={desktopFocalPoint} />

      <input type="hidden" name="heroMobileMediaType" value={mobileType} />
      <input type="hidden" name="heroMobileMediaUrl" value={mobileImage} />
      <input type="hidden" name="heroVideoMobileUrl" value={mobileVideo} />
      <input type="hidden" name="heroMobilePosterUrl" value={mobilePoster} />
      <input type="hidden" name="heroMobileFocalPoint" value={mobileFocalPoint} />

      {/* ============================================================== */}
      {/* 1. DESKTOP HERO CONFIGURATION                                  */}
      {/* ============================================================== */}
      <div
        style={{
          padding: "20px",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          background: "#fafbf9",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--forest, #152a20)" }}>
              Desktop Hero Media (&gt; 800px)
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted, #666)" }}>
              High-resolution background visual displayed on laptop and desktop screens.
            </p>
          </div>

          {/* Media Type Selector */}
          <div style={{ display: "inline-flex", background: "#e8ede6", padding: "3px", borderRadius: "var(--radius-sm)" }}>
            <button
              type="button"
              onClick={() => setDesktopType("IMAGE")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                background: desktopType === "IMAGE" ? "#ffffff" : "transparent",
                color: desktopType === "IMAGE" ? "var(--forest, #152a20)" : "var(--muted, #666)",
                boxShadow: desktopType === "IMAGE" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Image
            </button>
            <button
              type="button"
              onClick={() => setDesktopType("VIDEO")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                background: desktopType === "VIDEO" ? "#ffffff" : "transparent",
                color: desktopType === "VIDEO" ? "var(--forest, #152a20)" : "var(--muted, #666)",
                boxShadow: desktopType === "VIDEO" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Video
            </button>
          </div>
        </div>

        {/* Desktop Image Controls */}
        {desktopType === "IMAGE" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <MediaField
              name="_desktopImgProxy"
              label="Desktop Hero Image"
              value={desktopImage}
              assets={images}
              kind="IMAGE"
              onChange={(val) => setDesktopImage(val)}
              required={desktopType === "IMAGE"}
            />

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Desktop Focal Point
              </label>
              <select
                value={desktopFocalPoint}
                onChange={(e) => setDesktopFocalPoint(e.target.value)}
                style={{ width: "200px", padding: "6px 10px", fontSize: "13px", borderRadius: "4px", border: "1px solid var(--border)" }}
              >
                <option value="center">Center (Default)</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        )}

        {/* Desktop Video Controls */}
        {desktopType === "VIDEO" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <MediaField
              name="_desktopVideoProxy"
              label="Desktop Hero Video (MP4 / WebM)"
              value={desktopVideo}
              assets={videos}
              kind="VIDEO"
              onChange={(val) => setDesktopVideo(val)}
              required={desktopType === "VIDEO"}
            />

            <MediaField
              name="_desktopPosterProxy"
              label="Video Poster & Fallback Image"
              value={desktopPoster}
              assets={images}
              kind="IMAGE"
              onChange={(val) => setDesktopPoster(val)}
            />
            <p style={{ margin: "-8px 0 0", fontSize: "12px", color: "var(--muted, #666)" }}>
              The poster image is displayed immediately while the video is downloading, when reduced motion is preferred, or if browser policy prevents autoplay.
            </p>
          </div>
        )}

        {/* Active Desktop Status Indicator */}
        <div style={{ marginTop: "14px", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "12px", color: "#166534" }}>
          <strong>Active on Desktop:</strong>{" "}
          {resolvedDesktopAsset.type === "VIDEO" ? (
            resolvedDesktopAsset.url ? (
              <span>Video active ({resolvedDesktopAsset.url.split("/").pop()}) with poster fallback</span>
            ) : (
              <span style={{ color: "#dc2626" }}>⚠ Video selected but no video uploaded</span>
            )
          ) : (
            resolvedDesktopAsset.url ? (
              <span>Image active ({resolvedDesktopAsset.url.split("/").pop()}) at {resolvedDesktopAsset.focalPoint} focal point</span>
            ) : (
              <span style={{ color: "#dc2626" }}>⚠ Image selected but no image uploaded</span>
            )
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MOBILE HERO CONFIGURATION                                   */}
      {/* ============================================================== */}
      <div
        style={{
          padding: "20px",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          background: "#fafbf9",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--forest, #152a20)" }}>
              Mobile Hero Media (≤ 800px)
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted, #666)" }}>
              Optimized portrait or mobile-specific visual for smartphones and compact screens.
            </p>
          </div>

          {/* Mobile Media Type Selector */}
          <div style={{ display: "inline-flex", background: "#e8ede6", padding: "3px", borderRadius: "var(--radius-sm)" }}>
            <button
              type="button"
              onClick={() => setMobileType("INHERIT")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                background: mobileType === "INHERIT" ? "#ffffff" : "transparent",
                color: mobileType === "INHERIT" ? "var(--forest, #152a20)" : "var(--muted, #666)",
                boxShadow: mobileType === "INHERIT" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Inherit Desktop
            </button>
            <button
              type="button"
              onClick={() => setMobileType("IMAGE")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                background: mobileType === "IMAGE" ? "#ffffff" : "transparent",
                color: mobileType === "IMAGE" ? "var(--forest, #152a20)" : "var(--muted, #666)",
                boxShadow: mobileType === "IMAGE" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Mobile Image
            </button>
            <button
              type="button"
              onClick={() => setMobileType("VIDEO")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                background: mobileType === "VIDEO" ? "#ffffff" : "transparent",
                color: mobileType === "VIDEO" ? "var(--forest, #152a20)" : "var(--muted, #666)",
                boxShadow: mobileType === "VIDEO" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Mobile Video
            </button>
          </div>
        </div>

        {/* Mobile Inherit Description */}
        {mobileType === "INHERIT" && (
          <div style={{ padding: "14px", background: "#f8faf8", border: "1px dashed var(--border)", borderRadius: "6px", fontSize: "13px", color: "var(--muted, #666)" }}>
            Mobile devices will use the Desktop {desktopType.toLowerCase()} automatically.
            {mobileImage && !desktopVideo && <span> (A mobile image crop &ldquo;{mobileImage.split("/").pop()}&rdquo; is also available as an override).</span>}
          </div>
        )}

        {/* Mobile Image Controls */}
        {mobileType === "IMAGE" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <MediaField
              name="_mobileImgProxy"
              label="Independent Mobile Hero Image (Portrait recommended)"
              value={mobileImage}
              assets={images}
              kind="IMAGE"
              onChange={(val) => setMobileImage(val)}
            />

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Mobile Image Focal Point
              </label>
              <select
                value={mobileFocalPoint}
                onChange={(e) => setMobileFocalPoint(e.target.value)}
                style={{ width: "200px", padding: "6px 10px", fontSize: "13px", borderRadius: "4px", border: "1px solid var(--border)" }}
              >
                <option value="center">Center (Default)</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        )}

        {/* Mobile Video Controls */}
        {mobileType === "VIDEO" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <MediaField
              name="_mobileVideoProxy"
              label="Independent Mobile Hero Video (Vertical/Optimized MP4)"
              value={mobileVideo}
              assets={videos}
              kind="VIDEO"
              onChange={(val) => setMobileVideo(val)}
            />

            <MediaField
              name="_mobilePosterProxy"
              label="Mobile Video Poster Image"
              value={mobilePoster}
              assets={images}
              kind="IMAGE"
              onChange={(val) => setMobilePoster(val)}
            />
          </div>
        )}

        {/* Active Mobile Status Indicator */}
        <div style={{ marginTop: "14px", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "12px", color: "#166534" }}>
          <strong>Active on Mobile:</strong>{" "}
          {resolvedMobileAsset.type === "VIDEO" ? (
            resolvedMobileAsset.url ? (
              <span>Video active ({resolvedMobileAsset.url.split("/").pop()}){resolvedMobileAsset.inherited ? " [Inherited from Desktop]" : " [Independent Mobile Asset]"}</span>
            ) : (
              <span style={{ color: "#dc2626" }}>⚠ Mobile video selected but no video uploaded</span>
            )
          ) : (
            resolvedMobileAsset.url ? (
              <span>Image active ({resolvedMobileAsset.url.split("/").pop()}){resolvedMobileAsset.inherited ? " [Inherited from Desktop]" : " [Independent Mobile Asset]"} at {resolvedMobileAsset.focalPoint} focal point</span>
            ) : (
              <span style={{ color: "#dc2626" }}>⚠ Mobile image selected but no image uploaded</span>
            )
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. HERO ACCESSIBILITY ALT TEXT                                */}
      {/* ============================================================== */}
      <div>
        <Bilingual base="heroMediaAlt" label="Hero image/video accessible description (Alt text)" en={initialAltEn} ar={initialAltAr} />
      </div>
    </div>
  );
}
