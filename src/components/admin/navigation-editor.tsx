"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Image from "next/image";
import { uploadHomepageMedia, type UploadedMedia } from "@/app/admin/actions";

export type NavigationEditorItem = {
  id: string;
  labelEn: string;
  labelAr: string;
  url: string;
  visible: boolean;
  mobileVisible?: boolean;
  external: boolean;
  group?: string; // "primary" | "secondary"
  previewImageUrl?: string | null;
  previewImageUrlAr?: string | null;
  previewImageAltEn?: string | null;
  previewImageAltAr?: string | null;
  focalPoint?: string;
  sortOrder?: number;
};

export type GlobalMenuSettings = {
  menuMediaUrl: string;
  menuMediaAltEn?: string;
  menuMediaAltAr?: string;
  menuMediaFocalPoint?: string;
  morePagesLabelEn?: string;
  morePagesLabelAr?: string;
  menuFontSizeDesktop?: string;
  menuFontSizeMobile?: string;
};

export type PublishedProjectOption = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
};

const FOCAL_POINTS = [
  { value: "center", label: "Center (50% 50%)" },
  { value: "top", label: "Top (50% 20%)" },
  { value: "bottom", label: "Bottom (50% 80%)" },
  { value: "left", label: "Left (20% 50%)" },
  { value: "right", label: "Right (80% 50%)" },
];

const STANDARD_PAGE_PRESETS = [
  { labelEn: "Home", labelAr: "الرئيسية", url: "#top", group: "primary" },
  { labelEn: "About Us", labelAr: "من نحن", url: "/about", group: "primary" },
  { labelEn: "Projects", labelAr: "المشاريع", url: "/projects", group: "primary" },
  { labelEn: "Contact Us", labelAr: "تواصل معنا", url: "/contact", group: "primary" },
  { labelEn: "Careers", labelAr: "الوظائف", url: "/careers", group: "secondary" },
  { labelEn: "Journal", labelAr: "يومياتنا", url: "/journal", group: "secondary" },
  { labelEn: "History", labelAr: "تاريخنا", url: "/history", group: "secondary" },
  { labelEn: "Team", labelAr: "فريقنا", url: "/team", group: "secondary" },
  { labelEn: "Partners", labelAr: "شركاؤنا", url: "/partners", group: "secondary" },
];

const FALLBACK_SAFE_IMAGE =
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=86";

export function NavigationEditor({
  initialItems,
  globalSettings,
  publishedProjects = [],
  assets,
}: {
  initialItems: NavigationEditorItem[];
  globalSettings?: GlobalMenuSettings;
  publishedProjects?: PublishedProjectOption[];
  assets: UploadedMedia[];
}) {
  const [items, setItems] = useState<NavigationEditorItem[]>(initialItems);
  const [activeTab, setActiveTab] = useState<"links" | "images" | "appearance" | "preview">("links");

  // Global menu image & appearance settings
  const [defaultMenuUrl, setDefaultMenuUrl] = useState(
    globalSettings?.menuMediaUrl || "/images/menu.jpg"
  );
  const [defaultMenuFocal, setDefaultMenuFocal] = useState(
    globalSettings?.menuMediaFocalPoint || "center"
  );
  const [defaultAltEn, setDefaultAltEn] = useState(
    globalSettings?.menuMediaAltEn || "Image Developments architecture"
  );
  const [defaultAltAr, setDefaultAltAr] = useState(
    globalSettings?.menuMediaAltAr || "العمارة المعاصرة في إيمدج"
  );
  const [morePagesLabelEn, setMorePagesLabelEn] = useState(
    globalSettings?.morePagesLabelEn || "More Pages"
  );
  const [morePagesLabelAr, setMorePagesLabelAr] = useState(
    globalSettings?.morePagesLabelAr || "المزيد من الصفحات"
  );
  const [menuFontSizeDesktop, setMenuFontSizeDesktop] = useState(
    globalSettings?.menuFontSizeDesktop || "1.125rem"
  );
  const [menuFontSizeMobile, setMenuFontSizeMobile] = useState(
    globalSettings?.menuFontSizeMobile || "1rem"
  );

  // Expanded image drawer per item
  const [expandedImageDrawer, setExpandedImageDrawer] = useState<Record<string, boolean>>({});

  // Media Library modal state
  const [libraryTarget, setLibraryTarget] = useState<string | null>(null);

  // Live preview interactive state
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile" | "mobile-compact">("desktop");
  const [previewLocale, setPreviewLocale] = useState<"en" | "ar">("en");
  const [previewHoveredUrl, setPreviewHoveredUrl] = useState<string | null>(null);
  const [previewHoveredFocal, setPreviewHoveredFocal] = useState<string>("center");
  const [previewHoveredAlt, setPreviewHoveredAlt] = useState<string>("");
  const [previewMoreOpen, setPreviewMoreOpen] = useState(false);

  // Native drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Upload transition
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [, startUpload] = useTransition();

  // Dirty tracking for persistent bar
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);

  // Move link up or down
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    markDirty();
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const next = [...items];
    const draggedItem = next[draggedIndex];
    next.splice(draggedIndex, 1);
    next.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setItems(next);
    markDirty();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Update item field
  const updateItem = (id: string, patch: Partial<NavigationEditorItem>) => {
    setItems((curr) =>
      curr.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    markDirty();
  };

  // Normalize destination: automatically remove accidental locale prefixes like /en/ or /ar/
  const normalizeUrl = (raw: string) => {
    let trimmed = raw.trim();
    if (trimmed.startsWith("/en/")) trimmed = trimmed.replace("/en/", "/");
    else if (trimmed.startsWith("/ar/")) trimmed = trimmed.replace("/ar/", "/");
    else if (trimmed === "/en" || trimmed === "/ar") trimmed = "#top";
    return trimmed;
  };

  // Toggle group between primary and secondary
  const toggleGroup = (id: string) => {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const newGroup = item.group === "secondary" ? "primary" : "secondary";
    updateItem(id, { group: newGroup });
  };

  // Add preset link
  const addPreset = (preset: typeof STANDARD_PAGE_PRESETS[number]) => {
    const newItem: NavigationEditorItem = {
      id: `nav-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      labelEn: preset.labelEn,
      labelAr: preset.labelAr,
      url: preset.url,
      visible: true,
      mobileVisible: true,
      external: false,
      group: preset.group,
      previewImageUrl: "",
      previewImageUrlAr: "",
      previewImageAltEn: preset.labelEn,
      previewImageAltAr: preset.labelAr,
      focalPoint: "center",
    };
    setItems((curr) => [...curr, newItem]);
    markDirty();
  };

  // Add custom link
  const addCustomLink = () => {
    const newItem: NavigationEditorItem = {
      id: `nav-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      labelEn: "",
      labelAr: "",
      url: "",
      visible: true,
      mobileVisible: true,
      external: false,
      group: "primary",
      previewImageUrl: "",
      previewImageUrlAr: "",
      previewImageAltEn: "",
      previewImageAltAr: "",
      focalPoint: "center",
    };
    setItems((curr) => [...curr, newItem]);
    markDirty();
  };

  // Upload image helper
  const handleUploadImage = (targetKey: string, file?: File) => {
    if (!file) return;
    setUploadingField(targetKey);
    const data = new FormData();
    data.set("file", file);
    startUpload(async () => {
      try {
        const result = await uploadHomepageMedia(data, "IMAGE");
        if (result.asset) {
          if (targetKey === "global") {
            setDefaultMenuUrl(result.asset.url);
          } else {
            updateItem(targetKey, { previewImageUrl: result.asset.url });
          }
          markDirty();
        }
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setUploadingField(null);
      }
    });
  };

  // Filter items for preview
  const activePrimaryItems = items.filter(
    (item) => item.visible && (item.group || "primary") === "primary"
  );
  const activeSecondaryItems = items.filter(
    (item) => item.visible && item.group === "secondary"
  );
  const activeMobileItems = items.filter(
    (item) => item.mobileVisible !== false
  );

  return (
    <div className="nav-editor-root" style={{ width: "100%", maxWidth: "1200px" }}>
      {/* PERSISTENT ACTION & STATUS BAR */}
      <div
        className="nav-action-bar"
        style={{
          position: "sticky",
          top: "12px",
          zIndex: 40,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--line, #e2ded7)",
          borderRadius: "12px",
          padding: "12px 18px",
          marginBottom: "20px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className={activeTab === "links" ? "primary" : "secondary"}
            onClick={() => setActiveTab("links")}
            style={{ padding: "8px 14px", fontSize: "13px" }}
          >
            A. Menu Links ({items.length})
          </button>
          <button
            type="button"
            className={activeTab === "images" ? "primary" : "secondary"}
            onClick={() => setActiveTab("images")}
            style={{ padding: "8px 14px", fontSize: "13px" }}
          >
            B. Menu Images
          </button>
          <button
            type="button"
            className={activeTab === "appearance" ? "primary" : "secondary"}
            onClick={() => setActiveTab("appearance")}
            style={{ padding: "8px 14px", fontSize: "13px" }}
          >
            C. Labels & Appearance
          </button>
          <button
            type="button"
            className={activeTab === "preview" ? "primary" : "secondary"}
            onClick={() => setActiveTab("preview")}
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              background: activeTab === "preview" ? "#b36f55" : undefined,
              borderColor: activeTab === "preview" ? "#b36f55" : undefined,
            }}
          >
            D. Live Preview
          </button>
        </div>

        {/* Status & Immediate Notice */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: isDirty ? "#b36f55" : "#2a6543",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: isDirty ? "#b36f55" : "#2a6543",
                display: "inline-block",
              }}
            />
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </span>

          <span style={{ fontSize: "11px", color: "var(--muted, #666)", display: "none" }}>
            Save Changes updates the live navigation immediately.
          </span>

          <button
            type="submit"
            className="primary"
            style={{ padding: "9px 20px", fontSize: "13px", fontWeight: 600 }}
          >
            Save Navigation
          </button>
        </div>
      </div>

      {/* HIDDEN INPUTS TO GUARANTEE COMPLETE FORM SERIALIZATION */}
      <input type="hidden" name="defaultMenuMediaUrl" value={defaultMenuUrl} />
      <input type="hidden" name="defaultMenuMediaFocalPoint" value={defaultMenuFocal} />
      <input type="hidden" name="defaultMenuMediaAltEn" value={defaultAltEn} />
      <input type="hidden" name="defaultMenuMediaAltAr" value={defaultAltAr} />
      <input type="hidden" name="morePagesLabelEn" value={morePagesLabelEn} />
      <input type="hidden" name="morePagesLabelAr" value={morePagesLabelAr} />
      <input type="hidden" name="menuFontSizeDesktop" value={menuFontSizeDesktop} />
      <input type="hidden" name="menuFontSizeMobile" value={menuFontSizeMobile} />

      {/* ========================================================================= */}
      {/* TAB A: MENU LINKS                                                        */}
      {/* ========================================================================= */}
      <div style={{ display: activeTab === "links" ? "block" : "none" }}>
        <section className="panel" style={{ borderRadius: "10px", padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              borderBottom: "1px solid var(--line, #e2ded7)",
              paddingBottom: "14px",
              marginBottom: "16px",
            }}
          >
            <div>
              <h2 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--forest, #152a20)" }}>
                Main and Secondary Menu Links
              </h2>
              <p className="hint" style={{ margin: 0, fontSize: "12.5px" }}>
                Organize primary desktop links, expandable More Pages links, and mobile visibility. Drag or use the arrows to reorder.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Presets dropdown */}
              <select
                onChange={(e) => {
                  const preset = STANDARD_PAGE_PRESETS.find((p) => p.url === e.target.value);
                  if (preset) {
                    addPreset(preset);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                style={{
                  padding: "7px 12px",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  border: "1px solid var(--border, #d1cdc7)",
                  background: "#faf9f6",
                  cursor: "pointer",
                }}
              >
                <option value="" disabled>+ Add Page Shortcut...</option>
                {STANDARD_PAGE_PRESETS.map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.labelEn} ({p.labelAr})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="secondary"
                onClick={addCustomLink}
                style={{ padding: "7px 12px", fontSize: "12.5px" }}
              >
                + Add Custom Link
              </button>
            </div>
          </div>

          {/* Links List with Compact Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {items.map((item, index) => {
              const isSecondary = item.group === "secondary";
              const isImageExpanded = !!expandedImageDrawer[item.id];
              const isFirst = index === 0;
              const isLast = index === items.length - 1;

              // Duplicate destination detection
              const isDuplicate =
                item.url &&
                items.some(
                  (other) => other.id !== item.id && other.url.trim() === item.url.trim()
                );

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    border: "1px solid var(--line, #e2ded7)",
                    borderRadius: "8px",
                    background: isSecondary ? "#fcfbfa" : "#ffffff",
                    padding: "14px 16px",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    transition: "box-shadow 0.15s ease",
                  }}
                >
                  {/* Hidden inputs submitted in the FormData */}
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name={`group_${item.id}`} value={item.group || "primary"} />
                  <input
                    type="hidden"
                    name={`previewImageUrl_${item.id}`}
                    value={item.previewImageUrl || ""}
                  />
                  <input
                    type="hidden"
                    name={`previewImageUrlAr_${item.id}`}
                    value={item.previewImageUrlAr || ""}
                  />
                  <input
                    type="hidden"
                    name={`previewImageAltEn_${item.id}`}
                    value={item.previewImageAltEn || ""}
                  />
                  <input
                    type="hidden"
                    name={`previewImageAltAr_${item.id}`}
                    value={item.previewImageAltAr || ""}
                  />
                  <input
                    type="hidden"
                    name={`focalPoint_${item.id}`}
                    value={item.focalPoint || "center"}
                  />

                  {/* Top Row: Handle, Badges, Move & Remove */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                      borderBottom: "1px solid rgba(0,0,0,0.05)",
                      paddingBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        title="Drag to reorder"
                        style={{ cursor: "grab", color: "#8c8780", fontSize: "16px", userSelect: "none" }}
                      >
                        ⋮⋮
                      </span>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: isSecondary ? "rgba(179, 111, 85, 0.12)" : "rgba(21, 42, 32, 0.08)",
                          color: isSecondary ? "#964f37" : "#152a20",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {isSecondary ? "Secondary (More Pages)" : "Primary Menu"}
                      </span>
                      <strong style={{ fontSize: "13.5px", color: "var(--ink, #111)" }}>
                        {item.labelEn || "Untitled Link"}
                      </strong>
                      {item.labelAr && (
                        <span style={{ fontSize: "12.5px", color: "var(--muted, #666)", direction: "rtl" }}>
                          ({item.labelAr})
                        </span>
                      )}
                      {item.previewImageUrl && (
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            background: "rgba(42, 101, 67, 0.1)",
                            color: "#2a6543",
                            borderRadius: "4px",
                          }}
                        >
                          📷 Custom Photo
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        className="secondary compact"
                        onClick={() => toggleGroup(item.id)}
                        style={{ fontSize: "11px", padding: "3px 8px" }}
                        title="Toggle between Primary and Secondary group"
                      >
                        {isSecondary ? "↑ Move to Primary" : "↓ Move to Secondary"}
                      </button>
                      <button
                        type="button"
                        className="secondary compact"
                        onClick={() => move(index, -1)}
                        disabled={isFirst}
                        aria-label="Move up"
                        title="Move link up"
                        style={{ fontSize: "11px", padding: "3px 8px" }}
                      >
                        ▲ Up
                      </button>
                      <button
                        type="button"
                        className="secondary compact"
                        onClick={() => move(index, 1)}
                        disabled={isLast}
                        aria-label="Move down"
                        title="Move link down"
                        style={{ fontSize: "11px", padding: "3px 8px" }}
                      >
                        ▼ Down
                      </button>
                      <button
                        type="button"
                        className="media-remove compact"
                        onClick={() => {
                          if (confirm(`Remove "${item.labelEn || "this link"}" from navigation?`)) {
                            setItems((curr) => curr.filter((c) => c.id !== item.id));
                            markDirty();
                          }
                        }}
                        style={{ fontSize: "11px", padding: "3px 8px" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Main Inputs Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: "12px",
                      alignItems: "start",
                    }}
                  >
                    <label style={{ margin: 0, fontSize: "12px" }}>
                      English Label
                      <input
                        name={`labelEn_${item.id}`}
                        value={item.labelEn}
                        onChange={(e) => updateItem(item.id, { labelEn: e.target.value })}
                        required
                        maxLength={80}
                        placeholder="e.g. Projects"
                        style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                      />
                    </label>

                    <label style={{ margin: 0, fontSize: "12px" }}>
                      Arabic Label (العربية)
                      <input
                        name={`labelAr_${item.id}`}
                        value={item.labelAr}
                        onChange={(e) => updateItem(item.id, { labelAr: e.target.value })}
                        dir="rtl"
                        required
                        maxLength={80}
                        placeholder="مثال: المشاريع"
                        style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                      />
                    </label>

                    {/* Destination with Picker & Auto-Normalization */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ margin: 0, fontSize: "12px" }}>Destination URL</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              updateItem(item.id, { url: normalizeUrl(e.target.value) });
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            border: "1px solid var(--line, #ccc)",
                            background: "#faf9f6",
                            cursor: "pointer",
                          }}
                        >
                          <option value="" disabled>Pick Destination...</option>
                          <optgroup label="Standard Pages">
                            {STANDARD_PAGE_PRESETS.map((p) => (
                              <option key={p.url} value={p.url}>
                                {p.labelEn} ({p.url})
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

                      <input
                        name={`url_${item.id}`}
                        value={item.url}
                        onChange={(e) => updateItem(item.id, { url: normalizeUrl(e.target.value) })}
                        required
                        placeholder="/about, /projects or https://..."
                        maxLength={500}
                        style={{
                          padding: "7px 10px",
                          fontSize: "13px",
                          borderColor: isDuplicate ? "#b36f55" : undefined,
                        }}
                      />
                      {isDuplicate && (
                        <span style={{ fontSize: "10.5px", color: "#b36f55" }}>
                          ⚠ Notice: Another active link already uses this destination.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Device Visibility & Custom Image Drawer Toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                      background: "rgba(0, 0, 0, 0.02)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "18px", alignItems: "center", flexWrap: "wrap" }}>
                      <label className="check" style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "12px" }}>
                        <input
                          name={`visible_${item.id}`}
                          type="checkbox"
                          checked={item.visible}
                          onChange={(e) => updateItem(item.id, { visible: e.target.checked })}
                        />
                        <span style={{ fontWeight: 600 }}>Desktop</span>
                      </label>

                      <label className="check" style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "12px" }}>
                        <input
                          name={`mobileVisible_${item.id}`}
                          type="checkbox"
                          checked={item.mobileVisible !== false}
                          onChange={(e) => updateItem(item.id, { mobileVisible: e.target.checked })}
                        />
                        <span style={{ fontWeight: 600, color: "var(--forest, #152a20)" }}>Mobile</span>
                      </label>

                      <label className="check" style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "12px" }}>
                        <input
                          name={`external_${item.id}`}
                          type="checkbox"
                          checked={item.external}
                          onChange={(e) => updateItem(item.id, { external: e.target.checked })}
                        />
                        <span>Open in new tab</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() =>
                        setExpandedImageDrawer((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      style={{ fontSize: "11.5px", padding: "4px 10px" }}
                    >
                      {isImageExpanded
                        ? "▲ Close Photograph Drawer"
                        : item.previewImageUrl
                        ? "📷 Edit Custom Photograph"
                        : "＋ Assign Dedicated Photograph"}
                    </button>
                  </div>

                  {/* Collapsible Dedicated Image Drawer */}
                  {isImageExpanded && (
                    <div
                      style={{
                        border: "1px dashed rgba(42, 69, 52, 0.2)",
                        borderRadius: "8px",
                        background: "#faf9f6",
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: "13px" }}>Dedicated Hover Photograph</strong>
                          <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--muted, #666)" }}>
                            Appears in the desktop menu arch when this link is hovered or focused.
                          </p>
                        </div>

                        {item.previewImageUrl && (
                          <button
                            type="button"
                            className="media-remove compact"
                            onClick={() =>
                              updateItem(item.id, {
                                previewImageUrl: "",
                                previewImageUrlAr: "",
                                previewImageAltEn: "",
                                previewImageAltAr: "",
                              })
                            }
                            style={{ fontSize: "11px" }}
                          >
                            Remove Custom Photo
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                        {/* Compact Preview Frame */}
                        <div
                          style={{
                            width: "140px",
                            height: "90px",
                            borderRadius: "6px",
                            overflow: "hidden",
                            background: "#1c2b23",
                            position: "relative",
                            border: "1px solid rgba(0,0,0,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {item.previewImageUrl ? (
                            <Image
                              src={item.previewImageUrl}
                              alt={item.previewImageAltEn || item.labelEn}
                              fill
                              style={{
                                objectFit: "cover",
                                objectPosition: item.focalPoint || "center",
                              }}
                              sizes="140px"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = FALLBACK_SAFE_IMAGE;
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "6px" }}>
                              Uses Global Photo
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <label
                              className="secondary"
                              style={{
                                padding: "5px 10px",
                                fontSize: "12px",
                                cursor: "pointer",
                                margin: 0,
                                borderRadius: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              {uploadingField === item.id ? "Uploading…" : item.previewImageUrl ? "Replace" : "Upload File"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                style={{ display: "none" }}
                                onChange={(e) => handleUploadImage(item.id, e.target.files?.[0])}
                              />
                            </label>

                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setLibraryTarget(item.id)}
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                            >
                              Choose From Library
                            </button>
                          </div>

                          <label style={{ margin: 0, fontSize: "11.5px" }}>
                            Focal Point:
                            <select
                              value={item.focalPoint || "center"}
                              onChange={(e) => updateItem(item.id, { focalPoint: e.target.value })}
                              style={{ marginLeft: "6px", fontSize: "11.5px", padding: "3px 6px" }}
                            >
                              {FOCAL_POINTS.map((fp) => (
                                <option key={fp.value} value={fp.value}>
                                  {fp.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>

                      {/* Localized Alt Text Inputs */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <label style={{ margin: 0, fontSize: "11.5px" }}>
                          English Image Description (Alt Text)
                          <input
                            value={item.previewImageAltEn || ""}
                            onChange={(e) => updateItem(item.id, { previewImageAltEn: e.target.value })}
                            placeholder="e.g. Contemporary residential villa"
                            style={{ fontSize: "12px", padding: "5px 8px", marginTop: "3px" }}
                          />
                        </label>
                        <label style={{ margin: 0, fontSize: "11.5px" }}>
                          Arabic Image Description (العربية)
                          <input
                            value={item.previewImageAltAr || ""}
                            onChange={(e) => updateItem(item.id, { previewImageAltAr: e.target.value })}
                            dir="rtl"
                            placeholder="مثال: فيلا سكنية معاصرة"
                            style={{ fontSize: "12px", padding: "5px 8px", marginTop: "3px" }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!items.length && (
              <p className="empty">The navigation menu is currently empty. Add a link above.</p>
            )}
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* TAB B: MENU IMAGES                                                        */}
      {/* ========================================================================= */}
      <div style={{ display: activeTab === "images" ? "block" : "none" }}>
        <section className="panel" style={{ borderRadius: "10px", padding: "20px" }}>
          <div style={{ borderBottom: "1px solid var(--line, #e2ded7)", paddingBottom: "14px", marginBottom: "18px" }}>
            <h2 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--forest, #152a20)" }}>
              Global Default Menu Photograph
            </h2>
            <p className="hint" style={{ margin: 0, fontSize: "12.5px" }}>
              This photograph appears in the desktop menu arch panel by default, and acts as the fallback for links without a dedicated custom image.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "24px",
              alignItems: "start",
            }}
          >
            {/* Compact Preview & Upload Card */}
            <div
              style={{
                border: "1px solid var(--line, #e2ded7)",
                borderRadius: "8px",
                padding: "16px",
                background: "#faf9f6",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/10",
                  borderRadius: "6px",
                  overflow: "hidden",
                  background: "#1c2b23",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  src={defaultMenuUrl || FALLBACK_SAFE_IMAGE}
                  alt={defaultAltEn}
                  fill
                  sizes="300px"
                  style={{
                    objectFit: "cover",
                    objectPosition: defaultMenuFocal,
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_SAFE_IMAGE;
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <label
                  className="secondary"
                  style={{
                    padding: "7px 12px",
                    fontSize: "12.5px",
                    cursor: "pointer",
                    margin: 0,
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {uploadingField === "global" ? "Uploading…" : "Upload New Photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    style={{ display: "none" }}
                    onChange={(e) => handleUploadImage("global", e.target.files?.[0])}
                  />
                </label>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => setLibraryTarget("global")}
                  style={{ padding: "7px 12px", fontSize: "12.5px" }}
                >
                  Choose From Library
                </button>

                {defaultMenuUrl && (
                  <button
                    type="button"
                    className="media-remove"
                    onClick={() => {
                      setDefaultMenuUrl("/images/menu.jpg");
                      markDirty();
                    }}
                    style={{ padding: "7px 12px", fontSize: "12.5px" }}
                  >
                    Reset to Default
                  </button>
                )}
              </div>

              <div style={{ fontSize: "11.5px", color: "var(--muted, #666)" }}>
                Current path: <code>{defaultMenuUrl}</code>
              </div>
            </div>

            {/* Focal Point & Localized Alt Texts */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ margin: 0, fontSize: "12.5px" }}>
                Default Cropping Center (Focal Point)
                <select
                  value={defaultMenuFocal}
                  onChange={(e) => {
                    setDefaultMenuFocal(e.target.value);
                    markDirty();
                  }}
                  style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                >
                  {FOCAL_POINTS.map((fp) => (
                    <option key={fp.value} value={fp.value}>
                      {fp.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ margin: 0, fontSize: "12.5px" }}>
                English Image Description
                <input
                  value={defaultAltEn}
                  onChange={(e) => {
                    setDefaultAltEn(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. Modern architectural façade"
                  style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                />
              </label>

              <label style={{ margin: 0, fontSize: "12.5px" }}>
                Arabic Image Description (العربية)
                <input
                  value={defaultAltAr}
                  onChange={(e) => {
                    setDefaultAltAr(e.target.value);
                    markDirty();
                  }}
                  dir="rtl"
                  placeholder="مثال: واجهة معمارية راقية"
                  style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                />
              </label>

              {/* Hierarchy explanation */}
              <div
                style={{
                  background: "rgba(42, 69, 52, 0.05)",
                  border: "1px solid rgba(42, 69, 52, 0.15)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  fontSize: "12px",
                  color: "var(--forest, #152a20)",
                  lineHeight: 1.5,
                }}
              >
                <strong>Photograph Fallback Hierarchy:</strong>
                <ol style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
                  <li>Individual link dedicated photograph (if configured).</li>
                  <li>This global default menu photograph.</li>
                  <li>Clean brand default (never a broken icon or browser failure).</li>
                </ol>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* TAB C: LABELS & APPEARANCE                                                */}
      {/* ========================================================================= */}
      <div style={{ display: activeTab === "appearance" ? "block" : "none" }}>
        <section className="panel" style={{ borderRadius: "10px", padding: "20px" }}>
          <div style={{ borderBottom: "1px solid var(--line, #e2ded7)", paddingBottom: "14px", marginBottom: "18px" }}>
            <h2 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--forest, #152a20)" }}>
              Menu Labels and Typography Sizing
            </h2>
            <p className="hint" style={{ margin: 0, fontSize: "12.5px" }}>
              Control the expandable More Pages toggle label and responsive font scales across viewports.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            {/* More Pages accordion labels */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <h3 style={{ fontSize: "14px", margin: "0 0 4px" }}>More Pages Accordion Button</h3>
              <label style={{ margin: 0, fontSize: "12.5px" }}>
                English Label
                <input
                  value={morePagesLabelEn}
                  onChange={(e) => {
                    setMorePagesLabelEn(e.target.value);
                    markDirty();
                  }}
                  placeholder="More Pages"
                  style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                />
              </label>

              <label style={{ margin: 0, fontSize: "12.5px" }}>
                Arabic Label (العربية)
                <input
                  value={morePagesLabelAr}
                  onChange={(e) => {
                    setMorePagesLabelAr(e.target.value);
                    markDirty();
                  }}
                  dir="rtl"
                  placeholder="المزيد من الصفحات"
                  style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                />
              </label>
            </div>

            {/* Typography Sizing Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <h3 style={{ fontSize: "14px", margin: "0 0 4px" }}>Menu Link Font Sizing</h3>
              <label style={{ margin: 0, fontSize: "12.5px" }}>
                Desktop Menu Text Size
                <select
                  value={menuFontSizeDesktop}
                  onChange={(e) => {
                    setMenuFontSizeDesktop(e.target.value);
                    markDirty();
                  }}
                  style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                >
                  <option value="1rem">Standard (16px)</option>
                  <option value="1.125rem">Recommended (18px)</option>
                  <option value="1.25rem">Large (20px)</option>
                  <option value="1.375rem">Extra Large (22px)</option>
                </select>
              </label>

              <label style={{ margin: 0, fontSize: "12.5px" }}>
                Mobile Menu Text Size
                <select
                  value={menuFontSizeMobile}
                  onChange={(e) => {
                    setMenuFontSizeMobile(e.target.value);
                    markDirty();
                  }}
                  style={{ marginTop: "4px", padding: "7px 10px", fontSize: "13px" }}
                >
                  <option value="0.9375rem">Compact (15px)</option>
                  <option value="1rem">Standard (16px)</option>
                  <option value="1.125rem">Large (18px)</option>
                </select>
              </label>

              <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "var(--muted, #666)" }}>
                Looking for site-wide heading scales? Visit <a href="/admin/typography" target="_blank" style={{ color: "#b36f55" }}>Typography Settings</a>.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* TAB D: LIVE PREVIEW                                                       */}
      {/* ========================================================================= */}
      <div style={{ display: activeTab === "preview" ? "block" : "none" }}>
        <section
          className="panel"
          style={{
            border: "1px solid var(--line, #e2ded7)",
            background: "#152a20",
            color: "#ffffff",
            padding: "28px",
            borderRadius: "14px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
          }}
        >
          {/* Top Preview Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              paddingBottom: "16px",
              marginBottom: "20px",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#b36f55", fontWeight: 700 }}>
                Live Menu Preview (Unsaved Changes Reflected)
              </span>
              <h2 style={{ color: "#ffffff", margin: "4px 0 2px", fontSize: "18px" }}>
                {previewViewport === "desktop" ? "Desktop Menu Architecture" : "Mobile Phone View"}
              </h2>
            </div>

            {/* Viewport & Locale Switches */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Language Switch */}
              <div style={{ display: "inline-flex", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setPreviewLocale("en")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: previewLocale === "en" ? "#b36f55" : "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  English (LTR)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLocale("ar")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: previewLocale === "ar" ? "#b36f55" : "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  العربية (RTL)
                </button>
              </div>

              {/* Viewport Switch */}
              <div style={{ display: "inline-flex", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setPreviewViewport("desktop")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: previewViewport === "desktop" ? "#b36f55" : "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Desktop View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport("mobile")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: previewViewport === "mobile" ? "#b36f55" : "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Mobile (390px)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport("mobile-compact")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: previewViewport === "mobile-compact" ? "#b36f55" : "transparent",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Compact (320px)
                </button>
              </div>
            </div>
          </div>

          {/* PREVIEW CONTAINER */}
          {previewViewport === "desktop" ? (
            /* DESKTOP PREVIEW SIMULATOR */
            <div
              dir={previewLocale === "ar" ? "rtl" : "ltr"}
              style={{
                display: "grid",
                gridTemplateColumns: previewLocale === "ar" ? "0.9fr 1.1fr" : "1.1fr 0.9fr",
                gap: "36px",
                background: "#1b3327",
                borderRadius: "12px",
                padding: "32px",
                alignItems: "center",
              }}
            >
              {/* Links Column */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#b36f55",
                    marginBottom: "12px",
                    fontWeight: 700,
                  }}
                >
                  {previewLocale === "ar"
                    ? `المشاريع والروابط الرئيسية (${activePrimaryItems.length})`
                    : `Primary Links (${activePrimaryItems.length})`}
                </div>

                {activePrimaryItems.map((item) => {
                  const targetUrl = item.previewImageUrl || defaultMenuUrl;
                  const label = previewLocale === "ar" ? item.labelAr || item.labelEn : item.labelEn;
                  const isHovered = previewHoveredUrl === targetUrl;

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => {
                        setPreviewHoveredUrl(targetUrl);
                        setPreviewHoveredFocal(item.focalPoint || "center");
                        setPreviewHoveredAlt(
                          previewLocale === "ar"
                            ? item.previewImageAltAr || item.labelAr
                            : item.previewImageAltEn || item.labelEn
                        );
                      }}
                      onFocus={() => {
                        setPreviewHoveredUrl(targetUrl);
                        setPreviewHoveredFocal(item.focalPoint || "center");
                        setPreviewHoveredAlt(
                          previewLocale === "ar"
                            ? item.previewImageAltAr || item.labelAr
                            : item.previewImageAltEn || item.labelEn
                        );
                      }}
                      tabIndex={0}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                        cursor: "pointer",
                        transition: "color 0.25s ease, transform 0.25s ease",
                        color: isHovered ? "#b36f55" : "#ffffff",
                        fontSize: menuFontSizeDesktop,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: "12px", opacity: 0.5 }}>{item.url}</span>
                    </div>
                  );
                })}

                {/* Secondary More Pages Accordion */}
                {activeSecondaryItems.length > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <button
                      type="button"
                      onClick={() => setPreviewMoreOpen((v) => !v)}
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px dashed rgba(255, 255, 255, 0.3)",
                        color: "#b36f55",
                        cursor: "pointer",
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        {previewLocale === "ar" ? morePagesLabelAr : morePagesLabelEn} ({activeSecondaryItems.length})
                      </span>
                      <span>{previewMoreOpen ? "▲" : "▼"}</span>
                    </button>

                    {previewMoreOpen && (
                      <div style={{ display: "flex", flexDirection: "column", paddingInlineStart: "16px", marginTop: "10px" }}>
                        {activeSecondaryItems.map((item) => {
                          const targetUrl = item.previewImageUrl || defaultMenuUrl;
                          const label = previewLocale === "ar" ? item.labelAr || item.labelEn : item.labelEn;
                          const isHovered = previewHoveredUrl === targetUrl;

                          return (
                            <div
                              key={item.id}
                              onMouseEnter={() => {
                                setPreviewHoveredUrl(targetUrl);
                                setPreviewHoveredFocal(item.focalPoint || "center");
                                setPreviewHoveredAlt(
                                  previewLocale === "ar"
                                    ? item.previewImageAltAr || item.labelAr
                                    : item.previewImageAltEn || item.labelEn
                                );
                              }}
                              onFocus={() => {
                                setPreviewHoveredUrl(targetUrl);
                                setPreviewHoveredFocal(item.focalPoint || "center");
                                setPreviewHoveredAlt(
                                  previewLocale === "ar"
                                    ? item.previewImageAltAr || item.labelAr
                                    : item.previewImageAltEn || item.labelEn
                                );
                              }}
                              tabIndex={0}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 0",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                                cursor: "pointer",
                                color: isHovered ? "#b36f55" : "rgba(255, 255, 255, 0.85)",
                                fontSize: "15px",
                              }}
                            >
                              <span>{label}</span>
                              <span style={{ fontSize: "11px", opacity: 0.5 }}>{item.url}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Arch Architectural Image Column */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "360px",
                    borderRadius: "100px 100px 0 0",
                    overflow: "hidden",
                    background: "#223d2f",
                    boxShadow: "0 16px 36px rgba(0,0,0,0.35)",
                  }}
                >
                  <Image
                    src={previewHoveredUrl || defaultMenuUrl || FALLBACK_SAFE_IMAGE}
                    alt={previewHoveredAlt || defaultAltEn}
                    fill
                    sizes="35vw"
                    style={{
                      objectFit: "cover",
                      objectPosition: previewHoveredFocal || defaultMenuFocal,
                      transition: "opacity 0.25s ease-in-out",
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_SAFE_IMAGE;
                    }}
                  />
                </div>
                <span style={{ marginTop: "10px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                  {previewHoveredUrl ? "Previewing link-specific hover photograph" : "Showing global default menu photograph"}
                </span>
              </div>
            </div>
          ) : (
            /* MOBILE PREVIEW SIMULATOR (390px or 320px) */
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
              <div
                dir={previewLocale === "ar" ? "rtl" : "ltr"}
                style={{
                  width: previewViewport === "mobile-compact" ? "320px" : "390px",
                  maxWidth: "100%",
                  background: "#152a20",
                  border: "2px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: "24px",
                  padding: "24px 20px",
                  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.45)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {/* Mobile Top Controls Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ fontSize: "20px", lineHeight: 1, opacity: 0.8 }}>×</span>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                      {previewLocale === "ar" ? "English" : "العربية"}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#b36f55", fontWeight: 700 }}>
                    Mobile Menu
                  </span>
                </div>

                {/* Mobile Links List */}
                <div style={{ display: "flex", flexDirection: "column", maxHeight: "400px", overflowY: "auto" }}>
                  {activeMobileItems.map((item) => {
                    const label = previewLocale === "ar" ? item.labelAr || item.labelEn : item.labelEn;
                    const isSecondary = item.group === "secondary";

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: isSecondary ? "9px 0" : "12px 0",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "#ffffff",
                        }}
                      >
                        <span
                          style={{
                            fontSize: isSecondary ? "14px" : menuFontSizeMobile,
                            fontWeight: isSecondary ? 400 : 500,
                            color: isSecondary ? "rgba(255,255,255,0.85)" : "#ffffff",
                          }}
                        >
                          {label}
                        </span>
                        <span style={{ fontSize: "11px", opacity: 0.4 }}>{item.url}</span>
                      </div>
                    );
                  })}

                  {!activeMobileItems.length && (
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", padding: "16px 0" }}>
                      No links are marked visible on mobile.
                    </p>
                  )}
                </div>

                {/* Mobile Call Back Button */}
                <button
                  type="button"
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: "999px",
                    background: "#b36f55",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {previewLocale === "ar" ? "طلب معاودة الاتصال" : "Request a Call Back"}
                </button>

                <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
                  17087 • hello@imagedevelopments.com
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* MEDIA LIBRARY MODAL                                                       */}
      {/* ========================================================================= */}
      {libraryTarget && (
        <div
          className="media-library-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLibraryTarget(null);
          }}
        >
          <div
            className="media-library-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Choose photograph from Media Library"
          >
            <div className="section-title">
              <div>
                <h3>Choose From Media Library</h3>
                <p className="hint">Select an existing photograph to attach to this navigation element.</p>
              </div>
              <button
                type="button"
                className="media-remove"
                onClick={() => setLibraryTarget(null)}
              >
                Close
              </button>
            </div>

            <div className="media-library-options">
              {assets.length ? (
                assets.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    onClick={() => {
                      if (libraryTarget === "global") {
                        setDefaultMenuUrl(asset.url);
                      } else {
                        updateItem(libraryTarget, { previewImageUrl: asset.url });
                      }
                      markDirty();
                      setLibraryTarget(null);
                    }}
                  >
                    <span className="media-library-thumb">
                      <Image src={asset.url} alt="" fill sizes="180px" />
                    </span>
                    <b>{asset.filename}</b>
                    <span>{asset.mimeType}</span>
                  </button>
                ))
              ) : (
                <p className="empty">No uploaded image assets found. Upload directly from your device.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
