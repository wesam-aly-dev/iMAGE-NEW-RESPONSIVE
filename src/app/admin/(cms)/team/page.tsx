import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/admin/action-form";
import { TeamMembersEditor } from "@/components/admin/team-members-editor";
import { PageHeroEditor } from "@/components/admin/page-hero-editor";
import { saveTeam } from "../../actions";

export default async function TeamAdmin() {
  const [home, members, images] = await Promise.all([
    prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } }),
    prisma.teamMember.findMany({
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
          <h1>Team page</h1>
          <span>Manage the architectural hero, page introduction, and team member profiles.</span>
        </div>
      </header>
      <ActionForm action={saveTeam} className="admin-form" submitLabel="Save Team Page">
        <PageHeroEditor
          prefix="teamHero"
          sectionTitle="1. Team Page Hero"
          eyebrowBase="teamEyebrow"
          titleBase="teamTitle"
          bodyBase="teamIntro"
          defaultCtaUrl="#team-roster"
          defaultCtaLabelEn="Meet the Team"
          defaultCtaLabelAr="تعرف على الفريق"
          values={{
            enabled: home.teamHeroEnabled ?? true,
            eyebrowEn: home.teamEyebrowEn,
            eyebrowAr: home.teamEyebrowAr,
            titleEn: home.teamTitleEn,
            titleAr: home.teamTitleAr,
            bodyEn: home.teamIntroEn,
            bodyAr: home.teamIntroAr,
            ctaLabelEn: home.teamHeroCtaLabelEn ?? "Meet the Team",
            ctaLabelAr: home.teamHeroCtaLabelAr ?? "تعرف على الفريق",
            ctaUrl: home.teamHeroCtaUrl ?? "#team-roster",
            imageUrl: home.teamHeroImageUrl,
            mobileImageUrl: home.teamHeroMobileImageUrl,
            mediaType: home.teamHeroMediaType,
            videoUrl: home.teamHeroVideoUrl,
            mobileMediaType: home.teamHeroMobileMediaType,
            mobileVideoUrl: home.teamHeroMobileVideoUrl,
            posterUrl: home.teamHeroPosterUrl,
            focalPoint: home.teamHeroFocalPoint ?? "center",
            mobileFocalPoint: home.teamHeroMobileFocalPoint ?? "center",
            imageAltEn: home.teamHeroImageAltEn,
            imageAltAr: home.teamHeroImageAltAr,
            overlay: home.teamHeroOverlay ?? "medium",
            alignment: home.teamHeroAlignment ?? "start",
            height: home.teamHeroHeight ?? "standard",
          }}
          assets={images}
        />
        <TeamMembersEditor initialMembers={members} assets={images} />
      </ActionForm>
    </>
  );
}
