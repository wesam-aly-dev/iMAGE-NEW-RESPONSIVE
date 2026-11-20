import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/action-form";
import { PartnersEditor } from "@/components/admin/partners-editor";
import { PageHeroEditor } from "@/components/admin/page-hero-editor";
import { savePartners } from "../../actions";

export default async function PartnersAdmin() {
  const [home, partners, images] = await Promise.all([
    prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } }),
    prisma.partner.findMany({
      where: { homepageId: "homepage" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.mediaAsset.findMany({
      where: { OR: [{ kind: "IMAGE" }, { kind: "VIDEO" }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        filename: true,
        mimeType: true,
        size: true,
        kind: true,
      },
    }),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <p>Standalone page</p>
          <h1>Partners page</h1>
          <span>Manage the architectural hero, page introduction, partner logos, and links.</span>
        </div>
      </header>
      <ActionForm action={savePartners} className="admin-form" submitLabel="Save Partners Page">
        <PageHeroEditor
          prefix="partnersHero"
          sectionTitle="1. Partners Page Hero"
          eyebrowBase="partnersEyebrow"
          titleBase="partnersTitle"
          bodyBase="partnersIntro"
          defaultCtaUrl="#partners-directory"
          defaultCtaLabelEn="Explore Partners"
          defaultCtaLabelAr="استكشف الشركاء"
          values={{
            enabled: home.partnersHeroEnabled ?? true,
            eyebrowEn: home.partnersEyebrowEn,
            eyebrowAr: home.partnersEyebrowAr,
            titleEn: home.partnersTitleEn,
            titleAr: home.partnersTitleAr,
            bodyEn: home.partnersIntroEn,
            bodyAr: home.partnersIntroAr,
            ctaLabelEn: home.partnersHeroCtaLabelEn ?? "Explore Partners",
            ctaLabelAr: home.partnersHeroCtaLabelAr ?? "استكشف الشركاء",
            ctaUrl: home.partnersHeroCtaUrl ?? "#partners-directory",
            imageUrl: home.partnersHeroImageUrl,
            mobileImageUrl: home.partnersHeroMobileImageUrl,
            mediaType: home.partnersHeroMediaType,
            videoUrl: home.partnersHeroVideoUrl,
            mobileMediaType: home.partnersHeroMobileMediaType,
            mobileVideoUrl: home.partnersHeroMobileVideoUrl,
            posterUrl: home.partnersHeroPosterUrl,
            focalPoint: home.partnersHeroFocalPoint ?? "center",
            mobileFocalPoint: home.partnersHeroMobileFocalPoint ?? "center",
            imageAltEn: home.partnersHeroImageAltEn,
            imageAltAr: home.partnersHeroImageAltAr,
            overlay: home.partnersHeroOverlay ?? "medium",
            alignment: home.partnersHeroAlignment ?? "start",
            height: home.partnersHeroHeight ?? "standard",
          }}
          assets={images}
        />
        <PartnersEditor
          key={partners.map((p) => p.id).join(",")}
          initialPartners={partners}
          assets={images}
        />
      </ActionForm>
    </>
  );
}
