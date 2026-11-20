"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MediaUploadField } from "./media-upload-field";

interface Asset {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: string;
}

interface OpeningMontageEditorProps {
  initialMobilePoster?: string | null;
  initialSlot1Image?: string | null;
  initialSlot1MobileImage?: string | null;
  initialSlot1AltEn?: string | null;
  initialSlot1AltAr?: string | null;

  initialSlot2Image?: string | null;
  initialSlot2MobileImage?: string | null;
  initialSlot2AltEn?: string | null;
  initialSlot2AltAr?: string | null;

  initialSlot3Image?: string | null;
  initialSlot3MobileImage?: string | null;
  initialSlot3AltEn?: string | null;
  initialSlot3AltAr?: string | null;

  initialSlot4Image?: string | null;
  initialSlot4MobileImage?: string | null;
  initialSlot4AltEn?: string | null;
  initialSlot4AltAr?: string | null;

  initialSlot5Image?: string | null;
  initialSlot5MobileImage?: string | null;
  initialSlot5AltEn?: string | null;
  initialSlot5AltAr?: string | null;

  images: Asset[];
}

const SLOTS_META = [
  { id: 1, name: "Slot 1: Outer Left", sub: "Outer left side panel (Desktop)", prefix: "openingSlot1" },
  { id: 2, name: "Slot 2: Inner Left", sub: "Inner left side panel (Desktop & Mobile)", prefix: "openingSlot2" },
  { id: 3, name: "Slot 3: Center (Hero)", sub: "Central panel expanding into Hero (Desktop & Mobile)", prefix: "openingSlot3" },
  { id: 4, name: "Slot 4: Inner Right", sub: "Inner right side panel (Desktop & Mobile)", prefix: "openingSlot4" },
  { id: 5, name: "Slot 5: Outer Right", sub: "Outer right side panel (Desktop)", prefix: "openingSlot5" },
];

export function OpeningMontageEditor({
  initialMobilePoster,
  initialSlot1Image,
  initialSlot1MobileImage,
  initialSlot1AltEn,
  initialSlot1AltAr,
  initialSlot2Image,
  initialSlot2MobileImage,
  initialSlot2AltEn,
  initialSlot2AltAr,
  initialSlot3Image,
  initialSlot3MobileImage,
  initialSlot3AltEn,
  initialSlot3AltAr,
  initialSlot4Image,
  initialSlot4MobileImage,
  initialSlot4AltEn,
  initialSlot4AltAr,
  initialSlot5Image,
  initialSlot5MobileImage,
  initialSlot5AltEn,
  initialSlot5AltAr,
  images,
}: OpeningMontageEditorProps) {
  const [activeSlot, setActiveSlot] = useState(3);

  const slotData: Record<number, {
    desktop: string;
    mobile: string;
    altEn: string;
    altAr: string;
  }> = {
    1: { desktop: initialSlot1Image || "", mobile: initialSlot1MobileImage || "", altEn: initialSlot1AltEn || "", altAr: initialSlot1AltAr || "" },
    2: { desktop: initialSlot2Image || "", mobile: initialSlot2MobileImage || "", altEn: initialSlot2AltEn || "", altAr: initialSlot2AltAr || "" },
    3: { desktop: initialSlot3Image || "", mobile: initialSlot3MobileImage || "", altEn: initialSlot3AltEn || "", altAr: initialSlot3AltAr || "" },
    4: { desktop: initialSlot4Image || "", mobile: initialSlot4MobileImage || "", altEn: initialSlot4AltEn || "", altAr: initialSlot4AltAr || "" },
    5: { desktop: initialSlot5Image || "", mobile: initialSlot5MobileImage || "", altEn: initialSlot5AltEn || "", altAr: initialSlot5AltAr || "" },
  };

  const [state, setState] = useState(slotData);

  const handleUpdate = (slotId: number, field: "desktop" | "mobile" | "altEn" | "altAr", val: string) => {
    setState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        [field]: val,
      },
    }));
  };

  return (
    <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
      <div style={{ marginBottom: "14px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 4px" }}>
          Mobile Opening Poster &amp; 5-Panel Montage Composition
        </h3>
        <p className="hint" style={{ margin: 0 }}>
          Configure specific desktop and mobile imagery for the 5 opening montage panels. On mobile devices, the mobile asset loads immediately without desktop flashing. If mobile image is omitted, the desktop asset serves as fallback.
        </p>
      </div>

      {/* Opening Mobile Poster Field */}
      <div style={{ marginBottom: "20px" }}>
        <MediaUploadField
          name="openingMobilePosterUrl"
          label="Opening Mobile Poster / Video Fallback (Mobile)"
          value={initialMobilePoster || ""}
          existingAssets={images}
          kind="IMAGE"
        />
        <p className="hint" style={{ marginTop: "4px" }}>
          Loaded as initial mobile opening frame. If omitted, uses Desktop Opening Poster or Hero Mobile Image.
        </p>
      </div>

      {/* Slot Selector Tabs */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "18px" }}>
        {SLOTS_META.map((slot) => {
          const current = state[slot.id];
          const hasImage = Boolean(current.desktop || current.mobile);
          const isSelected = activeSlot === slot.id;

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setActiveSlot(slot.id)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                border: isSelected ? "1px solid var(--forest)" : "1px solid var(--line)",
                backgroundColor: isSelected ? "var(--forest)" : "#ffffff",
                color: isSelected ? "#ffffff" : "var(--ink)",
                fontWeight: isSelected ? 600 : 500,
                fontSize: "12.5px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: isSelected ? "0 2px 6px rgba(30, 58, 41, 0.18)" : "none",
                transition: "all 0.16s ease",
              }}
            >
              <span>{slot.name}</span>
              {hasImage && (
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    backgroundColor: isSelected ? "var(--peach)" : "#2e8b57",
                  }}
                  title="Image configured"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Slot Configuration Card */}
      {SLOTS_META.map((slot) => {
        if (slot.id !== activeSlot) {
          // Render hidden inputs so form submitted state persists unselected tabs
          const cur = state[slot.id];
          return (
            <React.Fragment key={slot.id}>
              <input type="hidden" name={`${slot.prefix}ImageUrl`} value={cur.desktop} />
              <input type="hidden" name={`${slot.prefix}MobileImageUrl`} value={cur.mobile} />
              <input type="hidden" name={`${slot.prefix}AltEn`} value={cur.altEn} />
              <input type="hidden" name={`${slot.prefix}AltAr`} value={cur.altAr} />
            </React.Fragment>
          );
        }

        const cur = state[slot.id];

        return (
          <div
            key={slot.id}
            style={{
              padding: "16px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.01)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>{slot.name}</span>
                <span style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "8px" }}>({slot.sub})</span>
              </div>
              {(cur.desktop || cur.mobile) && (
                <button
                  type="button"
                  onClick={() => {
                    handleUpdate(slot.id, "desktop", "");
                    handleUpdate(slot.id, "mobile", "");
                  }}
                  style={{
                    fontSize: "12px",
                    color: "#991b1b",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Clear Slot Images
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <MediaUploadField
                  name={`${slot.prefix}ImageUrl`}
                  label="Desktop Image (Default)"
                  value={cur.desktop}
                  existingAssets={images}
                  kind="IMAGE"
                  onChange={(val) => handleUpdate(slot.id, "desktop", val)}
                />
              </div>
              <div>
                <MediaUploadField
                  name={`${slot.prefix}MobileImageUrl`}
                  label="Mobile Image Override (Optional)"
                  value={cur.mobile}
                  existingAssets={images}
                  kind="IMAGE"
                  onChange={(val) => handleUpdate(slot.id, "mobile", val)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label htmlFor={`${slot.prefix}AltEn`}>Image Alt Text (English)</label>
                <input
                  id={`${slot.prefix}AltEn`}
                  name={`${slot.prefix}AltEn`}
                  type="text"
                  value={cur.altEn}
                  placeholder="e.g. Architectural detail of Image community"
                  onChange={(e) => handleUpdate(slot.id, "altEn", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={`${slot.prefix}AltAr`}>Image Alt Text (Arabic)</label>
                <input
                  id={`${slot.prefix}AltAr`}
                  name={`${slot.prefix}AltAr`}
                  type="text"
                  dir="rtl"
                  value={cur.altAr}
                  placeholder="مثال: تفاصيل معمارية من مجتمعات إيمدج"
                  onChange={(e) => handleUpdate(slot.id, "altAr", e.target.value)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
