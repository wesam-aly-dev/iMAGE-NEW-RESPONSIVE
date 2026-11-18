import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HomeContent } from "@/content/home";
import { HomepageExperience, resolveHeroMedia } from "./homepage-experience";

vi.mock("next/image", () => ({
  default: ({ fill, priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    return <img alt={props.alt ?? ""} {...props} />;
  },
}));

vi.mock("./motion-reveal", () => ({
  Reveal: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("./smooth-scroll", () => ({
  SmoothScroll: () => null,
}));

vi.mock("./page-transition", () => ({
  usePageTransition: () => ({
    state: "idle",
    introActive: false,
    introPhase: "done",
    isInitialCinematic: false,
  }),
}));

const createMockContent = (overrides?: Partial<HomeContent["hero"]>, openingEnabled = true): HomeContent => ({
  locale: "en",
  dir: "ltr",
  nav: [],
  inquiryProjects: [],
  backgrounds: {
    opening: "10, 24, 16",
    hero: "10, 24, 16",
    about: "255, 255, 255",
    projects: "10, 24, 16",
    lifestyle: "10, 24, 16",
    stats: "245, 245, 245",
    journal: "255, 255, 255",
    closing: "10, 24, 16",
    footer: "10, 24, 16",
  },
  opening: {
    enabled: openingEnabled,
    headline: "A New Perspective",
    desktopVideo: "https://example.com/opening-video.mp4",
  },
  openingProject: {
    name: "Unrelated Opening Project",
    location: "New Cairo",
    image: "https://example.com/unrelated-opening-image.jpg",
  },
  hero: {
    enabled: true,
    eyebrow: "Refined Architecture",
    title: ["Crafting Spaces", "That Inspire Life"],
    note: "Pioneering architectural vision elevating communities.",
    scroll: "Scroll to explore",
    mediaType: "IMAGE",
    image: "https://example.com/desktop-hero.jpg",
    focalPoint: "center top",
    mobileMediaType: "INHERIT",
    mobileImage: "https://example.com/mobile-hero.jpg",
    mobileFocalPoint: "center center",
    desktopVideo: "https://example.com/desktop-hero.mp4",
    mobileVideo: "https://example.com/mobile-hero.mp4",
    poster: "https://example.com/desktop-poster.jpg",
    mobilePoster: "https://example.com/mobile-poster.jpg",
    alt: "Hero main view",
    ...overrides,
  },
  closing: {
    eyebrow: "Contact Us",
    title: "Get in Touch",
    cta: "Send Message",
  },
  common: {
    projects: "Projects",
    explore: "Explore",
    language: "العربية",
    menu: "Menu",
    close: "Close",
    contact: "Contact",
    rights: "All rights reserved",
    statsHeading: "Results",
  },
  about: {
    enabled: false,
    eyebrow: "",
    title: "",
    intro: "",
    milestones: [],
  },
  lifestyle: {
    enabled: true,
    eyebrow: "Lifestyle",
    title: "Beyond the building",
    slots: {
      topLeft: { url: "https://example.com/card1.jpg", alt: "Top Left", focalPoint: "center" },
      topRight: { url: "https://example.com/card2.jpg", alt: "Top Right", focalPoint: "top" },
      bottomLeft: { url: "https://example.com/card3.jpg", alt: "Bottom Left", focalPoint: "bottom" },
      bottomRight: { url: "https://example.com/card4.jpg", alt: "Bottom Right", focalPoint: "center" },
    },
  },
  stats: [],
  journal: {
    enabled: false,
    eyebrow: "",
    title: "",
    stories: [],
  },
  projects: [],
  visibility: {
    projects: false,
    stats: false,
  },
});

describe("Hero & Opening Experience Separation", () => {
  it("renders the hero immediately when Opening Experience is OFF without waiting", () => {
    const copy = createMockContent({ enabled: true }, false);
    const html = renderToStaticMarkup(<HomepageExperience copy={copy} />);

    expect(html).toContain("Refined Architecture");
    expect(html).toContain("Crafting Spaces");
    expect(html).toContain("https://example.com/desktop-hero.jpg");
  });

  it("does not render the hero section when hero is disabled, regardless of Opening Experience setting", () => {
    const copy = createMockContent({ enabled: false }, true);
    const html = renderToStaticMarkup(<HomepageExperience copy={copy} />);

    expect(html).not.toContain('id="top"');
    expect(html).not.toContain("Refined Architecture");
  });

  it("never leaks or substitutes openingProject image for hero media", () => {
    const copy = createMockContent({
      mediaType: "IMAGE",
      image: "https://example.com/genuine-hero.jpg",
    });
    const media = resolveHeroMedia(copy, false);
    expect(media.imageUrl).toBe("https://example.com/genuine-hero.jpg");
    expect(media.imageUrl).not.toBe("https://example.com/unrelated-opening-image.jpg");
  });
});

describe("Explicit Desktop & Mobile Hero Media Resolution", () => {
  it("resolves desktop IMAGE correctly with focal point and alt", () => {
    const copy = createMockContent({
      mediaType: "IMAGE",
      image: "https://example.com/desktop.jpg",
      focalPoint: "50% 30%",
      alt: "Custom Alt",
    });
    const media = resolveHeroMedia(copy, false);
    expect(media.type).toBe("IMAGE");
    expect(media.imageUrl).toBe("https://example.com/desktop.jpg");
    expect(media.focalPoint).toBe("50% 30%");
    expect(media.alt).toBe("Custom Alt");
  });

  it("resolves desktop VIDEO with videoUrl and poster", () => {
    const copy = createMockContent({
      mediaType: "VIDEO",
      desktopVideo: "https://example.com/hero.mp4",
      poster: "https://example.com/poster.jpg",
    });
    const media = resolveHeroMedia(copy, false);
    expect(media.type).toBe("VIDEO");
    expect(media.videoUrl).toBe("https://example.com/hero.mp4");
    expect(media.posterUrl).toBe("https://example.com/poster.jpg");
  });

  it("inherits desktop configuration on mobile when mobileMediaType is INHERIT", () => {
    const copyVideo = createMockContent({
      mediaType: "VIDEO",
      desktopVideo: "https://example.com/desktop.mp4",
      mobileMediaType: "INHERIT",
    });
    const mediaVideo = resolveHeroMedia(copyVideo, true);
    expect(mediaVideo.type).toBe("VIDEO");
    expect(mediaVideo.videoUrl).toBe("https://example.com/desktop.mp4");

    const copyImage = createMockContent({
      mediaType: "IMAGE",
      image: "https://example.com/desktop.jpg",
      mobileMediaType: "INHERIT",
    });
    const mediaImage = resolveHeroMedia(copyImage, true);
    expect(mediaImage.type).toBe("IMAGE");
    expect(mediaImage.imageUrl).toBe("https://example.com/desktop.jpg");
  });

  it("overrides with mobile IMAGE when mobileMediaType is set to IMAGE", () => {
    const copy = createMockContent({
      mediaType: "VIDEO",
      desktopVideo: "https://example.com/desktop.mp4",
      mobileMediaType: "IMAGE",
      mobileImage: "https://example.com/dedicated-mobile.jpg",
      mobileFocalPoint: "center top",
    });
    const media = resolveHeroMedia(copy, true);
    expect(media.type).toBe("IMAGE");
    expect(media.imageUrl).toBe("https://example.com/dedicated-mobile.jpg");
    expect(media.focalPoint).toBe("center top");
    expect(media.videoUrl).toBeUndefined();
  });

  it("overrides with mobile VIDEO when mobileMediaType is set to VIDEO", () => {
    const copy = createMockContent({
      mediaType: "IMAGE",
      image: "https://example.com/desktop.jpg",
      mobileMediaType: "VIDEO",
      mobileVideo: "https://example.com/dedicated-mobile.mp4",
      mobilePoster: "https://example.com/dedicated-mobile-poster.jpg",
    });
    const media = resolveHeroMedia(copy, true);
    expect(media.type).toBe("VIDEO");
    expect(media.videoUrl).toBe("https://example.com/dedicated-mobile.mp4");
    expect(media.posterUrl).toBe("https://example.com/dedicated-mobile-poster.jpg");
    expect(media.imageUrl).toBeUndefined();
  });

  it("provides backward compatibility for records without explicit mediaType", () => {
    const copyOldVideo = createMockContent({
      mediaType: undefined,
      desktopVideo: "https://example.com/old-video.mp4",
    });
    const mediaOldVideo = resolveHeroMedia(copyOldVideo, false);
    expect(mediaOldVideo.type).toBe("VIDEO");

    const copyOldImage = createMockContent({
      mediaType: undefined,
      desktopVideo: undefined,
      image: "https://example.com/old-image.jpg",
    });
    const mediaOldImage = resolveHeroMedia(copyOldImage, false);
    expect(mediaOldImage.type).toBe("IMAGE");
  });
});

describe("Hero Video Autoplay & Accessible Controls Rendering", () => {
  it("renders HTML5 video with autoPlay, muted, loop, playsInline when configured as VIDEO", () => {
    const copy = createMockContent({
      mediaType: "VIDEO",
      desktopVideo: "https://example.com/hero-bg.mp4",
      poster: "https://example.com/hero-poster.jpg",
    });
    const html = renderToStaticMarkup(<HomepageExperience copy={copy} />);

    expect(html).toContain("<video");
    expect(html).toContain('src="https://example.com/hero-bg.mp4"');
    expect(html.toLowerCase()).toContain("autoplay");
    expect(html.toLowerCase()).toContain("muted");
    expect(html.toLowerCase()).toContain("loop");
    expect(html.toLowerCase()).toContain("playsinline");
    expect(html).toContain('poster="https://example.com/hero-poster.jpg"');
    expect(html).toContain('class="hero-video-toggle"');
    expect(html).toContain('class="round-play"');
  });

  it("does not render video elements or round-play when configured as IMAGE", () => {
    const copy = createMockContent({
      mediaType: "IMAGE",
      image: "https://example.com/hero.jpg",
      desktopVideo: "https://example.com/stale-unused-video.mp4", // Should NOT be rendered
    });
    const html = renderToStaticMarkup(<HomepageExperience copy={copy} />);

    expect(html).not.toContain("<video");
    expect(html).not.toContain("https://example.com/stale-unused-video.mp4");
    expect(html).not.toContain('class="round-play"');
    expect(html).not.toContain('class="hero-video-toggle"');
    expect(html).toContain('src="https://example.com/hero.jpg"');
  });
});

describe("About / Our Story Section 4-Image Card Containment", () => {
  it("renders 4 floating image cards with slot classes living-image-1 through 4", () => {
    const copy = createMockContent();
    const html = renderToStaticMarkup(<HomepageExperience copy={copy} />);

    expect(html).toContain("Beyond the building");
    expect(html).toContain("living-image-1");
    expect(html).toContain("living-image-2");
    expect(html).toContain("living-image-3");
    expect(html).toContain("living-image-4");
    expect(html).toContain("https://example.com/card1.jpg");
    expect(html).toContain("https://example.com/card2.jpg");
    expect(html).toContain("https://example.com/card3.jpg");
    expect(html).toContain("https://example.com/card4.jpg");
  });
});
