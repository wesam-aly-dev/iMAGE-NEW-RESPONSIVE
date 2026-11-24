"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { PageHeroConfig } from "@/content/home";

export interface PageHeroSecondaryCta {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export interface PageHeroQuickBadge {
  label: string;
  value: string;
  href?: string;
}

export interface PageHeroProps {
  locale: "en" | "ar";
  hero?: PageHeroConfig;
  breadcrumbLabel: string;
  breadcrumbHref?: string;
  indexNumber?: string;
  id?: string;
  scrollTargetId?: string;
  secondaryCta?: PageHeroSecondaryCta;
  quickBadges?: PageHeroQuickBadge[];
}

export function PageHero({
  locale,
  hero,
  breadcrumbLabel,
  breadcrumbHref,
  indexNumber = "01",
  id = "top",
  scrollTargetId,
  secondaryCta,
  quickBadges,
}: PageHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const ar = locale === "ar";
  const homeHref = `/${locale}`;

  const [isMobile, setIsMobile] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [failedVideoSource, setFailedVideoSource] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.08]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.25]);

  if (!hero || hero.enabled === false) return null;

  const overlayClass =
    hero.overlay === "subtle"
      ? "page-hero-shade--subtle"
      : hero.overlay === "dark"
      ? "page-hero-shade--dark"
      : "page-hero-shade--medium";

  const alignmentClass =
    hero.alignment === "center" ? "page-hero-align-center" : "page-hero-align-start";

  const heightClass =
    hero.height === "compact"
      ? "page-hero--compact"
      : hero.height === "large"
      ? "page-hero--large"
      : hero.height === "fullscreen"
      ? "page-hero--fullscreen"
      : "page-hero--standard";

  const desktopIsVideo = hero.mediaType === "VIDEO" && Boolean(hero.videoUrl);
  const desktopVideo = hero.videoUrl;
  const desktopImage = hero.image || hero.mobileImage;
  const posterImage = hero.posterUrl || desktopImage;

  const mobileMode =
    hero.mobileMediaType ||
    (hero.mobileVideoUrl
      ? "VIDEO"
      : hero.mobileImage && hero.mobileImage !== hero.image
      ? "IMAGE"
      : "INHERIT");
  const mobileIsVideo =
    (mobileMode === "VIDEO" && Boolean(hero.mobileVideoUrl)) ||
    Boolean(!desktopIsVideo && hero.mobileVideoUrl);
  const mobileIsImage =
    (mobileMode === "IMAGE" && Boolean(hero.mobileImage)) ||
    (desktopIsVideo && Boolean(hero.mobileImage)) ||
    Boolean(hero.mobileImage && hero.mobileImage !== hero.image);
  const hasMobileOverride = Boolean(mobileIsVideo || mobileIsImage);

  const mobileVideo = hero.mobileVideoUrl || desktopVideo;
  const mobileImage = hero.mobileImage;

  // Determine active media for current viewport to prevent dual video playback
  const activeIsVideo = isMobile
    ? mobileIsVideo && Boolean(mobileVideo)
    : desktopIsVideo && Boolean(desktopVideo);

  const activeVideoUrl = isMobile ? mobileVideo : desktopVideo;
  const activeImageUrl = isMobile && mobileIsImage ? mobileImage : desktopImage;
  const activeFocalPoint =
    (isMobile ? hero.mobileFocalPoint || hero.focalPoint : hero.focalPoint) || "center";

  const hasMedia = Boolean(desktopImage || desktopVideo || mobileImage || mobileVideo);

  // Background Autoplay execution with promise error catch
  useEffect(() => {
    if (!activeIsVideo || !activeVideoUrl || failedVideoSource === activeVideoUrl) return;
    const video = videoRef.current;
    if (!video || reduce) return;

    video.defaultMuted = true;
    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setVideoPlaying(true))
        .catch(() => {
          // Autoplay policy or low-power mode blocked playback
          setVideoPlaying(false);
        });
    }
  }, [activeIsVideo, activeVideoUrl, reduce, failedVideoSource]);

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setVideoPlaying(true))
          .catch(() => setVideoPlaying(false));
      }
    } else {
      video.pause();
      setVideoPlaying(false);
    }
  };

  const isDuplicateEyebrow = Boolean(
    hero.eyebrow &&
      breadcrumbLabel &&
      (hero.eyebrow.trim().toLowerCase() === breadcrumbLabel.trim().toLowerCase() ||
        hero.eyebrow.trim().toLowerCase().replace(/\s+/g, "") ===
          breadcrumbLabel.trim().toLowerCase().replace(/\s+/g, ""))
  );

  const handleCtaClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const target = hero.ctaUrl || scrollTargetId;
    if (target && target.startsWith("#")) {
      e.preventDefault();
      const el = document.querySelector(target);
      if (el) {
        const lenis = (
          window as unknown as {
            lenis?: {
              scrollTo: (target: string | HTMLElement, opts?: { offset?: number; duration?: number }) => void;
            };
          }
        ).lenis;
        if (lenis) {
          lenis.scrollTo(target, { duration: 1.2 });
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }
  };

  const handleScrollDown = () => {
    const target = scrollTargetId || hero.ctaUrl || (id === "top" ? "#content" : undefined);
    if (target && target.startsWith("#")) {
      const el = document.querySelector(target);
      if (el) {
        const lenis = (
          window as unknown as {
            lenis?: {
              scrollTo: (target: string | HTMLElement, opts?: { offset?: number; duration?: number }) => void;
            };
          }
        ).lenis;
        if (lenis) {
          lenis.scrollTo(target, { duration: 1.2 });
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } else if (target) {
      window.location.href = target;
    }
  };

  const isVideoRenderable =
    activeIsVideo && Boolean(activeVideoUrl) && failedVideoSource !== activeVideoUrl;

  return (
    <header
      id={id}
      ref={ref}
      className={`page-hero ${heightClass} ${alignmentClass} ${hasMedia ? "has-media" : "has-brand-bg"}`}
      role="banner"
      aria-label={hero.title}
    >
      {/* Background Layer: Imagery or Branded Architectural Backdrop */}
      {hasMedia ? (
        <motion.div className="page-hero-media" style={{ scale }}>
          <div className="page-hero-bg-motion">
            {/* Desktop Media: Video or Image */}
            {isVideoRenderable ? (
              <div
                className={`page-hero-video-active page-hero-video-desktop ${!hasMobileOverride ? "is-universal" : ""}`}
                aria-hidden={hasMobileOverride ? undefined : "false"}
              >
                <video
                  ref={videoRef}
                  key={activeVideoUrl}
                  src={activeVideoUrl}
                  poster={posterImage || undefined}
                  autoPlay={!reduce}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  onError={() => {
                    setFailedVideoSource(activeVideoUrl || null);
                    setVideoPlaying(false);
                  }}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: activeFocalPoint,
                  }}
                />

                {/* Poster fallback overlay when video is paused or buffering */}
                {!videoPlaying && posterImage && (
                  <div
                    className="page-hero-video-poster"
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                    }}
                  >
                    <Image
                      src={posterImage}
                      alt={hero.alt || hero.title}
                      fill
                      priority
                      sizes="100vw"
                      quality={90}
                      style={{
                        objectFit: "cover",
                        objectPosition: activeFocalPoint,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : desktopImage ? (
              <div
                className={`page-hero-img-active page-hero-img-desktop ${!hasMobileOverride ? "is-universal" : ""}`}
                aria-hidden={hasMobileOverride ? undefined : "false"}
              >
                <Image
                  src={desktopImage}
                  alt={hero.alt || hero.title}
                  fill
                  priority
                  sizes="100vw"
                  quality={90}
                  style={{
                    objectFit: "cover",
                    objectPosition: hero.focalPoint || "center",
                  }}
                />
              </div>
            ) : null}

            {/* Mobile Media Override (only when explicitly provided) */}
            {hasMobileOverride && (
              mobileIsVideo && mobileVideo ? (
                <div className="page-hero-video-mobile" aria-hidden="false">
                  <video
                    src={mobileVideo}
                    poster={posterImage || undefined}
                    autoPlay={!reduce}
                    muted
                    loop
                    playsInline
                    preload="auto"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: hero.mobileFocalPoint || hero.focalPoint || "center",
                    }}
                  />
                </div>
              ) : mobileImage ? (
                <div className="page-hero-img-mobile" aria-hidden="false">
                  <Image
                    src={mobileImage}
                    alt={hero.alt || hero.title}
                    fill
                    priority
                    sizes="100vw"
                    quality={90}
                    style={{
                      objectFit: "cover",
                      objectPosition: hero.mobileFocalPoint || hero.focalPoint || "center",
                    }}
                  />
                </div>
              ) : null
            )}
          </div>
        </motion.div>
      ) : (
        /* Intentional luxury branded architectural backdrop when no image is uploaded */
        <div className="page-hero-brand-bg" aria-hidden="true">
          <div className="page-hero-brand-pattern" />
          <div className="page-hero-brand-glow" />
        </div>
      )}

      {/* Directional Architectural Darkening Shade */}
      <div className={`page-hero-shade ${overlayClass}`} aria-hidden="true" />

      {/* Hero Content Container */}
      <motion.div
        className="page-hero-copy stage-pad"
        style={{ y: copyY, opacity: copyOpacity }}
      >
        <div className="page-hero-inner">
          {/* Breadcrumbs & Folio */}
          <div className="page-hero-pretitle">
            <nav className="page-hero-breadcrumb" aria-label={ar ? "مسار التنقل" : "Breadcrumb"}>
              <Link href={homeHref}>{ar ? "الرئيسية" : "Home"}</Link>
              <span aria-hidden="true" className="breadcrumb-sep">/</span>
              {breadcrumbHref ? (
                <Link href={breadcrumbHref}>{breadcrumbLabel}</Link>
              ) : (
                <span aria-current="page">{breadcrumbLabel}</span>
              )}
            </nav>
            {hero.eyebrow && !isDuplicateEyebrow && (
              <>
                <span className="pretitle-sep" aria-hidden="true">•</span>
                <span className="page-hero-brand-label">{hero.eyebrow}</span>
              </>
            )}
          </div>

          {/* Main Architectural Heading */}
          <h1 className="page-hero-h1">{hero.title}</h1>

          {/* Supporting Narrative / Intro */}
          {(hero.body || hero.intro) && (
            <div className="page-hero-narrative">
              <span className="page-hero-index" aria-hidden="true">{indexNumber}</span>
              <p className="page-hero-body">{hero.body || hero.intro}</p>
            </div>
          )}

          {/* Action CTAs */}
          {(hero.ctaLabel || secondaryCta) && (
            <div className="page-hero-actions">
              {hero.ctaLabel && (
                <a
                  href={hero.ctaUrl || scrollTargetId || "#content"}
                  onClick={handleCtaClick}
                  className="btn-page-hero-cta"
                  aria-label={hero.ctaLabel}
                >
                  <span>{hero.ctaLabel}</span>
                  <span aria-hidden="true" className="hero-cta-arrow">
                    {hero.ctaUrl?.startsWith("#") ? "↓" : ar ? "←" : "→"}
                  </span>
                </a>
              )}
              {secondaryCta && (
                <a
                  href={secondaryCta.href}
                  className="btn-page-hero-secondary"
                  aria-label={secondaryCta.label}
                >
                  {secondaryCta.icon && (
                    <span aria-hidden="true" className="secondary-cta-icon">{secondaryCta.icon}</span>
                  )}
                  <span>{secondaryCta.label}</span>
                </a>
              )}
            </div>
          )}

          {/* Architectural Luxury Quick Info Badges */}
          {quickBadges && quickBadges.length > 0 && (
            <div className="page-hero-meta-strip" aria-label={ar ? "معلومات التواصل المباشرة" : "Direct Advisory Channels"}>
              {quickBadges.map((badge, idx) => {
                const content = (
                  <>
                    <span className="meta-dot" aria-hidden="true" />
                    <span className="meta-label">{badge.label}</span>
                    <strong className="meta-val" dir="ltr">{badge.value}</strong>
                  </>
                );
                return badge.href ? (
                  <a key={idx} href={badge.href} className="page-hero-meta-item">
                    {content}
                  </a>
                ) : (
                  <div key={idx} className="page-hero-meta-item">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* WCAG 2.2.2 Pause/Play Background Video Toggle Button */}
      {isVideoRenderable && (
        <button
          type="button"
          className="hero-video-toggle"
          onClick={toggleVideo}
          aria-label={
            videoPlaying
              ? (ar ? "إيقاف مؤقت لخلفية الفيديو" : "Pause background video")
              : (ar ? "تشغيل خلفية الفيديو" : "Play background video")
          }
          title={videoPlaying ? (ar ? "إيقاف مؤقت" : "Pause") : (ar ? "تشغيل" : "Play")}
        >
          <span aria-hidden="true">{videoPlaying ? "❚❚" : "▶"}</span>
        </button>
      )}

      {/* Signature Double Chevron Scroll Cue */}
      <button
        type="button"
        onClick={handleScrollDown}
        className="double-chevron page-hero-scroll-link"
        aria-label={ar ? "انتقل إلى أسفل الصفحة" : "Scroll to content"}
      >
        <i aria-hidden="true" />
        <i aria-hidden="true" />
      </button>
    </header>
  );
}
