"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";

export interface SlotConfig {
  id: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  labelEn: string;
  labelAr: string;
  positionDescription: string;
  fieldPrefix: string;
  imageUrl: string;
  imageAltEn: string;
  imageAltAr: string;
  focalPoint: string;
  mobileImageUrl?: string;
}

export interface MediaAssetOption {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface LifestyleStoryImagesEditorProps {
  initialSlots: {
    topLeft: SlotConfig;
    topRight: SlotConfig;
    bottomLeft: SlotConfig;
    bottomRight: SlotConfig;
  };
  mediaAssets: MediaAssetOption[];
}

export function LifestyleStoryImagesEditor({
  initialSlots,
  mediaAssets,
}: LifestyleStoryImagesEditorProps) {
  const [slots, setSlots] = useState(initialSlots);
  const [activeLibrarySlot, setActiveLibrarySlot] = useState<keyof typeof initialSlots | null>(null);
  const [isLibraryTargetMobile, setIsLibraryTargetMobile] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadTarget = useRef<{ slotKey: keyof typeof initialSlots; isMobile: boolean } | null>(null);

  const triggerUpload = (slotKey: keyof typeof initialSlots, isMobile = false) => {
    pendingUploadTarget.current = { slotKey, isMobile };
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = pendingUploadTarget.current;
    if (!file || !target) return;

    // Check size (< 12MB) and format
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file (JPEG, PNG, WebP, AVIF).");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setUploadError("File is too large. Maximum image size is 12 MB.");
      return;
    }

    setUploadingSlot(`${target.slotKey}-${target.isMobile ? "mobile" : "desktop"}`);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "IMAGE");

      const res = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.asset) {
        throw new Error(data.error || "Upload failed");
      }

      const uploadedUrl = data.asset.url;
      setSlots((prev) => {
        const currentSlot = prev[target.slotKey];
        return {
          ...prev,
          [target.slotKey]: {
            ...currentSlot,
            [target.isMobile ? "mobileImageUrl" : "imageUrl"]: uploadedUrl,
          },
        };
      });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingSlot(null);
      pendingUploadTarget.current = null;
    }
  };

  const handleSelectFromLibrary = (assetUrl: string) => {
    if (!activeLibrarySlot) return;
    setSlots((prev) => {
      const current = prev[activeLibrarySlot];
      return {
        ...prev,
        [activeLibrarySlot]: {
          ...current,
          [isLibraryTargetMobile ? "mobileImageUrl" : "imageUrl"]: assetUrl,
        },
      };
    });
    setActiveLibrarySlot(null);
  };

  const handleRemoveImage = (slotKey: keyof typeof initialSlots, isMobile = false) => {
    setSlots((prev) => {
      const current = prev[slotKey];
      return {
        ...prev,
        [slotKey]: {
          ...current,
          [isMobile ? "mobileImageUrl" : "imageUrl"]: "",
        },
      };
    });
  };

  const slotEntries = [
    { key: "topLeft" as const, ...slots.topLeft },
    { key: "topRight" as const, ...slots.topRight },
    { key: "bottomLeft" as const, ...slots.bottomLeft },
    { key: "bottomRight" as const, ...slots.bottomRight },
  ];

  return (
    <div className="lifestyle-slots-editor" style={{ marginTop: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600, color: "var(--forest, #152a20)" }}>
          Architectural Image Frames / إطارات صور قصة المكان
        </h3>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #5e6b63)" }}>
          Directly manage the 4 architectural image positions surrounding the central statement on the homepage. Each slot supports direct upload, media library selection, custom focal point, and bilingual alt text.
        </p>
      </div>

      {uploadError && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          &times; {uploadError}
        </div>
      )}

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* 2x2 Balanced Grid of image slots */}
      <div
        className="lifestyle-slots-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "20px",
        }}
      >
        {slotEntries.map((slot) => {
          const isSlotUploading = uploadingSlot === `${slot.key}-desktop`;
          const isMobileUploading = uploadingSlot === `${slot.key}-mobile`;

          return (
            <div
              key={slot.key}
              style={{
                backgroundColor: "#faf9f6",
                border: "1px solid var(--line, #dfe4dc)",
                borderRadius: "10px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Slot Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--ink, #162c20)" }}>
                    {slot.labelEn} / {slot.labelAr}
                  </strong>
                  <div style={{ fontSize: "11px", color: "var(--muted, #5e6b63)", marginTop: "2px" }}>
                    {slot.positionDescription}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    backgroundColor: "#e8ede6",
                    color: "#2a4534",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {slot.id}
                </span>
              </div>

              {/* Hidden form inputs for persistence */}
              <input type="hidden" name={`${slot.fieldPrefix}ImageUrl`} value={slot.imageUrl} />
              <input type="hidden" name={`${slot.fieldPrefix}MobileImageUrl`} value={slot.mobileImageUrl || ""} />

              {/* Desktop Image Frame Preview */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "170px",
                  backgroundColor: "#f4f5f2",
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: "1px solid var(--line, #dfe4dc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {slot.imageUrl ? (
                  <Image
                    src={slot.imageUrl}
                    alt={slot.imageAltEn || slot.labelEn}
                    fill
                    sizes="340px"
                    style={{ objectFit: "contain", objectPosition: slot.focalPoint || "center" }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#888", fontSize: "12px" }}>
                    <em>Image deliberately removed</em>
                    <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
                      (Slot will not display on public homepage)
                    </div>
                  </div>
                )}

                {isSlotUploading && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Uploading...
                  </div>
                )}
              </div>

              {/* Action Buttons for Main Image */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={Boolean(uploadingSlot)}
                  onClick={() => triggerUpload(slot.key, false)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--line, #dfe4dc)",
                  }}
                >
                  {slot.imageUrl ? "Upload & Replace" : "Upload Image"}
                </button>

                <button
                  type="button"
                  className="secondary"
                  disabled={Boolean(uploadingSlot)}
                  onClick={() => {
                    setActiveLibrarySlot(slot.key);
                    setIsLibraryTargetMobile(false);
                  }}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--line, #dfe4dc)",
                  }}
                >
                  Choose From Library
                </button>

                {slot.imageUrl && (
                  <button
                    type="button"
                    disabled={Boolean(uploadingSlot)}
                    onClick={() => handleRemoveImage(slot.key, false)}
                    style={{
                      padding: "6px 10px",
                      fontSize: "12px",
                      color: "#991b1b",
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginLeft: "auto",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Focal Point & Crop Position */}
              <div>
                <label
                  htmlFor={`${slot.fieldPrefix}FocalPoint`}
                  style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}
                >
                  Crop &amp; Focal Point Position
                </label>
                <select
                  id={`${slot.fieldPrefix}FocalPoint`}
                  name={`${slot.fieldPrefix}FocalPoint`}
                  value={slot.focalPoint}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSlots((prev) => ({
                      ...prev,
                      [slot.key]: { ...prev[slot.key], focalPoint: val },
                    }));
                  }}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    border: "1px solid var(--line, #dfe4dc)",
                    background: "#ffffff",
                  }}
                >
                  <option value="center">Center / المنتصف (Default)</option>
                  <option value="top">Top / الأعلى</option>
                  <option value="bottom">Bottom / الأسفل</option>
                  <option value="left">Left / اليسار</option>
                  <option value="right">Right / اليمين</option>
                </select>
              </div>

              {/* Bilingual Alt Texts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label
                    htmlFor={`${slot.fieldPrefix}ImageAltEn`}
                    style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}
                  >
                    Alt Text (English)
                  </label>
                  <input
                    id={`${slot.fieldPrefix}ImageAltEn`}
                    name={`${slot.fieldPrefix}ImageAltEn`}
                    type="text"
                    value={slot.imageAltEn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlots((prev) => ({
                        ...prev,
                        [slot.key]: { ...prev[slot.key], imageAltEn: val },
                      }));
                    }}
                    placeholder="e.g. Architectural exterior"
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      fontSize: "12px",
                      borderRadius: "4px",
                      border: "1px solid var(--line, #dfe4dc)",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${slot.fieldPrefix}ImageAltAr`}
                    style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}
                  >
                    النص البديل (عربي)
                  </label>
                  <input
                    id={`${slot.fieldPrefix}ImageAltAr`}
                    name={`${slot.fieldPrefix}ImageAltAr`}
                    type="text"
                    dir="rtl"
                    value={slot.imageAltAr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlots((prev) => ({
                        ...prev,
                        [slot.key]: { ...prev[slot.key], imageAltAr: val },
                      }));
                    }}
                    placeholder="مثال: واجهة معمارية راقية"
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      fontSize: "12px",
                      borderRadius: "4px",
                      border: "1px solid var(--line, #dfe4dc)",
                    }}
                  />
                </div>
              </div>

              {/* Optional Mobile Image Override */}
              <details style={{ marginTop: "4px", borderTop: "1px dashed var(--line, #dfe4dc)", paddingTop: "8px" }}>
                <summary style={{ fontSize: "11px", fontWeight: 600, cursor: "pointer", color: "var(--forest, #152a20)" }}>
                  Mobile Image Override (Optional)
                  {slot.mobileImageUrl ? " ✓ Active" : ""}
                </summary>
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--muted, #5e6b63)" }}>
                    Optional cropped or vertical ratio image specifically served to mobile devices for this slot.
                  </p>
                  {slot.mobileImageUrl && (
                    <div style={{ position: "relative", width: "120px", height: "80px", borderRadius: "4px", overflow: "hidden", border: "1px solid #ccc" }}>
                      <Image src={slot.mobileImageUrl} alt="Mobile preview" fill sizes="120px" style={{ objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      disabled={Boolean(uploadingSlot)}
                      onClick={() => triggerUpload(slot.key, true)}
                      style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
                    >
                      {isMobileUploading ? "Uploading..." : slot.mobileImageUrl ? "Replace Mobile" : "Upload Mobile"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(uploadingSlot)}
                      onClick={() => {
                        setActiveLibrarySlot(slot.key);
                        setIsLibraryTargetMobile(true);
                      }}
                      style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
                    >
                      Choose from Library
                    </button>
                    {slot.mobileImageUrl && (
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(slot.key, true)}
                        style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer", borderRadius: "4px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}
                      >
                        Remove Mobile
                      </button>
                    )}
                  </div>
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {/* Media Library Modal Dialog */}
      {activeLibrarySlot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose image from Media Library"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveLibrarySlot(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "720px",
              maxHeight: "85vh",
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--line, #dfe4dc)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Choose from Media Library</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted, #5e6b63)" }}>
                  Assigning to {slots[activeLibrarySlot].labelEn} ({isLibraryTargetMobile ? "Mobile Override" : "Desktop"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveLibrarySlot(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "4px",
                }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                padding: "16px 20px",
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: "12px",
              }}
            >
              {mediaAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleSelectFromLibrary(asset.url)}
                  style={{
                    border: "1px solid var(--line, #dfe4dc)",
                    borderRadius: "6px",
                    padding: "6px",
                    background: "#faf9f6",
                    cursor: "pointer",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <div style={{ position: "relative", width: "100%", height: "90px", borderRadius: "4px", overflow: "hidden" }}>
                    <Image src={asset.url} alt={asset.filename} fill sizes="130px" style={{ objectFit: "cover" }} />
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--ink, #162c20)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "110px",
                    }}
                  >
                    {asset.filename}
                  </span>
                </button>
              ))}
              {mediaAssets.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px", color: "#888" }}>
                  No image assets in Media Library yet. Use direct upload instead.
                </div>
              )}
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--line, #dfe4dc)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveLibrarySlot(null)}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  background: "#fff",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

