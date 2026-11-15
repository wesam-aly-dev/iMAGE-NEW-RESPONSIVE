import { ActionForm } from "@/components/admin/action-form";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { prisma } from "@/lib/prisma";
import { saveNavigation } from "../../actions";

export default async function Navigation() {
  const [items, globalSettings, assets, publishedProjects] = await Promise.all([
    prisma.navigationItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.globalSettings.findUnique({ where: { id: "global" } }),
    prisma.mediaAsset.findMany({
      where: { kind: "IMAGE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, slug: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <p>Global content</p>
          <h1>Navigation & Menu Configuration</h1>
          <span>
            Manage primary links, secondary expandable destinations, photographs, and labels for the website menu.
          </span>
        </div>
      </header>

      <ActionForm action={saveNavigation} className="admin-form" submitLabel="Save Navigation">
        <NavigationEditor
          initialItems={items.map((it) => ({
            id: it.id,
            labelEn: it.labelEn,
            labelAr: it.labelAr,
            url: it.url,
            visible: it.visible,
            mobileVisible: (it as any).mobileVisible !== false,
            external: it.external,
            group: it.group || "primary",
            previewImageUrl: it.previewImageUrl || "",
            previewImageUrlAr: it.previewImageUrlAr || "",
            previewImageAltEn: (it as any).previewImageAltEn || "",
            previewImageAltAr: (it as any).previewImageAltAr || "",
            focalPoint: it.focalPoint || "center",
            sortOrder: it.sortOrder,
          }))}
          globalSettings={
            globalSettings
              ? {
                  menuMediaUrl: globalSettings.menuMediaUrl || "/images/menu.jpg",
                  menuMediaAltEn: globalSettings.menuMediaAltEn || "",
                  menuMediaAltAr: globalSettings.menuMediaAltAr || "",
                  menuMediaFocalPoint: globalSettings.menuMediaFocalPoint || "center",
                  morePagesLabelEn: (globalSettings as any).morePagesLabelEn || "More Pages",
                  morePagesLabelAr: (globalSettings as any).morePagesLabelAr || "المزيد من الصفحات",
                  menuFontSizeDesktop: (globalSettings as any).menuFontSizeDesktop || "1.125rem",
                  menuFontSizeMobile: (globalSettings as any).menuFontSizeMobile || "1rem",
                }
              : undefined
          }
          publishedProjects={publishedProjects}
          assets={assets.map((a) => ({
            id: a.id,
            url: a.url,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
            kind: a.kind,
            createdAt: a.createdAt,
            altEn: a.altEn,
            altAr: a.altAr,
          }))}
        />
      </ActionForm>
    </>
  );
}
