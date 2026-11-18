import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const db = new PrismaClient();
const BACKUP_PATH = path.join(process.cwd(), "prisma", "homepage-init-backup.json");

function assetExists(url) {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return true;
  if (trimmed.startsWith("/uploads/")) {
    return existsSync(path.join(process.cwd(), "public", trimmed));
  }
  return true;
}

async function main() {
  const isRollback = process.argv.includes("--rollback");

  if (isRollback) {
    if (!existsSync(BACKUP_PATH)) {
      console.error("No backup file found at", BACKUP_PATH);
      process.exit(1);
    }
    const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf-8"));
    console.log("Rolling back homepage configuration to state from", backup._backupTimestamp);
    delete backup._backupTimestamp;
    await db.homepage.update({
      where: { id: "homepage" },
      data: backup,
    });
    console.log("Rollback completed successfully.");
    return;
  }

  const existing = await db.homepage.findUniqueOrThrow({ where: { id: "homepage" } });

  // 1. Record snapshot of previous visibility and color values
  const backupData = {
    ...existing,
    _backupTimestamp: new Date().toISOString(),
  };
  writeFileSync(BACKUP_PATH, JSON.stringify(backupData, null, 2), "utf-8");
  console.log("Snapshot backed up to:", BACKUP_PATH);

  // 2. Clean up any invalid or non-existent /uploads/qa- paths
  const cleanSlot = (url) => (url && !assetExists(url) ? null : url);

  const cleanedTopLeft = cleanSlot(existing.lifestyleTopLeftImageUrl);
  const cleanedTopRight = cleanSlot(existing.lifestyleTopRightImageUrl);
  const cleanedBottomLeft = cleanSlot(existing.lifestyleBottomLeftImageUrl);
  const cleanedBottomRight = cleanSlot(existing.lifestyleBottomRightImageUrl);

  // 3. Normalized section order: exactly once each
  const canonicalOrder = ["projects", "lifestyle", "stats", "journal", "closing"];

  // 4. Update homepage with all intended sections visible, opening disabled
  const updated = await db.homepage.update({
    where: { id: "homepage" },
    data: {
      // Opening Experience: disabled unless explicitly enabled by editor
      openingEnabled: false,

      // All intended homepage content sections enabled
      heroEnabled: true,
      projectsEnabled: true,
      lifestyleEnabled: true,
      statsEnabled: true,
      journalEnabled: true,
      closingEnabled: true,

      // Section order canonicalized
      sectionOrder: JSON.stringify(canonicalOrder),

      // Media references cleaned of missing assets
      lifestyleTopLeftImageUrl: cleanedTopLeft,
      lifestyleTopRightImageUrl: cleanedTopRight,
      lifestyleBottomLeftImageUrl: cleanedBottomLeft,
      lifestyleBottomRightImageUrl: cleanedBottomRight,

      // Populate genuinely missing required content if absent
      heroEyebrowEn: existing.heroEyebrowEn || "Building a new point of view",
      heroEyebrowAr: existing.heroEyebrowAr || "نبني منظوراً جديداً",
      heroTitleEn: existing.heroTitleEn || "Spaces Crafted For Life",
      heroTitleAr: existing.heroTitleAr || "مساحات صُممت للحياة",
      heroNoteEn: existing.heroNoteEn || "Thoughtful communities for the way Egypt lives next.",
      heroNoteAr: existing.heroNoteAr || "مجتمعات مدروسة لحياة مصر في الغد.",
      heroDiscoverEn: existing.heroDiscoverEn || "Scroll to explore",
      heroDiscoverAr: existing.heroDiscoverAr || "مرر للاستكشاف",

      lifestyleEyebrowEn: existing.lifestyleEyebrowEn || "Beyond the building",
      lifestyleEyebrowAr: existing.lifestyleEyebrowAr || "أبعد من المباني",
      lifestyleTitleEn: existing.lifestyleTitleEn || "The most memorable spaces leave room for life to happen.",
      lifestyleTitleAr: existing.lifestyleTitleAr || "أكثر الأماكن حضوراً هي التي تترك للحياة مساحتها.",

      statsLabelEn: existing.statsLabelEn || "News & Journal",
      statsLabelAr: existing.statsLabelAr || "الأخبار والمقالات",
      statsHeadingEn: existing.statsHeadingEn || "Stories, ideas, and updates.",
      statsHeadingAr: existing.statsHeadingAr || "قصص وأفكار ومستجدات",

      closingEyebrowEn: existing.closingEyebrowEn || "LET'S TALK",
      closingEyebrowAr: existing.closingEyebrowAr || "لنتحدث",
      closingTitleEn: existing.closingTitleEn || "Find your next place.",
      closingTitleAr: existing.closingTitleAr || "اكتشف مكانك القادم",
      closingCtaEn: existing.closingCtaEn || "Call 17087",
      closingCtaAr: existing.closingCtaAr || "اتصل على 17087",
      closingCtaUrl: existing.closingCtaUrl || "tel:17087",
    },
  });

  console.log("Homepage initialization succeeded:");
  console.log("- Sections enabled: hero, projects, lifestyle, stats (News & Journal), journal, closing");
  console.log("- Opening experience disabled: openingEnabled =", updated.openingEnabled);
  console.log("- Section order canonicalized:", canonicalOrder.join(", "));
  console.log("- Invalid media cleaned: topLeft:", cleanedTopLeft, ", bottomLeft:", cleanedBottomLeft);
}

main()
  .catch((err) => {
    console.error("Initialization failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

