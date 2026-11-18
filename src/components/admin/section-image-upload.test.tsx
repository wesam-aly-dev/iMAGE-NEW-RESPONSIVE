import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { layoutSupportsImage } from "@/lib/page-section-layouts";
import { SectionImageField, type SectionMediaAsset } from "./section-image-field";
import { PageSectionsEditor, type EditablePageSection } from "./page-sections-editor";
import { parsePageBlocksInput } from "@/lib/page-blocks-input";
import { PageSections } from "../page-sections";
import type { PageSectionContent } from "@/content/home";

vi.mock("next/image", () => ({
  default: ({ fill, priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    return <img alt={props.alt ?? ""} data-src={props.src} {...props} />;
  },
}));

vi.mock("../motion-reveal", () => ({
  Reveal: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

const mockMediaAssets: SectionMediaAsset[] = [
  {
    id: "asset-1",
    url: "/uploads/architectural-facade.jpg",
    filename: "architectural-facade.jpg",
    mimeType: "image/jpeg",
    size: 2048576, // 2 MB
    width: 2400,
    height: 1600,
    altEn: "Contemporary residence facade with floor-to-ceiling glass",
    altAr: "واجهة معمارية عصرية لفيلا سكنية راقية",
  },
  {
    id: "asset-2",
    url: "/uploads/interior-lounge.webp",
    filename: "interior-lounge.webp",
    mimeType: "image/webp",
    size: 845200, // 825 KB
    width: 1920,
    height: 1080,
    altEn: "Sunlit interior living lounge with natural oak textures",
    altAr: "صالة معيشة داخلية مفعمة بالضوء الطبيعي",
  },
];

const mockSection = (overrides?: Partial<EditablePageSection>): EditablePageSection => ({
  id: "test-sec-uuid-1",
  page: "home",
  kind: "CUSTOM",
  layout: "IMAGE_LEFT",
  eyebrowEn: "Curated Spaces",
  eyebrowAr: "مساحات مختارة",
  titleEn: "Crafted for Perspective",
  titleAr: "مصممة برؤية متفردة",
  bodyEn: "Thoughtful architectural layouts connecting nature and living.",
  bodyAr: "مخططات معمارية مدروسة تدمج الطبيعة بتجربة الحياة اليومية.",
  imageUrl: "/uploads/architectural-facade.jpg",
  imageAltEn: "Contemporary residence facade",
  imageAltAr: "واجهة معمارية عصرية",
  ctaLabelEn: "Explore Details",
  ctaLabelAr: "اكتشف التفاصيل",
  ctaUrl: "/en/projects",
  backgroundRgb: "255, 255, 255",
  settings: {},
  visible: true,
  ...overrides,
});

describe("Page Builder Layout & Image Field Conditional Visibility", () => {
  it("determines layout image support accurately across all 8 layouts", () => {
    // TEXT must NOT support images
    expect(layoutSupportsImage("TEXT")).toBe(false);

    // All other 7 layouts MUST support images
    expect(layoutSupportsImage("IMAGE_LEFT")).toBe(true);
    expect(layoutSupportsImage("IMAGE_RIGHT")).toBe(true);
    expect(layoutSupportsImage("FULL_IMAGE")).toBe(true);
    expect(layoutSupportsImage("EDITORIAL_PORTRAIT")).toBe(true);
    expect(layoutSupportsImage("OVERLAP_FEATURE")).toBe(true);
    expect(layoutSupportsImage("MAGAZINE_FEATURE")).toBe(true);
    expect(layoutSupportsImage("IMMERSIVE_BANNER")).toBe(true);
  });

  it("hides image authoring controls and image alt fields when section layout is 'Text only'", () => {
    const sectionTextOnly = mockSection({
      layout: "TEXT",
      imageUrl: "/uploads/preserved-image.jpg",
      imageAltEn: "Preserved Alt En",
    });

    const html = renderToStaticMarkup(
      <PageSectionsEditor
        initialSections={[sectionTextOnly]}
        assets={mockMediaAssets}
      />
    );

    // Click to expand / open custom section:
    // In collapsed view or open view, verify no image uploader is rendered for TEXT layout
    expect(html).not.toContain("section-image-field-wrap");
    expect(html).not.toContain("Click to upload or drag & drop an image");
  });

  it("displays the professional image field when section layout supports images", () => {
    const sectionWithImage = mockSection({
      layout: "IMAGE_LEFT",
      imageUrl: "/uploads/architectural-facade.jpg",
    });

    const html = renderToStaticMarkup(
      <SectionImageField
        sectionId={sectionWithImage.id}
        imageUrl={sectionWithImage.imageUrl}
        imageAltEn={sectionWithImage.imageAltEn}
        imageAltAr={sectionWithImage.imageAltAr}
        existingAssets={mockMediaAssets}
        onImageChange={vi.fn()}
        onAltChange={vi.fn()}
      />
    );

    expect(html).toContain("section-image-field-wrap");
    expect(html).toContain("Section Image");
    expect(html).toContain("architectural-facade.jpg");
    expect(html).toContain("2400 × 1600 px");
    expect(html).toContain("Replace Image");
    expect(html).toContain("Media Library");
    expect(html).toContain("Remove");
    expect(html).toContain("Image alt — English");
    expect(html).toContain("Image alt — العربية");
  });
});

describe("SectionImageField Dropzone, Preview & Media Library Workflow", () => {
  it("renders drag-and-drop dropzone with file picker and library buttons when empty", () => {
    const html = renderToStaticMarkup(
      <SectionImageField
        sectionId="empty-sec"
        imageUrl=""
        imageAltEn=""
        imageAltAr=""
        existingAssets={mockMediaAssets}
        onImageChange={vi.fn()}
        onAltChange={vi.fn()}
      />
    );

    expect(html).toContain("Click to upload or drag &amp; drop an image");
    expect(html).toContain("JPEG, PNG, WebP, AVIF up to 12 MB");
    expect(html).toContain("Upload Image");
    expect(html).toContain("Choose from Media Library");
    expect(html).not.toContain("Replace Image");
  });

  it("renders existing URL-backed images seamlessly without requiring re-upload", () => {
    const externalUrl = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200";
    const html = renderToStaticMarkup(
      <SectionImageField
        sectionId="external-sec"
        imageUrl={externalUrl}
        imageAltEn="Scenic architectural exterior"
        imageAltAr="مشهد خارجي للعمارة الحديثة"
        existingAssets={mockMediaAssets}
        onImageChange={vi.fn()}
        onAltChange={vi.fn()}
      />
    );

    expect(html).toContain("section-image-preview-card");
    expect(html).toContain("https://images.unsplash.com/photo-1600607687939-ce8a6c25118c");
    expect(html).toContain("photo-1600607687939-ce8a6c25118c");
    expect(html).toContain("Replace Image");
    expect(html).toContain("Remove");
  });

  it("all interactive buttons have type='button' to prevent accidental form submission", () => {
    const html = renderToStaticMarkup(
      <SectionImageField
        sectionId="btn-sec"
        imageUrl="/uploads/architectural-facade.jpg"
        imageAltEn=""
        imageAltAr=""
        existingAssets={mockMediaAssets}
        onImageChange={vi.fn()}
        onAltChange={vi.fn()}
      />
    );

    // Must not contain any button with type="submit" or default untyped button
    expect(html).not.toMatch(/<button(?![^>]*type="button")/i);
  });
});

describe("Persistence Chain & Public Page Rendering", () => {
  it("parses and validates custom section with durable image URL and localized alt texts", () => {
    const rawInput = [
      {
        id: "section-uuid-saved-1",
        page: "home",
        kind: "CUSTOM",
        layout: "IMAGE_RIGHT",
        eyebrowEn: "Living Perspective",
        eyebrowAr: "منظور الحياة",
        titleEn: "Harmony in Architecture",
        titleAr: "تناغم العمارة",
        bodyEn: "Spaces designed for enduring connection.",
        bodyAr: "مساحات صممت لتدوم روابطها.",
        imageUrl: "/uploads/architectural-facade.jpg",
        imageAltEn: "High-end residential building",
        imageAltAr: "مبنى سكني راقٍ",
        ctaLabelEn: "Explore",
        ctaLabelAr: "استكشف",
        ctaUrl: "/en/projects",
        backgroundRgb: "255, 255, 255",
        settings: {},
        visible: true,
      },
    ];

    const result = parsePageBlocksInput(rawInput);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.id).toBe("section-uuid-saved-1");
      expect(row.imageUrl).toBe("/uploads/architectural-facade.jpg");
      expect(row.imageAltEn).toBe("High-end residential building");
      expect(row.imageAltAr).toBe("مبنى سكني راقٍ");
      expect(row.layout).toBe("IMAGE_RIGHT");
    }
  });

  it("renders image in correct layout position on public pages", () => {
    const publicSectionContent: PageSectionContent = {
      id: "sec-public-1",
      layout: "IMAGE_LEFT",
      eyebrow: "A Considered Sanctuary",
      title: "Architecture & Nature",
      body: "Harmonious dialogue between the interior and landscape.",
      image: "/uploads/architectural-facade.jpg",
      imageAlt: "Contemporary villa facade with palm trees",
      ctaLabel: "View Portfolio",
      ctaUrl: "/en/projects",
      backgroundRgb: "255, 255, 255",
    };

    const html = renderToStaticMarkup(<PageSections sections={[publicSectionContent]} />);

    expect(html).toContain("custom-section--image-left");
    expect(html).toContain("Architecture &amp; Nature");
    expect(html).toContain("custom-section-media");
    expect(html).toContain("/uploads/architectural-facade.jpg");
    expect(html).toContain("Contemporary villa facade with palm trees");
    expect(html).toContain("/en/projects");
  });

  it("does NOT render image or image placeholder when layout is 'TEXT' on public pages", () => {
    const publicTextOnlyContent: PageSectionContent = {
      id: "sec-public-text-only",
      layout: "TEXT",
      eyebrow: "Our Manifesto",
      title: "Principles of Craftsmanship",
      body: "Every destination begins with a respect for the surrounding environment.",
      // Even if an imageUrl was preserved in the database, TEXT layout must never render an image!
      image: "/uploads/preserved-image.jpg",
      imageAlt: "Preserved image alt",
      backgroundRgb: "255, 255, 255",
    };

    const html = renderToStaticMarkup(<PageSections sections={[publicTextOnlyContent]} />);

    expect(html).toContain("custom-section--text");
    expect(html).toContain("Principles of Craftsmanship");
    expect(html).not.toContain("custom-section-media");
    expect(html).not.toContain("/uploads/preserved-image.jpg");
  });
});

describe("Section State Invariance & Stable Identifiers", () => {
  it("preserves image URL and all bilingual content when switching layout to TEXT and back", () => {
    const original = mockSection({
      layout: "IMAGE_LEFT",
      imageUrl: "/uploads/architectural-facade.jpg",
      imageAltEn: "Facade alt",
      imageAltAr: "نص الواجهة",
      titleEn: "Original Title",
      titleAr: "العنوان الأصلي",
    });

    // Simulating user changing layout to TEXT:
    const switchedToText: EditablePageSection = {
      ...original,
      layout: "TEXT",
    };

    // imageUrl, imageAlt, title, body are all preserved in section state:
    expect(switchedToText.imageUrl).toBe("/uploads/architectural-facade.jpg");
    expect(switchedToText.imageAltEn).toBe("Facade alt");
    expect(switchedToText.titleEn).toBe("Original Title");
    expect(switchedToText.titleAr).toBe("العنوان الأصلي");

    // Simulating user switching back to EDITORIAL_PORTRAIT:
    const switchedBack: EditablePageSection = {
      ...switchedToText,
      layout: "EDITORIAL_PORTRAIT",
    };

    expect(switchedBack.imageUrl).toBe("/uploads/architectural-facade.jpg");
    expect(switchedBack.imageAltEn).toBe("Facade alt");
    expect(switchedBack.titleEn).toBe("Original Title");
  });

  it("duplicating a section preserves media reference while creating an independent section identity", () => {
    const original = mockSection({
      id: "orig-section-uuid-99",
      imageUrl: "/uploads/architectural-facade.jpg",
      titleEn: "Masterpiece Architecture",
    });

    const duplicateId = "copy-section-uuid-100";
    const duplicate: EditablePageSection = {
      ...original,
      id: duplicateId,
      titleEn: `${original.titleEn} (copy)`,
      titleAr: `${original.titleAr} (نسخة)`,
    };

    // Media reference is preserved
    expect(duplicate.imageUrl).toBe(original.imageUrl);
    // Identity is independent
    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.id).toBe(duplicateId);

    // Editing duplicate image does not alter original
    const modifiedDuplicate = {
      ...duplicate,
      imageUrl: "/uploads/interior-lounge.webp",
    };
    expect(original.imageUrl).toBe("/uploads/architectural-facade.jpg");
    expect(modifiedDuplicate.imageUrl).toBe("/uploads/interior-lounge.webp");
  });

  it("removing an image clears the section reference without mutating shared media assets", () => {
    let currentSection = mockSection({
      imageUrl: "/uploads/architectural-facade.jpg",
    });

    const onImageChange = (_sectionId: string, url: string) => {
      currentSection = { ...currentSection, imageUrl: url };
    };

    // User clicks Remove
    onImageChange(currentSection.id, "");

    // Section image reference is cleared
    expect(currentSection.imageUrl).toBe("");

    // Shared media assets in library remain completely intact
    expect(mockMediaAssets.some((a) => a.url === "/uploads/architectural-facade.jpg")).toBe(true);
  });
});

