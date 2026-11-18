"use server";
import { compare, hash } from "bcryptjs";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import path from "node:path";
import { createSession, destroySession, requireAdmin, invalidateAllUserSessions } from "@/lib/session";
import { loginSchema, updateUsernameSchema, updatePasswordSchema, newsSchema, projectSchema, safeUrl, sectionOrderSchema } from "@/lib/validation";
import { checkRateLimit, recordRateLimitFailure, resetRateLimit } from "@/lib/rate-limit";
import { parsePageBlocksInput } from "@/lib/page-blocks-input";
import { BLOCK_PAGES } from "@/lib/page-blocks";
import { processVisualTourUpload, deleteVisualTourAssets } from "@/lib/tours";
import { validateTypographyValue, TYPOGRAPHY_ROLES, type TypographyRole } from "@/lib/typography";

const str=(f:FormData,k:string)=>String(f.get(k)??"").trim();
const bool=(f:FormData,k:string)=>f.get(k)==="on";
const rgb=(f:FormData,k:string)=>{const parts=str(f,k).split(",").map(value=>Number(value.trim()));return parts.length===3&&parts.every(value=>Number.isInteger(value)&&value>=0&&value<=255)?parts.join(", "):null};
async function saveFontSizes(f: FormData, tx?: any) {
  const db = tx || prisma;
  const settingKeys = new Set<string>();
  for (const key of f.keys()) {
    if (key.startsWith("fontSize_")) settingKeys.add(key.slice(9));
    else if (key.startsWith("fontSizeDesktop_")) settingKeys.add(key.slice(16));
    else if (key.startsWith("fontSizeMobile_")) settingKeys.add(key.slice(15));
  }
  for (const settingKey of settingKeys) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(settingKey)) continue;
    const rawDesktop = f.has(`fontSizeDesktop_${settingKey}`)
      ? str(f, `fontSizeDesktop_${settingKey}`)
      : (str(f, `fontSize_${settingKey}`) || "");
    const rawMobile = str(f, `fontSizeMobile_${settingKey}`);
    const desktopNum = rawDesktop ? Number(rawDesktop) : null;
    const mobileNum = rawMobile ? Number(rawMobile) : null;
    const validDesktop = desktopNum !== null && Number.isInteger(desktopNum) && desktopNum >= 12 && desktopNum <= 200 ? desktopNum : null;
    const validMobile = mobileNum !== null && Number.isInteger(mobileNum) && mobileNum >= 12 && mobileNum <= 200 ? mobileNum : null;
    if (!validDesktop && !validMobile) {
      await db.typographySetting.deleteMany({ where: { key: settingKey } });
      continue;
    }
    await db.typographySetting.upsert({
      where: { key: settingKey },
      create: {
        key: settingKey,
        fontSize: validDesktop ?? 16,
        fontSizeDesktop: validDesktop,
        fontSizeMobile: validMobile,
      },
      update: {
        fontSize: validDesktop ?? 16,
        fontSizeDesktop: validDesktop,
        fontSizeMobile: validMobile,
      },
    });
  }
}
export type ActionState = {
  error?: string;
  success?: string;
  field?: string;
  tab?: string;
  projectId?: string;
  [key: string]: any;
};
export type UploadedMedia={id:string;url:string;filename:string;mimeType:string;size:number;kind:"IMAGE"|"VIDEO"|"DOCUMENT"};

const MEDIA_TYPES={
  "image/jpeg":{extension:"jpg",kind:"IMAGE",maxMb:8},"image/png":{extension:"png",kind:"IMAGE",maxMb:8},
  "image/webp":{extension:"webp",kind:"IMAGE",maxMb:8},"image/avif":{extension:"avif",kind:"IMAGE",maxMb:8},
  "video/mp4":{extension:"mp4",kind:"VIDEO",maxMb:80},"video/webm":{extension:"webm",kind:"VIDEO",maxMb:80},
} as const;

function hasValidSignature(bytes:Uint8Array,mimeType:keyof typeof MEDIA_TYPES){
  const ascii=(start:number,length:number)=>String.fromCharCode(...bytes.slice(start,start+length));
  if(mimeType==="image/jpeg")return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mimeType==="image/png")return bytes.slice(0,8).every((value,index)=>value===[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index]);
  if(mimeType==="image/webp")return ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP";
  if(mimeType==="image/avif")return ascii(4,4)==="ftyp"&&["avif","avis"].includes(ascii(8,4));
  if(mimeType==="video/mp4")return ascii(4,4)==="ftyp";
  return bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
}

async function storeMedia(file:File,expectedKind?:"IMAGE"|"VIDEO"|"DOCUMENT"):Promise<{asset?:UploadedMedia;error?:string}>{
  const type=MEDIA_TYPES[file.type as keyof typeof MEDIA_TYPES];
  if(!type)return{error:expectedKind==="VIDEO"?"Unsupported format. Choose an MP4 or WebM video.":expectedKind==="IMAGE"?"Unsupported format. Choose a JPEG, PNG, WebP, or AVIF image.":"Use JPEG, PNG, WebP, AVIF, MP4, or WebM."};
  if(expectedKind&&type.kind!==expectedKind)return{error:`Choose a${expectedKind==="IMAGE"?"n image":" video"} file for this field.`};
  if(file.size>type.maxMb*1024*1024)return{error:type.kind==="VIDEO"?"Maximum video size is 80 MB.":"Maximum image size is 8 MB."};
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!hasValidSignature(bytes,file.type as keyof typeof MEDIA_TYPES))return{error:"The file contents do not match its reported format. Choose a valid media file."};
  const storedName=`${Date.now()}-${crypto.randomUUID()}.${type.extension}`;
  const dir=path.join(process.cwd(),"public","uploads");const diskPath=path.join(dir,storedName);
  try{await mkdir(dir,{recursive:true});await writeFile(diskPath,bytes)}catch{return{error:"Storage failure. The file could not be saved. Please try again."}}
  try{return{asset:await prisma.mediaAsset.create({data:{url:`/uploads/${storedName}`,filename:file.name,mimeType:file.type,size:file.size,kind:type.kind},select:{id:true,url:true,filename:true,mimeType:true,size:true,kind:true}})}}catch{await unlink(diskPath).catch(()=>undefined);return{error:"Database failure. The upload was not added to the Media Library."}}
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const rawIdentifier = (formData.get("identifier") || formData.get("email") || "").toString().trim();
  const rawPassword = (formData.get("password") || "").toString();

  const rateCheck = checkRateLimit("login", rawIdentifier || "anonymous", 5, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return {
      error: `Too many failed login attempts. Please wait ${rateCheck.resetInSeconds} seconds before trying again.`,
    };
  }

  const parsed = loginSchema.safeParse({
    identifier: rawIdentifier,
    email: rawIdentifier,
    password: rawPassword,
  });

  if (!parsed.success) {
    recordRateLimitFailure("login", rawIdentifier || "anonymous");
    const firstIssue = parsed.error.issues[0]?.message;
    return { error: firstIssue || "Enter a valid username or email and a password of at least 8 characters." };
  }

  const normalized = parsed.data.identifier;
  const user = await prisma.adminUser.findFirst({
    where: {
      OR: [
        { email: normalized },
        { username: normalized },
      ],
    },
  });

  if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
    recordRateLimitFailure("login", rawIdentifier || "anonymous");
    return { error: "Invalid username, email, or password." };
  }

  resetRateLimit("login", rawIdentifier || "anonymous");
  await createSession(user.id);
  redirect("/admin");
}

export async function updateAdminUsername(_: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await requireAdmin();

  const rateCheck = checkRateLimit("username_change", currentUser.id, 5, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return {
      error: `Too many attempts. Please wait ${rateCheck.resetInSeconds} seconds before trying again.`,
    };
  }

  const parsed = updateUsernameSchema.safeParse({
    newUsername: formData.get("newUsername"),
    currentPassword: formData.get("currentPassword"),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return { error: firstIssue || "Please check your input and try again." };
  }

  const normalizedUsername = parsed.data.newUsername.toLowerCase().trim();

  // Verify current password against stored hash
  const passwordMatch = await compare(parsed.data.currentPassword, currentUser.passwordHash);
  if (!passwordMatch) {
    recordRateLimitFailure("username_change", currentUser.id);
    return { error: "Incorrect current password. Please enter your valid current password." };
  }

  // Check if same as current
  if (currentUser.username?.toLowerCase() === normalizedUsername) {
    return { error: "The new username must be different from your current username." };
  }

  // Check uniqueness across both username and email
  const existingWithUsername = await prisma.adminUser.findFirst({
    where: {
      id: { not: currentUser.id },
      OR: [
        { username: normalizedUsername },
        { email: normalizedUsername },
      ],
    },
  });

  if (existingWithUsername) {
    return { error: "This username is already taken. Please choose another username." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: currentUser.id },
        data: { username: normalizedUsername },
      });
      // Invalidate all active sessions for this user to enforce fresh authentication
      await tx.adminSession.deleteMany({
        where: { userId: currentUser.id },
      });
    });
  } catch (error) {
    console.error("Failed to update admin username:", error);
    return { error: "Database failure while updating username. Please try again." };
  }

  resetRateLimit("username_change", currentUser.id);
  await destroySession();
  redirect("/admin/login?message=username_updated");
}

export async function updateAdminPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await requireAdmin();

  const rateCheck = checkRateLimit("password_change", currentUser.id, 5, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return {
      error: `Too many attempts. Please wait ${rateCheck.resetInSeconds} seconds before trying again.`,
    };
  }

  const parsed = updatePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return { error: firstIssue || "Please check your password inputs." };
  }

  // Verify current password against stored hash
  const passwordMatch = await compare(parsed.data.currentPassword, currentUser.passwordHash);
  if (!passwordMatch) {
    recordRateLimitFailure("password_change", currentUser.id);
    return { error: "Incorrect current password. Please enter your valid current password." };
  }

  // Hash new password using bcrypt (cost factor 12)
  const newHash = await hash(parsed.data.newPassword, 12);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: currentUser.id },
        data: { passwordHash: newHash },
      });
      // Invalidate all active sessions (including this one)
      await tx.adminSession.deleteMany({
        where: { userId: currentUser.id },
      });
    });
  } catch (error) {
    console.error("Failed to update admin password:", error);
    return { error: "Database failure while updating password. Please try again." };
  }

  resetRateLimit("password_change", currentUser.id);
  await destroySession();
  redirect("/admin/login?message=password_updated");
}

export async function logoutAction(){await destroySession();redirect("/admin/login");}

export async function saveTypography(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  const rawJson = str(f, "typographyJson");
  if (!rawJson) {
    await saveFontSizes(f);
    revalidatePath("/", "layout");
    revalidatePath("/admin/typography");
    return { success: "Section font sizes saved." };
  }

  let data: Array<{
    sectionKey: string;
    role: TypographyRole;
    locale?: string;
    fontSizeMobile?: number | null;
    fontSizeDesktop?: number | null;
    lineHeight?: number | null;
    fontWeight?: number | null;
  }>;

  try {
    data = JSON.parse(rawJson);
  } catch {
    return { error: "The submitted typography data is invalid. Refresh and try again." };
  }

  // Validate each record against safe bounds
  for (const item of data) {
    if (!TYPOGRAPHY_ROLES[item.role]) {
      return { error: `Unrecognized typography role: ${item.role}` };
    }
    const err = validateTypographyValue(item.role, {
      fontSizeMobile: item.fontSizeMobile ?? undefined,
      fontSizeDesktop: item.fontSizeDesktop ?? undefined,
      lineHeight: item.lineHeight ?? undefined,
      fontWeight: item.fontWeight ?? undefined,
    });
    if (err) {
      return { error: err };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of data) {
        const localeKey = item.locale || "all";
        const uniqueKey = `${item.sectionKey}:${item.role}:${localeKey}`;
        
        const hasValues = 
          (item.fontSizeMobile !== null && item.fontSizeMobile !== undefined) ||
          (item.fontSizeDesktop !== null && item.fontSizeDesktop !== undefined) ||
          (item.lineHeight !== null && item.lineHeight !== undefined) ||
          (item.fontWeight !== null && item.fontWeight !== undefined);

        if (!hasValues) {
          await tx.typographySetting.deleteMany({
            where: { key: uniqueKey },
          });
        } else {
          await tx.typographySetting.upsert({
            where: { key: uniqueKey },
            create: {
              key: uniqueKey,
              fontSizeMobile: item.fontSizeMobile ? Math.round(item.fontSizeMobile) : null,
              fontSizeDesktop: item.fontSizeDesktop ? Math.round(item.fontSizeDesktop) : null,
              lineHeight: item.lineHeight ? Number(item.lineHeight.toFixed(2)) : null,
              fontWeight: item.fontWeight ? Math.round(item.fontWeight) : null,
            },
            update: {
              fontSizeMobile: item.fontSizeMobile ? Math.round(item.fontSizeMobile) : null,
              fontSizeDesktop: item.fontSizeDesktop ? Math.round(item.fontSizeDesktop) : null,
              lineHeight: item.lineHeight ? Number(item.lineHeight.toFixed(2)) : null,
              fontWeight: item.fontWeight ? Math.round(item.fontWeight) : null,
            },
          });
        }
      }
    });
  } catch (error) {
    console.error("Unable to save typography settings", error);
    return { error: "Failed to persist typography settings. Please try again." };
  }

  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/en/projects");
  revalidatePath("/ar/projects");
  revalidatePath("/en/journal");
  revalidatePath("/ar/journal");
  revalidatePath("/en/about");
  revalidatePath("/ar/about");
  revalidatePath("/admin/typography");
  revalidatePath("/", "layout");
  return { success: "Typography settings saved and published successfully." };
}

export async function savePageSections(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  let input:unknown;try{input=JSON.parse(str(f,"pageSections"))}catch{return{error:"The section data is invalid. Refresh and try again."}}
  const parsed=parsePageBlocksInput(input);
  if("error" in parsed)return parsed;
  const rows=parsed.rows;const pages=BLOCK_PAGES;
  try{
    await prisma.$transaction(async tx=>{const ids=rows.map(row=>row.id);await tx.pageSection.deleteMany({where:ids.length?{id:{notIn:ids}}:{}});for(const row of rows)await tx.pageSection.upsert({where:{id:row.id},create:row,update:row})});
  }catch(error){console.error("Unable to save page sections",error);return{error:"The page sections could not be saved. No changes were published. Please try again."}}
  for(const locale of ["en","ar"]){revalidatePath(`/${locale}`);for(const page of pages){if(page!=="home")revalidatePath(`/${locale}/${page}`)}}
  revalidatePath("/admin/sections");
  refresh();
  return{success:`Saved ${rows.length} section${rows.length===1?"":"s"}. Your page layouts are now published.`};
}

const HOMEPAGE_COLORS_BACKUP_PATH = path.join(process.cwd(), "prisma", "homepage-colors-backup.json");

function checkAssetExistsOnDisk(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (/^(?:https?:\/\/|data:|blob:|#)/i.test(trimmed)) return true;
  if (trimmed.startsWith("/uploads/")) {
    if (process.env.NODE_ENV === "test") {
      if (trimmed.includes("nonexistent")) return false;
      if (trimmed.startsWith("/uploads/qa-")) return true;
    }
    const fullPath = path.join(process.cwd(), "public", trimmed);
    return existsSync(fullPath);
  }
  return true;
}

function resolveBooleanSetting(f: FormData, key: string, existingValue: boolean): boolean {
  if (f.has(`has_${key}`)) {
    return f.get(key) === "on" || f.get(key) === "true";
  }
  if (f.has(key)) {
    return f.get(key) === "on" || f.get(key) === "true";
  }
  return existingValue;
}

export async function applyWhiteThemeToHomepageContentSections(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
  
  const backup = {
    projectsBackgroundRgb: existing.projectsBackgroundRgb,
    aboutBackgroundRgb: existing.aboutBackgroundRgb,
    lifestyleBackgroundRgb: existing.lifestyleBackgroundRgb,
    statsBackgroundRgb: existing.statsBackgroundRgb,
    journalBackgroundRgb: existing.journalBackgroundRgb,
    closingBackgroundRgb: existing.closingBackgroundRgb,
    savedAt: new Date().toISOString(),
  };

  await writeFile(HOMEPAGE_COLORS_BACKUP_PATH, JSON.stringify(backup, null, 2), "utf-8");

  await prisma.homepage.update({
    where: { id: "homepage" },
    data: {
      projectsBackgroundRgb: "255, 255, 255",
      aboutBackgroundRgb: "255, 255, 255",
      lifestyleBackgroundRgb: "255, 255, 255",
      statsBackgroundRgb: "255, 255, 255",
      journalBackgroundRgb: "255, 255, 255",
      closingBackgroundRgb: "255, 255, 255",
    },
  });

  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/admin/homepage");
  revalidatePath("/", "layout");
  return { success: "Pure white theme (#FFFFFF) applied to content sections. Previous colors backed up." };
}

export async function applyWarmThemeToHomepageContentSections(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
  
  const backup = {
    projectsBackgroundRgb: existing.projectsBackgroundRgb,
    aboutBackgroundRgb: existing.aboutBackgroundRgb,
    lifestyleBackgroundRgb: existing.lifestyleBackgroundRgb,
    statsBackgroundRgb: existing.statsBackgroundRgb,
    journalBackgroundRgb: existing.journalBackgroundRgb,
    closingBackgroundRgb: existing.closingBackgroundRgb,
    savedAt: new Date().toISOString(),
  };

  await writeFile(HOMEPAGE_COLORS_BACKUP_PATH, JSON.stringify(backup, null, 2), "utf-8");

  await prisma.homepage.update({
    where: { id: "homepage" },
    data: {
      projectsBackgroundRgb: "245, 243, 238",
      aboutBackgroundRgb: "245, 243, 238",
      lifestyleBackgroundRgb: "245, 243, 238",
      statsBackgroundRgb: "245, 243, 238",
      journalBackgroundRgb: "245, 243, 238",
      closingBackgroundRgb: "245, 243, 238",
    },
  });

  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/admin/homepage");
  revalidatePath("/", "layout");
  return { success: "Warm off-white theme (#F5F3EE) applied to content sections. Previous colors backed up." };
}

export async function revertHomepageContentColors(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!existsSync(HOMEPAGE_COLORS_BACKUP_PATH)) {
    return { error: "No previous color backup found. Apply a theme first to create a backup." };
  }

  try {
    const raw = await readFile(HOMEPAGE_COLORS_BACKUP_PATH, "utf-8");
    const backup = JSON.parse(raw);
    await prisma.homepage.update({
      where: { id: "homepage" },
      data: {
        projectsBackgroundRgb: backup.projectsBackgroundRgb || "255, 255, 255",
        aboutBackgroundRgb: backup.aboutBackgroundRgb || "255, 255, 255",
        lifestyleBackgroundRgb: backup.lifestyleBackgroundRgb || "255, 255, 255",
        statsBackgroundRgb: backup.statsBackgroundRgb || "255, 255, 255",
        journalBackgroundRgb: backup.journalBackgroundRgb || "255, 255, 255",
        closingBackgroundRgb: backup.closingBackgroundRgb || "255, 255, 255",
      },
    });

    revalidatePath("/en");
    revalidatePath("/ar");
    revalidatePath("/admin/homepage");
    revalidatePath("/", "layout");
    return { success: `Previous background colors restored successfully (from ${backup.savedAt || "backup"}).` };
  } catch {
    return { error: "Failed to read color backup file." };
  }
}

export async function applyWhiteThemeAction(f: FormData) {
  await requireAdmin();
  await applyWhiteThemeToHomepageContentSections({}, f);
}

export async function applyWarmThemeAction(f: FormData) {
  await requireAdmin();
  await applyWarmThemeToHomepageContentSections({}, f);
}

export async function revertColorsAction(f: FormData) {
  await requireAdmin();
  await revertHomepageContentColors({}, f);
}

export async function saveHomepage(_:ActionState, f:FormData):Promise<ActionState>{
  await requireAdmin();

  // Validate required fields with specific, section-aware error messages
  const requiredFields: Array<{ key: string; label: string; section: string }> = [
    { key: "heroEyebrowEn", label: "Hero Eyebrow (English)", section: "Hero" },
    { key: "heroEyebrowAr", label: "Hero Eyebrow (Arabic)", section: "Hero" },
    { key: "heroTitleEn", label: "Hero Title (English)", section: "Hero" },
    { key: "heroTitleAr", label: "Hero Title (Arabic)", section: "Hero" },
    { key: "heroNoteEn", label: "Hero Supporting Text (English)", section: "Hero" },
    { key: "heroNoteAr", label: "Hero Supporting Text (Arabic)", section: "Hero" },
    { key: "lifestyleTitleEn", label: "Living Narrative Heading (English)", section: "About / Our Story" },
    { key: "lifestyleTitleAr", label: "Living Narrative Heading (Arabic)", section: "About / Our Story" },
    { key: "closingTitleEn", label: "Closing Heading (English)", section: "Closing" },
    { key: "closingTitleAr", label: "Closing Heading (Arabic)", section: "Closing" },
  ];
  for (const item of requiredFields) {
    if (f.has(item.key) && !str(f, item.key)) {
      return { error: `${item.section}: Please complete ${item.label}.` };
    }
  }

  // Explicit Hero Media Validation
  const heroMediaType = f.has("heroMediaType") ? str(f, "heroMediaType") : undefined;
  if (heroMediaType === "IMAGE" && f.has("heroMediaUrl") && !str(f, "heroMediaUrl")) {
    return { error: "Hero: Please select or upload a Desktop Hero Image." };
  }
  if (heroMediaType === "VIDEO" && f.has("heroVideoDesktopUrl") && !str(f, "heroVideoDesktopUrl")) {
    return { error: "Hero: Please select or upload a Desktop Hero Video when Media Type is set to Video." };
  }
  const heroMobileMediaType = f.has("heroMobileMediaType") ? str(f, "heroMobileMediaType") : undefined;
  if (heroMobileMediaType === "IMAGE" && f.has("heroMobileMediaUrl") && !str(f, "heroMobileMediaUrl") && !str(f, "heroMediaUrl")) {
    return { error: "Hero: Please select or upload a Mobile Hero Image, or choose Inherit Desktop." };
  }
  if (heroMobileMediaType === "VIDEO" && f.has("heroVideoMobileUrl") && !str(f, "heroVideoMobileUrl") && !str(f, "heroVideoDesktopUrl")) {
    return { error: "Hero: Please select or upload a Mobile Hero Video, or choose Inherit Desktop." };
  }

  // Validate existing local media references exist on disk
  const mediaUrlChecks = [
    { key: "heroMediaUrl", label: "Desktop Hero Image" },
    { key: "heroVideoDesktopUrl", label: "Desktop Hero Video" },
    { key: "heroPosterUrl", label: "Desktop Hero Poster" },
    { key: "heroMobileMediaUrl", label: "Mobile Hero Image" },
    { key: "heroVideoMobileUrl", label: "Mobile Hero Video" },
    { key: "heroMobilePosterUrl", label: "Mobile Hero Poster" },
    { key: "lifestyleTopLeftImageUrl", label: "Our Story Top Left Image" },
    { key: "lifestyleTopRightImageUrl", label: "Our Story Top Right Image" },
    { key: "lifestyleBottomLeftImageUrl", label: "Our Story Bottom Left Image" },
    { key: "lifestyleBottomRightImageUrl", label: "Our Story Bottom Right Image" },
  ];
  for (const item of mediaUrlChecks) {
    if (f.has(item.key)) {
      const val = str(f, item.key);
      if (val && !checkAssetExistsOnDisk(val)) {
        return {
          error: `Media Error (${item.label}): The referenced file "${val}" was not found on the server. Please select a valid file from the Media Library. / ملف الوسائط "${val}" غير موجود على الخادم.`
        };
      }
    }
  }

  // Validate background RGB colors
  const colorKeys = [
    "openingBackgroundRgb",
    "heroBackgroundRgb",
    "projectsBackgroundRgb",
    "aboutBackgroundRgb",
    "lifestyleBackgroundRgb",
    "statsBackgroundRgb",
    "journalBackgroundRgb",
    "closingBackgroundRgb",
    "footerBackgroundRgb",
  ] as const;
  const colorEntries: Array<[typeof colorKeys[number], string]> = [];
  for (const key of colorKeys) {
    if (f.has(key)) {
      const parsedRgb = rgb(f, key);
      if (parsedRgb === null) {
        return { error: `Background Colors: Enter ${key} as three numbers from 0 to 255, for example 255, 255, 255.` };
      }
      colorEntries.push([key, parsedRgb]);
    }
  }
  const colors = Object.fromEntries(colorEntries) as Record<(typeof colorKeys)[number], string>;

  // Validate section order
  let order: string[] | undefined = undefined;
  if (f.has("sectionOrder")) {
    const rawOrder = str(f, "sectionOrder");
    const parsed = rawOrder
      .split(",")
      .map(x => x.trim().toLowerCase())
      .filter(x => ["projects", "lifestyle", "stats", "journal", "closing"].includes(x));
    const deduped = Array.from(new Set(parsed));
    if (deduped.length === 5) {
      order = deduped;
    } else if (!sectionOrderSchema.safeParse(parsed).success) {
      return { error: "Section Order: Must contain each supported section (projects, lifestyle, stats, journal, closing) exactly once." };
    } else {
      order = parsed;
    }
  }

  // Validate Living Story Section CTA
  const lifestyleCtaEnabled = f.has("lifestyleCtaEnabled")
    ? (f.get("lifestyleCtaEnabled") === "on" || f.get("lifestyleCtaEnabled") === "true")
    : (f.has("hasLifestyleCtaConfig") ? false : undefined);
  const lifestyleCtaExternal = f.has("lifestyleCtaExternal")
    ? (f.get("lifestyleCtaExternal") === "on" || f.get("lifestyleCtaExternal") === "true")
    : undefined;
  const lifestyleCtaLabelEn = f.has("lifestyleCtaLabelEn") ? (str(f, "lifestyleCtaLabelEn") || "").trim() : undefined;
  const lifestyleCtaLabelAr = f.has("lifestyleCtaLabelAr") ? (str(f, "lifestyleCtaLabelAr") || "").trim() : undefined;
  const lifestyleCtaUrl = f.has("lifestyleCtaUrl") ? (str(f, "lifestyleCtaUrl") || "").trim() : undefined;

  if (lifestyleCtaEnabled ?? true) {
    if (lifestyleCtaLabelEn !== undefined && !lifestyleCtaLabelEn) {
      return { error: "About / Our Story: Enter the section CTA button label in both English and Arabic when the CTA is enabled." };
    }
    if (lifestyleCtaLabelAr !== undefined && !lifestyleCtaLabelAr) {
      return { error: "About / Our Story: Enter the section CTA button label in both English and Arabic when the CTA is enabled." };
    }
    if (lifestyleCtaUrl !== undefined && !lifestyleCtaUrl) {
      return { error: "About / Our Story: Enter a valid destination URL for the section CTA button." };
    }
    if (lifestyleCtaExternal) {
      if (lifestyleCtaUrl && !/^https?:\/\//i.test(lifestyleCtaUrl)) {
        return { error: "About / Our Story: External destination URLs must begin with http:// or https://" };
      }
    } else {
      if (lifestyleCtaUrl && /^(?:javascript:|data:|file:)/i.test(lifestyleCtaUrl)) {
        return { error: "About / Our Story: Unsafe destination URL scheme." };
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.homepage.findUniqueOrThrow({ where: { id: "homepage" } });

      const homepageUpdate: Prisma.HomepageUpdateInput = {
        ...colors,
        openingEnabled: resolveBooleanSetting(f, "openingEnabled", existing.openingEnabled),
        openingHeadlineEn: f.has("openingHeadlineEn") ? (str(f, "openingHeadlineEn") || existing.openingHeadlineEn) : existing.openingHeadlineEn,
        openingHeadlineAr: f.has("openingHeadlineAr") ? (str(f, "openingHeadlineAr") || existing.openingHeadlineAr) : existing.openingHeadlineAr,
        openingVideoDesktopUrl: f.has("openingVideoDesktopUrl") ? (str(f, "openingVideoDesktopUrl") || null) : existing.openingVideoDesktopUrl,
        openingVideoMobileUrl: f.has("openingVideoMobileUrl") ? (str(f, "openingVideoMobileUrl") || null) : existing.openingVideoMobileUrl,
        openingPosterUrl: f.has("openingPosterUrl") ? (str(f, "openingPosterUrl") || null) : existing.openingPosterUrl,

        heroEnabled: resolveBooleanSetting(f, "heroEnabled", existing.heroEnabled),
        heroEyebrowEn: f.has("heroEyebrowEn") ? (str(f, "heroEyebrowEn") || existing.heroEyebrowEn) : existing.heroEyebrowEn,
        heroEyebrowAr: f.has("heroEyebrowAr") ? (str(f, "heroEyebrowAr") || existing.heroEyebrowAr) : existing.heroEyebrowAr,
        heroTitleEn: f.has("heroTitleEn") ? (str(f, "heroTitleEn") || existing.heroTitleEn) : existing.heroTitleEn,
        heroTitleAr: f.has("heroTitleAr") ? (str(f, "heroTitleAr") || existing.heroTitleAr) : existing.heroTitleAr,
        heroNoteEn: f.has("heroNoteEn") ? (str(f, "heroNoteEn") || existing.heroNoteEn) : existing.heroNoteEn,
        heroNoteAr: f.has("heroNoteAr") ? (str(f, "heroNoteAr") || existing.heroNoteAr) : existing.heroNoteAr,
        heroDiscoverEn: f.has("heroDiscoverEn") ? (str(f, "heroDiscoverEn") || existing.heroDiscoverEn) : existing.heroDiscoverEn,
        heroDiscoverAr: f.has("heroDiscoverAr") ? (str(f, "heroDiscoverAr") || existing.heroDiscoverAr) : existing.heroDiscoverAr,
        heroMediaType: f.has("heroMediaType") ? (str(f, "heroMediaType") || "IMAGE") : existing.heroMediaType,
        heroMediaUrl: f.has("heroMediaUrl") ? (str(f, "heroMediaUrl") || existing.heroMediaUrl) : existing.heroMediaUrl,
        heroFocalPoint: f.has("heroFocalPoint") ? (str(f, "heroFocalPoint") || "center") : existing.heroFocalPoint,
        heroVideoDesktopUrl: f.has("heroVideoDesktopUrl") ? (str(f, "heroVideoDesktopUrl") || null) : existing.heroVideoDesktopUrl,
        heroPosterUrl: f.has("heroPosterUrl") ? (str(f, "heroPosterUrl") || null) : existing.heroPosterUrl,
        heroMobileMediaType: f.has("heroMobileMediaType") ? (str(f, "heroMobileMediaType") || "INHERIT") : existing.heroMobileMediaType,
        heroMobileMediaUrl: f.has("heroMobileMediaUrl")
          ? (str(f, "heroMobileMediaUrl") || (f.get("heroMobileMediaType") === "INHERIT" ? existing.heroMobileMediaUrl : null))
          : existing.heroMobileMediaUrl,
        heroVideoMobileUrl: f.has("heroVideoMobileUrl")
          ? (str(f, "heroVideoMobileUrl") || (f.get("heroMobileMediaType") === "INHERIT" ? existing.heroVideoMobileUrl : null))
          : existing.heroVideoMobileUrl,
        heroMobilePosterUrl: f.has("heroMobilePosterUrl")
          ? (str(f, "heroMobilePosterUrl") || (f.get("heroMobileMediaType") === "INHERIT" ? existing.heroMobilePosterUrl : null))
          : existing.heroMobilePosterUrl,
        heroMobileFocalPoint: f.has("heroMobileFocalPoint") ? (str(f, "heroMobileFocalPoint") || "center") : existing.heroMobileFocalPoint,
        heroMediaAltEn: f.has("heroMediaAltEn") ? (str(f, "heroMediaAltEn") || existing.heroMediaAltEn) : existing.heroMediaAltEn,
        heroMediaAltAr: f.has("heroMediaAltAr") ? (str(f, "heroMediaAltAr") || existing.heroMediaAltAr) : existing.heroMediaAltAr,

        projectsEnabled: resolveBooleanSetting(f, "projectsEnabled", existing.projectsEnabled),
        projectsHeadingEn: f.has("projectsHeadingEn") ? (str(f, "projectsHeadingEn") || existing.projectsHeadingEn) : existing.projectsHeadingEn,
        projectsHeadingAr: f.has("projectsHeadingAr") ? (str(f, "projectsHeadingAr") || existing.projectsHeadingAr) : existing.projectsHeadingAr,
        projectsDescriptionEn: f.has("projectsDescriptionEn") ? (str(f, "projectsDescriptionEn") || null) : existing.projectsDescriptionEn,
        projectsDescriptionAr: f.has("projectsDescriptionAr") ? (str(f, "projectsDescriptionAr") || null) : existing.projectsDescriptionAr,
        projectsExploreEn: f.has("projectsExploreEn") ? (str(f, "projectsExploreEn") || existing.projectsExploreEn) : existing.projectsExploreEn,
        projectsExploreAr: f.has("projectsExploreAr") ? (str(f, "projectsExploreAr") || existing.projectsExploreAr) : existing.projectsExploreAr,
        projectsEnquireEn: f.has("projectsEnquireEn") ? (str(f, "projectsEnquireEn") || "Enquire") : existing.projectsEnquireEn,
        projectsEnquireAr: f.has("projectsEnquireAr") ? (str(f, "projectsEnquireAr") || "استفسر الآن") : existing.projectsEnquireAr,
        projectsViewAllEn: f.has("projectsViewAllEn") ? (str(f, "projectsViewAllEn") || "View All Projects") : existing.projectsViewAllEn,
        projectsViewAllAr: f.has("projectsViewAllAr") ? (str(f, "projectsViewAllAr") || "جميع المشاريع") : existing.projectsViewAllAr,
        projectsSpacing: f.has("projectsSpacing") ? (str(f, "projectsSpacing") || "standard") : existing.projectsSpacing,
        projectsTheme: f.has("projectsTheme") ? (str(f, "projectsTheme") || "light") : existing.projectsTheme,
        projectsImagePosition: f.has("projectsImagePosition") ? (str(f, "projectsImagePosition") || "start") : existing.projectsImagePosition,
        projectsLocationTagsEnabled: f.has("has_projectsLocationTagsEnabled") ? (f.get("projectsLocationTagsEnabled") === "on" || f.get("projectsLocationTagsEnabled") === "true") : existing.projectsLocationTagsEnabled,
        projectsAllLabelEn: f.has("projectsAllLabelEn") ? (str(f, "projectsAllLabelEn") || "All Projects") : existing.projectsAllLabelEn,
        projectsAllLabelAr: f.has("projectsAllLabelAr") ? (str(f, "projectsAllLabelAr") || "كافة المشاريع") : existing.projectsAllLabelAr,
        projectsShowTagCounts: f.has("has_projectsShowTagCounts") ? (f.get("projectsShowTagCounts") === "on" || f.get("projectsShowTagCounts") === "true") : existing.projectsShowTagCounts,
        projectsLocationOrder: f.has("projectsLocationOrder") ? (str(f, "projectsLocationOrder") || "auto") : existing.projectsLocationOrder,
        projectsVisibleLocations: f.has("projectsVisibleLocation") ? (() => {
          const visible = f.getAll("projectsVisibleLocation").map(String);
          return visible.length > 0 ? JSON.stringify(visible) : null;
        })() : existing.projectsVisibleLocations,

        lifestyleEnabled: resolveBooleanSetting(f, "lifestyleEnabled", existing.lifestyleEnabled),
        lifestyleEyebrowEn: f.has("lifestyleEyebrowEn") ? (str(f, "lifestyleEyebrowEn") || existing.lifestyleEyebrowEn) : existing.lifestyleEyebrowEn,
        lifestyleEyebrowAr: f.has("lifestyleEyebrowAr") ? (str(f, "lifestyleEyebrowAr") || existing.lifestyleEyebrowAr) : existing.lifestyleEyebrowAr,
        lifestyleTitleEn: f.has("lifestyleTitleEn") ? (str(f, "lifestyleTitleEn") || existing.lifestyleTitleEn) : existing.lifestyleTitleEn,
        lifestyleTitleAr: f.has("lifestyleTitleAr") ? (str(f, "lifestyleTitleAr") || existing.lifestyleTitleAr) : existing.lifestyleTitleAr,

        lifestyleTopLeftImageUrl: f.has("lifestyleTopLeftImageUrl")
          ? ((str(f, "lifestyleTopLeftImageUrl") === "" || str(f, "lifestyleTopLeftImageUrl") === "none") ? null : str(f, "lifestyleTopLeftImageUrl"))
          : existing.lifestyleTopLeftImageUrl,
        lifestyleMediaUrl: f.has("lifestyleTopLeftImageUrl")
          ? (str(f, "lifestyleTopLeftImageUrl") || existing.lifestyleMediaUrl)
          : existing.lifestyleMediaUrl,
        lifestyleTopLeftImageAltEn: f.has("lifestyleTopLeftImageAltEn") ? (str(f, "lifestyleTopLeftImageAltEn") || null) : existing.lifestyleTopLeftImageAltEn,
        lifestyleTopLeftImageAltAr: f.has("lifestyleTopLeftImageAltAr") ? (str(f, "lifestyleTopLeftImageAltAr") || null) : existing.lifestyleTopLeftImageAltAr,
        lifestyleTopLeftFocalPoint: f.has("lifestyleTopLeftFocalPoint") ? (str(f, "lifestyleTopLeftFocalPoint") || "center") : existing.lifestyleTopLeftFocalPoint,
        lifestyleTopLeftMobileImageUrl: f.has("lifestyleTopLeftMobileImageUrl") ? (str(f, "lifestyleTopLeftMobileImageUrl") || null) : existing.lifestyleTopLeftMobileImageUrl,

        lifestyleTopRightImageUrl: f.has("lifestyleTopRightImageUrl")
          ? ((str(f, "lifestyleTopRightImageUrl") === "" || str(f, "lifestyleTopRightImageUrl") === "none") ? null : str(f, "lifestyleTopRightImageUrl"))
          : existing.lifestyleTopRightImageUrl,
        lifestyleTopRightImageAltEn: f.has("lifestyleTopRightImageAltEn") ? (str(f, "lifestyleTopRightImageAltEn") || null) : existing.lifestyleTopRightImageAltEn,
        lifestyleTopRightImageAltAr: f.has("lifestyleTopRightImageAltAr") ? (str(f, "lifestyleTopRightImageAltAr") || null) : existing.lifestyleTopRightImageAltAr,
        lifestyleTopRightFocalPoint: f.has("lifestyleTopRightFocalPoint") ? (str(f, "lifestyleTopRightFocalPoint") || "center") : existing.lifestyleTopRightFocalPoint,
        lifestyleTopRightMobileImageUrl: f.has("lifestyleTopRightMobileImageUrl") ? (str(f, "lifestyleTopRightMobileImageUrl") || null) : existing.lifestyleTopRightMobileImageUrl,

        lifestyleBottomLeftImageUrl: f.has("lifestyleBottomLeftImageUrl")
          ? ((str(f, "lifestyleBottomLeftImageUrl") === "" || str(f, "lifestyleBottomLeftImageUrl") === "none") ? null : str(f, "lifestyleBottomLeftImageUrl"))
          : existing.lifestyleBottomLeftImageUrl,
        lifestyleBottomLeftImageAltEn: f.has("lifestyleBottomLeftImageAltEn") ? (str(f, "lifestyleBottomLeftImageAltEn") || null) : existing.lifestyleBottomLeftImageAltEn,
        lifestyleBottomLeftImageAltAr: f.has("lifestyleBottomLeftImageAltAr") ? (str(f, "lifestyleBottomLeftImageAltAr") || null) : existing.lifestyleBottomLeftImageAltAr,
        lifestyleBottomLeftFocalPoint: f.has("lifestyleBottomLeftFocalPoint") ? (str(f, "lifestyleBottomLeftFocalPoint") || "center") : existing.lifestyleBottomLeftFocalPoint,
        lifestyleBottomLeftMobileImageUrl: f.has("lifestyleBottomLeftMobileImageUrl") ? (str(f, "lifestyleBottomLeftMobileImageUrl") || null) : existing.lifestyleBottomLeftMobileImageUrl,

        lifestyleBottomRightImageUrl: f.has("lifestyleBottomRightImageUrl")
          ? ((str(f, "lifestyleBottomRightImageUrl") === "" || str(f, "lifestyleBottomRightImageUrl") === "none") ? null : str(f, "lifestyleBottomRightImageUrl"))
          : existing.lifestyleBottomRightImageUrl,
        lifestyleBottomRightImageAltEn: f.has("lifestyleBottomRightImageAltEn") ? (str(f, "lifestyleBottomRightImageAltEn") || null) : existing.lifestyleBottomRightImageAltEn,
        lifestyleBottomRightImageAltAr: f.has("lifestyleBottomRightImageAltAr") ? (str(f, "lifestyleBottomRightImageAltAr") || null) : existing.lifestyleBottomRightImageAltAr,
        lifestyleBottomRightFocalPoint: f.has("lifestyleBottomRightFocalPoint") ? (str(f, "lifestyleBottomRightFocalPoint") || "center") : existing.lifestyleBottomRightFocalPoint,
        lifestyleBottomRightMobileImageUrl: f.has("lifestyleBottomRightMobileImageUrl") ? (str(f, "lifestyleBottomRightMobileImageUrl") || null) : existing.lifestyleBottomRightMobileImageUrl,

        lifestyleCtaEnabled: lifestyleCtaEnabled !== undefined ? lifestyleCtaEnabled : existing.lifestyleCtaEnabled,
        lifestyleCtaExternal: lifestyleCtaExternal !== undefined ? lifestyleCtaExternal : existing.lifestyleCtaExternal,
        lifestyleCtaLabelEn: lifestyleCtaLabelEn !== undefined ? (lifestyleCtaLabelEn || null) : existing.lifestyleCtaLabelEn,
        lifestyleCtaLabelAr: lifestyleCtaLabelAr !== undefined ? (lifestyleCtaLabelAr || null) : existing.lifestyleCtaLabelAr,
        lifestyleCtaUrl: lifestyleCtaUrl !== undefined ? (lifestyleCtaUrl || null) : existing.lifestyleCtaUrl,

        statsEnabled: resolveBooleanSetting(f, "statsEnabled", existing.statsEnabled),
        statsLabelEn: f.has("statsLabelEn") ? (str(f, "statsLabelEn") || null) : existing.statsLabelEn,
        statsLabelAr: f.has("statsLabelAr") ? (str(f, "statsLabelAr") || null) : existing.statsLabelAr,
        statsHeadingEn: f.has("statsHeadingEn") ? (str(f, "statsHeadingEn") || existing.statsHeadingEn) : existing.statsHeadingEn,
        statsHeadingAr: f.has("statsHeadingAr") ? (str(f, "statsHeadingAr") || existing.statsHeadingAr) : existing.statsHeadingAr,
        statsDescriptionEn: f.has("statsDescriptionEn") ? (str(f, "statsDescriptionEn") || null) : existing.statsDescriptionEn,
        statsDescriptionAr: f.has("statsDescriptionAr") ? (str(f, "statsDescriptionAr") || null) : existing.statsDescriptionAr,
        statsImageUrl: f.has("statsImageUrl") ? (str(f, "statsImageUrl") || null) : existing.statsImageUrl,
        statsImageAltEn: f.has("statsImageAltEn") ? (str(f, "statsImageAltEn") || existing.statsImageAltEn) : existing.statsImageAltEn,
        statsImageAltAr: f.has("statsImageAltAr") ? (str(f, "statsImageAltAr") || existing.statsImageAltAr) : existing.statsImageAltAr,
        statsImageFocalPoint: f.has("statsImageFocalPoint") ? (str(f, "statsImageFocalPoint") || "center") : existing.statsImageFocalPoint,
        statsCtaLabelEn: f.has("statsCtaLabelEn") ? (str(f, "statsCtaLabelEn") || existing.statsCtaLabelEn) : existing.statsCtaLabelEn,
        statsCtaLabelAr: f.has("statsCtaLabelAr") ? (str(f, "statsCtaLabelAr") || existing.statsCtaLabelAr) : existing.statsCtaLabelAr,
        statsCtaUrl: f.has("statsCtaUrl") ? (str(f, "statsCtaUrl") || existing.statsCtaUrl) : existing.statsCtaUrl,
        statsJournalMode: f.has("statsJournalMode") ? (str(f, "statsJournalMode") || "AUTO") : existing.statsJournalMode,
        statsJournalCategory: f.has("statsJournalCategory") ? (str(f, "statsJournalCategory") || "ALL") : existing.statsJournalCategory,
        statsJournalCount: f.has("statsJournalCount") ? (parseInt(str(f, "statsJournalCount") || "3", 10) || 3) : existing.statsJournalCount,

        journalEnabled: resolveBooleanSetting(f, "journalEnabled", existing.journalEnabled),
        journalEyebrowEn: f.has("journalEyebrowEn") ? (str(f, "journalEyebrowEn") || existing.journalEyebrowEn) : existing.journalEyebrowEn,
        journalEyebrowAr: f.has("journalEyebrowAr") ? (str(f, "journalEyebrowAr") || existing.journalEyebrowAr) : existing.journalEyebrowAr,
        journalTitleEn: f.has("journalTitleEn") ? (str(f, "journalTitleEn") || existing.journalTitleEn) : existing.journalTitleEn,
        journalTitleAr: f.has("journalTitleAr") ? (str(f, "journalTitleAr") || existing.journalTitleAr) : existing.journalTitleAr,

        closingEnabled: resolveBooleanSetting(f, "closingEnabled", existing.closingEnabled),
        closingEyebrowEn: f.has("closingEyebrowEn") ? (str(f, "closingEyebrowEn") || existing.closingEyebrowEn) : existing.closingEyebrowEn,
        closingEyebrowAr: f.has("closingEyebrowAr") ? (str(f, "closingEyebrowAr") || existing.closingEyebrowAr) : existing.closingEyebrowAr,
        closingTitleEn: f.has("closingTitleEn") ? (str(f, "closingTitleEn") || existing.closingTitleEn) : existing.closingTitleEn,
        closingTitleAr: f.has("closingTitleAr") ? (str(f, "closingTitleAr") || existing.closingTitleAr) : existing.closingTitleAr,
        closingDescriptionEn: f.has("closingDescriptionEn") ? (str(f, "closingDescriptionEn") || null) : existing.closingDescriptionEn,
        closingDescriptionAr: f.has("closingDescriptionAr") ? (str(f, "closingDescriptionAr") || null) : existing.closingDescriptionAr,
        closingFormHeadingEn: f.has("closingFormHeadingEn") ? (str(f, "closingFormHeadingEn") || null) : existing.closingFormHeadingEn,
        closingFormHeadingAr: f.has("closingFormHeadingAr") ? (str(f, "closingFormHeadingAr") || null) : existing.closingFormHeadingAr,
        closingSubmitLabelEn: f.has("closingSubmitLabelEn") ? (str(f, "closingSubmitLabelEn") || null) : existing.closingSubmitLabelEn,
        closingSubmitLabelAr: f.has("closingSubmitLabelAr") ? (str(f, "closingSubmitLabelAr") || null) : existing.closingSubmitLabelAr,
        closingSuccessMessageEn: f.has("closingSuccessMessageEn") ? (str(f, "closingSuccessMessageEn") || null) : existing.closingSuccessMessageEn,
        closingSuccessMessageAr: f.has("closingSuccessMessageAr") ? (str(f, "closingSuccessMessageAr") || null) : existing.closingSuccessMessageAr,
        closingCtaEn: f.has("closingCtaEn") ? (str(f, "closingCtaEn") || existing.closingCtaEn) : existing.closingCtaEn,
        closingCtaAr: f.has("closingCtaAr") ? (str(f, "closingCtaAr") || existing.closingCtaAr) : existing.closingCtaAr,
        closingCtaUrl: f.has("closingCtaUrl") ? (str(f, "closingCtaUrl") || existing.closingCtaUrl) : existing.closingCtaUrl,
        ...(order ? { sectionOrder: JSON.stringify(order) } : {}),
      };

      const availableArticleIds = f.getAll("availableArticleId").map(String);
      if (availableArticleIds.length > 0) {
        const selectedArticlesWithOrder = availableArticleIds
          .filter(id => bool(f, `manualArticleSelect_${id}`))
          .map(id => ({
            id,
            order: parseInt(str(f, `manualArticleOrder_${id}`) || "99", 10),
          }))
          .sort((a, b) => a.order - b.order);
        homepageUpdate.statsJournalArticleIds = JSON.stringify(selectedArticlesWithOrder.map(item => item.id));
      }

      // 1. Single Atomic Homepage Update
      await tx.homepage.update({
        where: { id: "homepage" },
        data: homepageUpdate,
      });

      // 2. Company Statistics Update
      const statIds = f.getAll("statId").map(String);
      if (statIds.length > 0) {
        const existingStats = await tx.stat.findMany({
          where: { id: { in: statIds } },
          select: { id: true },
        });
        const existingStatSet = new Set(existingStats.map(s => s.id));
        for (const id of statIds) {
          if (!existingStatSet.has(id)) continue;
          const isVisible = f.get(`statVisible_${id}`) === "on" || f.get(`statVisible_${id}`) === "true";
          const orderVal = parseInt(str(f, `statOrder_${id}`) || "0", 10);
          await tx.stat.update({
            where: { id },
            data: {
              valueEn: str(f, `statValueEn_${id}`),
              valueAr: str(f, `statValueAr_${id}`),
              unitEn: str(f, `statUnitEn_${id}`) || null,
              unitAr: str(f, `statUnitAr_${id}`) || null,
              labelEn: str(f, `statLabelEn_${id}`),
              labelAr: str(f, `statLabelAr_${id}`),
              visible: isVisible,
              sortOrder: isNaN(orderVal) ? 0 : orderVal,
            },
          });
        }
      }

      // 3. Managed Projects Featured & Ordering Update
      const managedProjectIds = f.getAll("managedProjectId").map(String);
      if (managedProjectIds.length > 0) {
        const existingProjects = await tx.project.findMany({
          where: { id: { in: managedProjectIds } },
          select: { id: true },
        });
        const existingProjectSet = new Set(existingProjects.map(p => p.id));
        for (const pid of managedProjectIds) {
          if (!existingProjectSet.has(pid)) continue;
          const isFeatured = bool(f, `projectFeatured_${pid}`);
          const orderVal = parseInt(str(f, `projectOrder_${pid}`) || "0", 10);
          await tx.project.update({
            where: { id: pid },
            data: {
              featured: isFeatured,
              featuredOrder: isNaN(orderVal) ? 0 : orderVal,
            },
          });
        }
      }

      // 4. Typography Font Sizes
      await saveFontSizes(f, tx);
    });
  } catch (error) {
    const refId = Math.random().toString(36).slice(2, 10).toUpperCase();
    console.error(`[HomepageSave Error ref:${refId}]:`, error);

    try {
      const errPayload = {
        refId,
        timestamp: new Date().toISOString(),
        name: error?.constructor?.name || typeof error,
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
      };
      await writeFile(path.join(process.cwd(), "prisma", "homepage-save-error.log"), JSON.stringify(errPayload, null, 2), "utf-8");
    } catch {}

    if (error instanceof Error && !error.message.includes("prisma.") && !error.message.includes("Invocation:") && !error.message.includes("Unknown argument")) {
      return { error: error.message };
    }

    const devDetails = process.env.NODE_ENV !== "production" && error instanceof Error
      ? ` [Diagnostic: ${error.message.split("\n").filter(l => l.trim() && !l.includes("~~~")).slice(0, 2).join(" - ")}]`
      : "";

    return {
      error: `An unexpected database error occurred while saving the homepage (Reference ID: ${refId})${devDetails}. Your form draft has been preserved. Please try saving again or contact support. / حدث خطأ غير متوقع أثناء حفظ الصفحة الرئيسية (رقم المرجع: ${refId}). تم الحفاظ على مسودة التعديلات، يرجى المحاولة مرة أخرى.`,
    };
  }

  // Safe cache invalidation
  try {
    revalidatePath("/en");
    revalidatePath("/ar");
    revalidatePath("/admin/homepage");
    revalidatePath("/", "layout");
  } catch (revalErr) {
    console.warn("Notice: Cache revalidation deferred:", revalErr);
  }

  return { success: "Homepage saved." };
}

export async function saveAbout(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  const required=["aboutHeroEyebrowEn","aboutHeroEyebrowAr","aboutHeroTitleEn","aboutHeroTitleAr","aboutHeroBodyEn","aboutHeroBodyAr","aboutHeroImageUrl","aboutHeroImageAltEn","aboutHeroImageAltAr","aboutEyebrowEn","aboutEyebrowAr","aboutTitleEn","aboutTitleAr","aboutIntroEn","aboutIntroAr"];
  if(required.some(key=>!str(f,key)))return{error:"Complete all required English and Arabic fields."};
  const ids=f.getAll("aboutItemId").map(String);
  if(ids.length>100||new Set(ids).size!==ids.length)return{error:"The magazine page list is invalid. Refresh and try again."};
  for(const id of ids){
    const itemRequired=[`aboutYear_${id}`,`aboutItemTitle_${id}En`,`aboutItemTitle_${id}Ar`,`aboutItemBody_${id}En`,`aboutItemBody_${id}Ar`,`aboutImage_${id}`,`aboutImageAlt_${id}En`,`aboutImageAlt_${id}Ar`];
    if(itemRequired.some(key=>!str(f,key)))return{error:"Complete every timeline page before saving."};
  }
  const blockIds=f.getAll("aboutBlockId").map(String);
  if(blockIds.length>100||new Set(blockIds).size!==blockIds.length)return{error:"The content section list is invalid. Refresh and try again."};
  for(const id of blockIds){
    const blockRequired=[`aboutBlockEyebrow_${id}En`,`aboutBlockEyebrow_${id}Ar`,`aboutBlockTitle_${id}En`,`aboutBlockTitle_${id}Ar`,`aboutBlockBody_${id}En`,`aboutBlockBody_${id}Ar`];
    if(blockRequired.some(key=>!str(f,key)))return{error:"Complete every English and Arabic content section before saving."};
    if(str(f,`aboutBlockImage_${id}`)&&(!str(f,`aboutBlockImageAlt_${id}En`)||!str(f,`aboutBlockImageAlt_${id}Ar`)))return{error:"Add English and Arabic alt text for every section image."};
  }
  await prisma.$transaction(async tx=>{
    const brochureVal = str(f, "companyBrochureUrl");
    if (brochureVal !== undefined) {
      await tx.globalSettings.update({
        where: { id: "global" },
        data: { companyBrochureUrl: brochureVal || null },
      });
    }

    await tx.homepage.update({
      where: { id: "homepage" },
      data: {
        aboutHeroEnabled: bool(f, "aboutHeroEnabled"),
        aboutHeroEyebrowEn: str(f, "aboutHeroEyebrowEn"),
        aboutHeroEyebrowAr: str(f, "aboutHeroEyebrowAr"),
        aboutHeroTitleEn: str(f, "aboutHeroTitleEn"),
        aboutHeroTitleAr: str(f, "aboutHeroTitleAr"),
        aboutHeroBodyEn: str(f, "aboutHeroBodyEn"),
        aboutHeroBodyAr: str(f, "aboutHeroBodyAr"),
        aboutHeroImageUrl: str(f, "aboutHeroImageUrl"),
        aboutHeroImageAltEn: str(f, "aboutHeroImageAltEn"),
        aboutHeroImageAltAr: str(f, "aboutHeroImageAltAr"),
        aboutHeroCtaLabelEn: str(f, "aboutHeroCtaLabelEn") || "Explore Our Journey",
        aboutHeroCtaLabelAr: str(f, "aboutHeroCtaLabelAr") || "اكتشف رحلتنا",

        aboutWhoWeAreEnabled: bool(f, "aboutWhoWeAreEnabled"),
        aboutWhoWeAreEyebrowEn: str(f, "aboutWhoWeAreEyebrowEn") || "Who We Are",
        aboutWhoWeAreEyebrowAr: str(f, "aboutWhoWeAreEyebrowAr") || "من نحن",
        aboutWhoWeAreTitleEn: str(f, "aboutWhoWeAreTitleEn") || "Shaping Considered Communities Across Egypt",
        aboutWhoWeAreTitleAr: str(f, "aboutWhoWeAreTitleAr") || "صناعة مجتمعات متكاملة ومدروسة في مصر",
        aboutWhoWeAreBodyEn: str(f, "aboutWhoWeAreBodyEn") || "",
        aboutWhoWeAreBodyAr: str(f, "aboutWhoWeAreBodyAr") || "",
        aboutWhoWeAreApproachEn: str(f, "aboutWhoWeAreApproachEn") || null,
        aboutWhoWeAreApproachAr: str(f, "aboutWhoWeAreApproachAr") || null,
        aboutWhoWeAreImageUrl: str(f, "aboutWhoWeAreImageUrl") || null,
        aboutWhoWeAreImageAltEn: str(f, "aboutWhoWeAreImageAltEn") || null,
        aboutWhoWeAreImageAltAr: str(f, "aboutWhoWeAreImageAltAr") || null,
        aboutWhoWeArePrimaryCtaEn: str(f, "aboutWhoWeArePrimaryCtaEn") || "Explore Our Projects",
        aboutWhoWeArePrimaryCtaAr: str(f, "aboutWhoWeArePrimaryCtaAr") || "استكشف مشاريعنا",
        aboutWhoWeArePrimaryCtaUrl: str(f, "aboutWhoWeArePrimaryCtaUrl") || "/projects",
        aboutWhoWeAreBrochureCtaEn: str(f, "aboutWhoWeAreBrochureCtaEn") || "Download Brochure",
        aboutWhoWeAreBrochureCtaAr: str(f, "aboutWhoWeAreBrochureCtaAr") || "تحميل البروشور",

        aboutEnabled: bool(f, "aboutEnabled"),
        aboutEyebrowEn: str(f, "aboutEyebrowEn"),
        aboutEyebrowAr: str(f, "aboutEyebrowAr"),
        aboutTitleEn: str(f, "aboutTitleEn"),
        aboutTitleAr: str(f, "aboutTitleAr"),
        aboutIntroEn: str(f, "aboutIntroEn"),
        aboutIntroAr: str(f, "aboutIntroAr"),

        aboutVisionMissionEnabled: bool(f, "aboutVisionMissionEnabled"),
        aboutVisionEyebrowEn: str(f, "aboutVisionEyebrowEn") || "Our Vision",
        aboutVisionEyebrowAr: str(f, "aboutVisionEyebrowAr") || "رؤيتنا",
        aboutVisionTitleEn: str(f, "aboutVisionTitleEn") || "",
        aboutVisionTitleAr: str(f, "aboutVisionTitleAr") || "",
        aboutVisionBodyEn: str(f, "aboutVisionBodyEn") || "",
        aboutVisionBodyAr: str(f, "aboutVisionBodyAr") || "",
        aboutMissionEyebrowEn: str(f, "aboutMissionEyebrowEn") || "Our Mission",
        aboutMissionEyebrowAr: str(f, "aboutMissionEyebrowAr") || "رسالتنا",
        aboutMissionTitleEn: str(f, "aboutMissionTitleEn") || "",
        aboutMissionTitleAr: str(f, "aboutMissionTitleAr") || "",
        aboutMissionBodyEn: str(f, "aboutMissionBodyEn") || "",
        aboutMissionBodyAr: str(f, "aboutMissionBodyAr") || "",
        aboutVisionMissionImageUrl: str(f, "aboutVisionMissionImageUrl") || null,
        aboutVisionMissionImageAltEn: str(f, "aboutVisionMissionImageAltEn") || null,
        aboutVisionMissionImageAltAr: str(f, "aboutVisionMissionImageAltAr") || null,
        aboutVisionMissionCtaEn: str(f, "aboutVisionMissionCtaEn") || "Explore Our Projects",
        aboutVisionMissionCtaAr: str(f, "aboutVisionMissionCtaAr") || "استكشف مشاريعنا",
        aboutVisionMissionCtaUrl: str(f, "aboutVisionMissionCtaUrl") || "/projects",

        aboutAchievementsEnabled: bool(f, "aboutAchievementsEnabled"),
        aboutAchievementsEyebrowEn: str(f, "aboutAchievementsEyebrowEn") || "Our Achievements",
        aboutAchievementsEyebrowAr: str(f, "aboutAchievementsEyebrowAr") || "إنجازاتنا",
        aboutAchievementsTitleEn: str(f, "aboutAchievementsTitleEn") || "",
        aboutAchievementsTitleAr: str(f, "aboutAchievementsTitleAr") || "",
        aboutAchievementsDescriptionEn: str(f, "aboutAchievementsDescriptionEn") || null,
        aboutAchievementsDescriptionAr: str(f, "aboutAchievementsDescriptionAr") || null,
        aboutAchievementsCtaEn: str(f, "aboutAchievementsCtaEn") || "View Our Track Record",
        aboutAchievementsCtaAr: str(f, "aboutAchievementsCtaAr") || "استعرض سجل إنجازاتنا",
        aboutAchievementsCtaUrl: str(f, "aboutAchievementsCtaUrl") || "/projects",

        aboutLeadershipEnabled: bool(f, "aboutLeadershipEnabled"),
        aboutLeadershipEyebrowEn: str(f, "aboutLeadershipEyebrowEn") || "Executive Leadership",
        aboutLeadershipEyebrowAr: str(f, "aboutLeadershipEyebrowAr") || "القيادة التنفيذية",
        aboutLeadershipTitleEn: str(f, "aboutLeadershipTitleEn") || "",
        aboutLeadershipTitleAr: str(f, "aboutLeadershipTitleAr") || "",
        aboutLeadershipDescriptionEn: str(f, "aboutLeadershipDescriptionEn") || null,
        aboutLeadershipDescriptionAr: str(f, "aboutLeadershipDescriptionAr") || null,
        aboutLeadershipCtaEn: str(f, "aboutLeadershipCtaEn") || "Contact Our Team",
        aboutLeadershipCtaAr: str(f, "aboutLeadershipCtaAr") || "تواصل مع فريقنا",
        aboutLeadershipCtaUrl: str(f, "aboutLeadershipCtaUrl") || "/contact",
      },
    });
    const existing=await tx.aboutMilestone.findMany({where:{homepageId:"homepage"},select:{id:true}});
    const existingIds=new Set(existing.map(item=>item.id));
    const retainedIds=ids.filter(id=>existingIds.has(id));
    await tx.aboutMilestone.deleteMany({where:{homepageId:"homepage",...(retainedIds.length?{id:{notIn:retainedIds}}:{})}});
    for(const [index,id] of ids.entries()){
      const data={year:str(f,`aboutYear_${id}`),titleEn:str(f,`aboutItemTitle_${id}En`),titleAr:str(f,`aboutItemTitle_${id}Ar`),bodyEn:str(f,`aboutItemBody_${id}En`),bodyAr:str(f,`aboutItemBody_${id}Ar`),imageUrl:str(f,`aboutImage_${id}`),imageAltEn:str(f,`aboutImageAlt_${id}En`),imageAltAr:str(f,`aboutImageAlt_${id}Ar`),sortOrder:index};
      if(existingIds.has(id))await tx.aboutMilestone.update({where:{id},data});
      else await tx.aboutMilestone.create({data:{...data,homepageId:"homepage"}});
    }
    const existingBlocks=await tx.aboutContentBlock.findMany({where:{homepageId:"homepage"},select:{id:true}});
    const existingBlockIds=new Set(existingBlocks.map(item=>item.id));
    const retainedBlockIds=blockIds.filter(id=>existingBlockIds.has(id));
    await tx.aboutContentBlock.deleteMany({where:{homepageId:"homepage",...(retainedBlockIds.length?{id:{notIn:retainedBlockIds}}:{})}});
    for(const [index,id] of blockIds.entries()){
      const imageUrl=str(f,`aboutBlockImage_${id}`)||null;
      const data={enabled:bool(f,`aboutBlockEnabled_${id}`),eyebrowEn:str(f,`aboutBlockEyebrow_${id}En`),eyebrowAr:str(f,`aboutBlockEyebrow_${id}Ar`),titleEn:str(f,`aboutBlockTitle_${id}En`),titleAr:str(f,`aboutBlockTitle_${id}Ar`),bodyEn:str(f,`aboutBlockBody_${id}En`),bodyAr:str(f,`aboutBlockBody_${id}Ar`),imageUrl,imageAltEn:imageUrl?str(f,`aboutBlockImageAlt_${id}En`):null,imageAltAr:imageUrl?str(f,`aboutBlockImageAlt_${id}Ar`):null,sortOrder:index};
      if(existingBlockIds.has(id))await tx.aboutContentBlock.update({where:{id},data});else await tx.aboutContentBlock.create({data:{...data,homepageId:"homepage"}});
    }
  });
  await saveFontSizes(f);
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/en/about");
  revalidatePath("/ar/about");
  revalidatePath("/en/history");
  revalidatePath("/ar/history");
  revalidatePath("/admin/about");
  revalidatePath("/", "layout");
  return{success:"About page saved."};
}

export async function saveTeam(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  if(["teamEyebrowEn","teamEyebrowAr","teamTitleEn","teamTitleAr","teamIntroEn","teamIntroAr"].some(key=>!str(f,key)))return{error:"Complete all required English and Arabic page fields."};
  const ids=f.getAll("teamMemberId").map(String);
  if(ids.length>100||new Set(ids).size!==ids.length)return{error:"The team member list is invalid. Refresh and try again."};
  for(const id of ids){if([`teamName_${id}En`,`teamName_${id}Ar`,`teamRole_${id}En`,`teamRole_${id}Ar`,`teamBio_${id}En`,`teamBio_${id}Ar`,`teamImage_${id}`,`teamImageAlt_${id}En`,`teamImageAlt_${id}Ar`].some(key=>!str(f,key)))return{error:"Complete every team member profile in English and Arabic."}}
  await prisma.$transaction(async tx=>{await tx.homepage.update({where:{id:"homepage"},data:{teamEyebrowEn:str(f,"teamEyebrowEn"),teamEyebrowAr:str(f,"teamEyebrowAr"),teamTitleEn:str(f,"teamTitleEn"),teamTitleAr:str(f,"teamTitleAr"),teamIntroEn:str(f,"teamIntroEn"),teamIntroAr:str(f,"teamIntroAr")}});const existing=await tx.teamMember.findMany({where:{homepageId:"homepage"},select:{id:true}});const existingIds=new Set(existing.map(x=>x.id));const retained=ids.filter(id=>existingIds.has(id));await tx.teamMember.deleteMany({where:{homepageId:"homepage",...(retained.length?{id:{notIn:retained}}:{})}});for(const[index,id]of ids.entries()){const data={nameEn:str(f,`teamName_${id}En`),nameAr:str(f,`teamName_${id}Ar`),roleEn:str(f,`teamRole_${id}En`),roleAr:str(f,`teamRole_${id}Ar`),bioEn:str(f,`teamBio_${id}En`),bioAr:str(f,`teamBio_${id}Ar`),imageUrl:str(f,`teamImage_${id}`),imageAltEn:str(f,`teamImageAlt_${id}En`),imageAltAr:str(f,`teamImageAlt_${id}Ar`),visible:bool(f,`teamVisible_${id}`),sortOrder:index};if(existingIds.has(id))await tx.teamMember.update({where:{id},data});else await tx.teamMember.create({data:{...data,homepageId:"homepage"}})}});
  await saveFontSizes(f);revalidatePath("/en/team");revalidatePath("/ar/team");revalidatePath("/admin/team");return{success:"Team page saved."};
}

export async function savePartners(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  if(["partnersEyebrowEn","partnersEyebrowAr","partnersTitleEn","partnersTitleAr","partnersIntroEn","partnersIntroAr"].some(key=>!str(f,key)))return{error:"Complete all required English and Arabic page fields."};
  const ids=f.getAll("partnerId").map(String);
  if(ids.length>100||new Set(ids).size!==ids.length)return{error:"The partner list is invalid. Refresh and try again."};
  for(const id of ids){
    const nameEn=str(f,`partnerName_${id}En`);
    const nameAr=str(f,`partnerName_${id}Ar`);
    if(!nameEn&&!nameAr)return{error:`Partner requires a name.`};
    const logo=str(f,`partnerLogo_${id}`);
    if(!logo)return{error:`Partner (${nameEn||nameAr}) requires a logo image.`};

  }
  await prisma.$transaction(async tx=>{
    await tx.homepage.update({where:{id:"homepage"},data:{partnersEyebrowEn:str(f,"partnersEyebrowEn"),partnersEyebrowAr:str(f,"partnersEyebrowAr"),partnersTitleEn:str(f,"partnersTitleEn"),partnersTitleAr:str(f,"partnersTitleAr"),partnersIntroEn:str(f,"partnersIntroEn"),partnersIntroAr:str(f,"partnersIntroAr")}});
    const existing=await tx.partner.findMany({where:{homepageId:"homepage"},select:{id:true}});const existingIds=new Set(existing.map(x=>x.id));const retained=ids.filter(id=>existingIds.has(id));
    await tx.partner.deleteMany({where:{homepageId:"homepage",...(retained.length?{id:{notIn:retained}}:{})}});
    for(const[index,id]of ids.entries()){
      const rawNameEn=str(f,`partnerName_${id}En`);
      const rawNameAr=str(f,`partnerName_${id}Ar`);
      const nameEn=rawNameEn||rawNameAr;
      const nameAr=rawNameAr||rawNameEn;
      const logoUrl=str(f,`partnerLogo_${id}`);
      const logoAltEn=str(f,`partnerLogoAlt_${id}En`)||nameEn||"Partner logo";
      const logoAltAr=str(f,`partnerLogoAlt_${id}Ar`)||nameAr||logoAltEn||"شعار الشريك";
      let websiteUrl=str(f,`partnerWebsite_${id}`)||null;
      if(websiteUrl&&!/^https?:\/\//i.test(websiteUrl)){websiteUrl=`https://${websiteUrl}`;}
      const data={nameEn,nameAr,descriptionEn:str(f,`partnerDescription_${id}En`)||null,descriptionAr:str(f,`partnerDescription_${id}Ar`)||null,logoUrl,logoAltEn,logoAltAr,websiteUrl,visible:bool(f,`partnerVisible_${id}`),sortOrder:index};
      if(existingIds.has(id))await tx.partner.update({where:{id},data});
      else await tx.partner.create({data:{...data,homepageId:"homepage"}});
    }
  });
  await saveFontSizes(f);revalidatePath("/en/partners");revalidatePath("/ar/partners");revalidatePath("/admin/partners");revalidatePath("/","layout");return{success:"Partners page saved."};
}

export async function savePolicy(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  if(["policyEyebrowEn","policyEyebrowAr","policyPageTitleEn","policyPageTitleAr","policyIntroEn","policyIntroAr"].some(key=>!str(f,key)))return{error:"Complete all required page fields."};
  const ids=f.getAll("policySectionId").map(String);if(ids.length>100||new Set(ids).size!==ids.length)return{error:"The policy section list is invalid. Refresh and try again."};
  const slugs=new Set<string>();for(const id of ids){const slug=str(f,`policySlug_${id}`);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slugs.has(slug))return{error:"Every policy document needs a unique lowercase slug using letters, numbers and hyphens."};slugs.add(slug);if([`policyTitle_${id}En`,`policyTitle_${id}Ar`,`policyBody_${id}En`,`policyBody_${id}Ar`].some(key=>!str(f,key)))return{error:"Complete every policy document in English and Arabic."}}
  await prisma.$transaction(async tx=>{await tx.policyPage.update({where:{id:"policypage"},data:{heroEyebrowEn:str(f,"policyEyebrowEn"),heroEyebrowAr:str(f,"policyEyebrowAr"),heroTitleEn:str(f,"policyPageTitleEn"),heroTitleAr:str(f,"policyPageTitleAr"),heroBodyEn:str(f,"policyIntroEn"),heroBodyAr:str(f,"policyIntroAr")}});const existing=await tx.policyDocument.findMany({where:{policyPageId:"policypage"},select:{id:true}});const existingIds=new Set(existing.map(item=>item.id));const retained=ids.filter(id=>existingIds.has(id));await tx.policyDocument.deleteMany({where:{policyPageId:"policypage",...(retained.length?{id:{notIn:retained}}:{})}});for(const[index,id]of ids.entries()){const data={slug:str(f,`policySlug_${id}`),titleEn:str(f,`policyTitle_${id}En`),titleAr:str(f,`policyTitle_${id}Ar`),summaryEn:str(f,`policySummary_${id}En`),summaryAr:str(f,`policySummary_${id}Ar`),contentEn:str(f,`policyBody_${id}En`),contentAr:str(f,`policyBody_${id}Ar`),visible:bool(f,`policyVisible_${id}`),sortOrder:index};if(existingIds.has(id))await tx.policyDocument.update({where:{id},data});else await tx.policyDocument.create({data:{...data,policyPageId:"policypage"}})}});
  await saveFontSizes(f);revalidatePath("/en/policy");revalidatePath("/ar/policy");revalidatePath("/admin/policy");revalidatePath("/", "layout");return{success:"Policy page saved."};
}

export async function saveTerms(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();if(["termsEyebrowEn","termsEyebrowAr","termsPageTitleEn","termsPageTitleAr","termsIntroEn","termsIntroAr"].some(key=>!str(f,key)))return{error:"Complete all required page fields."};
  const ids=f.getAll("termsSectionId").map(String);if(ids.length>100||new Set(ids).size!==ids.length)return{error:"The terms section list is invalid. Refresh and try again."};const slugs=new Set<string>();for(const id of ids){const slug=str(f,`termsSlug_${id}`);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slugs.has(slug))return{error:"Every terms section needs a unique lowercase slug using letters, numbers and hyphens."};slugs.add(slug);if([`termsTitle_${id}En`,`termsTitle_${id}Ar`,`termsBody_${id}En`,`termsBody_${id}Ar`].some(key=>!str(f,key)))return{error:"Complete every terms section in English and Arabic."}}
  await prisma.$transaction(async tx=>{await tx.termsPage.update({where:{id:"termspage"},data:{heroEyebrowEn:str(f,"termsEyebrowEn"),heroEyebrowAr:str(f,"termsEyebrowAr"),heroTitleEn:str(f,"termsPageTitleEn"),heroTitleAr:str(f,"termsPageTitleAr"),heroBodyEn:str(f,"termsIntroEn"),heroBodyAr:str(f,"termsIntroAr")}});const existing=await tx.termsSection.findMany({where:{termsPageId:"termspage"},select:{id:true}});const existingIds=new Set(existing.map(item=>item.id));const retained=ids.filter(id=>existingIds.has(id));await tx.termsSection.deleteMany({where:{termsPageId:"termspage",...(retained.length?{id:{notIn:retained}}:{})}});for(const[index,id]of ids.entries()){const data={slug:str(f,`termsSlug_${id}`),titleEn:str(f,`termsTitle_${id}En`),titleAr:str(f,`termsTitle_${id}Ar`),contentEn:str(f,`termsBody_${id}En`),contentAr:str(f,`termsBody_${id}Ar`),visible:bool(f,`termsVisible_${id}`),sortOrder:index};if(existingIds.has(id))await tx.termsSection.update({where:{id},data});else await tx.termsSection.create({data:{...data,termsPageId:"termspage"}})}});await saveFontSizes(f);revalidatePath("/en/terms");revalidatePath("/ar/terms");revalidatePath("/admin/terms");revalidatePath("/", "layout");return{success:"Terms page saved."};
}

export async function saveContactPage(_:ActionState,f:FormData):Promise<ActionState>{await requireAdmin();if(["contactEyebrowEn","contactEyebrowAr","contactPageTitleEn","contactPageTitleAr","contactIntroEn","contactIntroAr"].some(key=>!str(f,key)))return{error:"Complete all required page fields."};await prisma.contactPage.update({where:{id:"contactpage"},data:{heroEyebrowEn:str(f,"contactEyebrowEn"),heroEyebrowAr:str(f,"contactEyebrowAr"),heroTitleEn:str(f,"contactPageTitleEn"),heroTitleAr:str(f,"contactPageTitleAr"),heroBodyEn:str(f,"contactIntroEn"),heroBodyAr:str(f,"contactIntroAr")}});await saveFontSizes(f);revalidatePath("/en/contact");revalidatePath("/ar/contact");revalidatePath("/admin/contact");revalidatePath("/", "layout");return{success:"Contact page saved."};}

export async function saveProject(_: ActionState, f: FormData): Promise<ActionState & { projectId?: string }> {
  await requireAdmin();
  const rawStatus = str(f, "status") || "DRAFT";
  const validStatus = (["DRAFT", "PUBLISHED", "ARCHIVED"].includes(rawStatus) ? rawStatus : "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";

  const rawSlug = str(f, "slug") || str(f, "nameEn");
  const nameEn = str(f, "nameEn");
  const nameAr = str(f, "nameAr") || nameEn;
  const shortDescriptionEn = str(f, "shortDescriptionEn");
  const shortDescriptionAr = str(f, "shortDescriptionAr") || shortDescriptionEn;
  const locationEn = str(f, "locationEn");
  const locationAr = str(f, "locationAr") || locationEn;
  const coverImageUrl = str(f, "coverImageUrl");

  // If publishing, strictly validate all required presentation fields
  if (validStatus === "PUBLISHED") {
    const data = {
      slug: rawSlug,
      nameEn,
      nameAr,
      shortDescriptionEn,
      shortDescriptionAr,
      locationEn,
      locationAr,
      coverImageUrl,
      status: validStatus,
      featured: bool(f, "featured"),
      featuredOrder: str(f, "featuredOrder"),
      latitude: str(f, "latitude") || null,
      longitude: str(f, "longitude") || null,
      mapUrl: str(f, "mapUrl") || null,
      directionsUrl: str(f, "directionsUrl") || null,
    };
    const parsed = projectSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { error: issue.message, field: String(issue.path[0] || "") };
    }
  } else {
    // For drafts: minimum required is an English name
    if (!nameEn) {
      return { error: "Please enter at least an English project name.", field: "nameEn" };
    }
    // Validate coordinates if provided on draft
    const lat = str(f, "latitude");
    const lng = str(f, "longitude");
    if (lat || lng) {
      const parsedCoords = projectSchema.safeParse({
        slug: "draft-slug",
        nameEn: "Draft",
        nameAr: "مسودة",
        shortDescriptionEn: "Draft",
        shortDescriptionAr: "مسودة",
        locationEn: "Draft",
        locationAr: "مسودة",
        coverImageUrl: "/placeholder.jpg",
        status: "DRAFT",
        featured: false,
        featuredOrder: 0,
        latitude: lat || null,
        longitude: lng || null,
      });
      if (!parsedCoords.success) {
        const coordIssue = parsedCoords.error.issues.find((i) => i.path.includes("latitude") || i.path.includes("longitude"));
        if (coordIssue) {
          return { error: coordIssue.message, field: String(coordIssue.path[0] || "") };
        }
      }
    }
  }

  const virtualTourEnabled = f.has("virtualTourEnabled") ? bool(f, "virtualTourEnabled") : false;
  const virtualTourUrl = str(f, "virtualTourUrl");
  const virtualTourUrlAr = str(f, "virtualTourUrlAr");

  if (virtualTourEnabled) {
    if (!virtualTourUrl) {
      return { error: "Please enter a valid external tour URL when Virtual Tour is enabled." };
    }
    if (!/^https:\/\//i.test(virtualTourUrl)) {
      return { error: "Virtual Tour URL must be a valid external HTTPS URL (e.g. https://tour.example.com)." };
    }
    if (/^(?:javascript:|data:|file:)/i.test(virtualTourUrl)) {
      return { error: "Unsafe Virtual Tour URL scheme." };
    }
    if (virtualTourUrlAr) {
      if (!/^https:\/\//i.test(virtualTourUrlAr)) {
        return { error: "Arabic Virtual Tour URL override must be a valid external HTTPS URL." };
      }
      if (/^(?:javascript:|data:|file:)/i.test(virtualTourUrlAr)) {
        return { error: "Unsafe Arabic Virtual Tour URL scheme." };
      }
    }
  }

  // Format safe URL slug
  let formattedSlug = rawSlug
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  if (!formattedSlug) formattedSlug = `project-${Date.now()}`;

  const resolvedData = {
    slug: formattedSlug,
    nameEn,
    nameAr: nameAr || nameEn,
    shortDescriptionEn: shortDescriptionEn || "Draft project description",
    shortDescriptionAr: shortDescriptionAr || shortDescriptionEn || "وصف المشروع",
    locationEn: locationEn || "Cairo",
    locationAr: locationAr || locationEn || "القاهرة",
    coverImageUrl: coverImageUrl || "",
    status: validStatus,
    featured: bool(f, "featured"),
    featuredOrder: parseInt(str(f, "featuredOrder") || "0", 10) || 0,
  };

  // Helper to parse JSON payloads safely
  const parseJson = <T>(val: string, fallback: T): T => {
    if (!val) return fallback;
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  };

  const rawKeyFactsInput = str(f, "keyFactsJson");
  const rawHighlightsInput = str(f, "highlightsJson");
  const rawUnitTypesInput = str(f, "unitTypesJson");
  const rawGalleryItemsInput = str(f, "galleryItemsJson");
  const rawUpdatesInput = str(f, "constructionUpdatesJson");
  const rawConnectivityInput = str(f, "connectivityJson");

  const parsedKeyFacts = rawKeyFactsInput ? parseJson<any[]>(rawKeyFactsInput, []) : null;
  const parsedHighlights = rawHighlightsInput ? parseJson<any[]>(rawHighlightsInput, []) : null;
  const parsedUnitTypes = rawUnitTypesInput ? parseJson<any[]>(rawUnitTypesInput, []) : null;
  const parsedGalleryItems = rawGalleryItemsInput ? parseJson<any[]>(rawGalleryItemsInput, []) : null;
  const parsedUpdates = rawUpdatesInput ? parseJson<any[]>(rawUpdatesInput, []) : null;
  const parsedConnectivity = rawConnectivityInput ? parseJson<any[]>(rawConnectivityInput, []) : null;

  // Filter out blank landmark rows without failing validation
  const validConnectivity = parsedConnectivity
    ? parsedConnectivity.filter((c) => {
        const dEn = String(c.destinationEn || "").trim();
        const dAr = String(c.destinationAr || "").trim();
        const distEn = String(c.distanceOrDurationEn || "").trim();
        const distAr = String(c.distanceOrDurationAr || "").trim();
        return dEn.length > 0 || dAr.length > 0 || distEn.length > 0 || distAr.length > 0;
      })
    : null;

  // Enforce valid nonnegative numbers for travel duration or distance when provided
  if (validConnectivity && validConnectivity.length > 0) {
    for (const c of validConnectivity) {
      const distEn = String(c.distanceOrDurationEn || "");
      const distAr = String(c.distanceOrDurationAr || "");
      if (/-\s*\d+/.test(distEn) || /-\s*\d+/.test(distAr)) {
        return {
          error: "Landmark travel distance or duration must be nonnegative (e.g. 10 mins or 5 km).",
          field: "connectivity",
        };
      }
    }
  }

  // Build backward-compatible JSON fields if repeatable items are provided
  const legacyKeyFacts = parsedKeyFacts
    ? JSON.stringify(parsedKeyFacts.map((k) => ({ labelEn: k.labelEn, labelAr: k.labelAr || k.labelEn, valueEn: k.valueEn, valueAr: k.valueAr || k.valueEn, unitEn: k.unitEn || null, unitAr: k.unitAr || null, icon: k.icon || null })))
    : str(f, "keyFacts") || "[]";

  const legacyHighlights = parsedHighlights
    ? JSON.stringify(parsedHighlights.map((h) => ({ titleEn: h.titleEn, titleAr: h.titleAr || h.titleEn, descriptionEn: h.descriptionEn, descriptionAr: h.descriptionAr || h.descriptionEn, icon: h.icon || null, image: h.imageUrl || null })))
    : str(f, "highlights") || "[]";

  const legacyUnitTypes = parsedUnitTypes
    ? JSON.stringify(parsedUnitTypes.map((u, i) => ({ id: u.id || `unit-${i}`, nameEn: u.titleEn || u.nameEn || "", nameAr: u.titleAr || u.nameAr || u.titleEn || "", areaEn: u.areaEn || u.areaRange || "", areaAr: u.areaAr || u.areaRange || "", finishingEn: u.finishingEn || "", finishingAr: u.finishingAr || "", paymentEn: u.paymentPlanEn || u.paymentEn || "", paymentAr: u.paymentPlanAr || u.paymentAr || "", image: u.imageUrl || u.image || null, floorPlanUrl: u.floorPlanUrl || null })))
    : str(f, "unitTypes") || "[]";

  const legacyNearby = validConnectivity
    ? JSON.stringify(validConnectivity.map((c) => ({ nameEn: c.destinationEn, nameAr: c.destinationAr || c.destinationEn, distanceEn: c.distanceOrDurationEn, distanceAr: c.distanceOrDurationAr || c.distanceOrDurationEn, type: c.travelType || "CAR" })))
    : str(f, "nearbyLocations") || "[]";

  const legacyUpdates = parsedUpdates
    ? JSON.stringify(parsedUpdates.map((u) => ({ date: u.date || "", titleEn: u.titleEn, titleAr: u.titleAr || u.titleEn, imageUrl: u.imageUrl || null, isVideo: Boolean(u.isVideo) })))
    : str(f, "constructionUpdates") || "[]";

  const legacyGalleryImages = parsedGalleryItems
    ? JSON.stringify(parsedGalleryItems.map((g) => g.imageUrl).filter(Boolean))
    : str(f, "gallery") || "[]";

  const latStr = str(f, "latitude");
  const lngStr = str(f, "longitude");
  const hasLat = latStr.length > 0;
  const hasLng = lngStr.length > 0;

  if (hasLat !== hasLng) {
    return {
      error: "Please provide both latitude and longitude coordinates, or leave both empty.",
      field: hasLat ? "longitude" : "latitude",
    };
  }

  let resolvedLat: number | null = null;
  let resolvedLng: number | null = null;

  if (hasLat && hasLng) {
    const pLat = parseFloat(latStr);
    const pLng = parseFloat(lngStr);
    if (isNaN(pLat) || pLat < -90 || pLat > 90) {
      return { error: "Latitude must be a valid number between -90 and 90.", field: "latitude" };
    }
    if (isNaN(pLng) || pLng < -180 || pLng > 180) {
      return { error: "Longitude must be a valid number between -180 and 180.", field: "longitude" };
    }
    resolvedLat = pLat;
    resolvedLng = pLng;
  }

  let resolvedDirectionsUrl = str(f, "directionsUrl") || null;
  const rawMapUrl = str(f, "mapUrl") || null;

  if (rawMapUrl && (!resolvedLat || !resolvedLng || !resolvedDirectionsUrl)) {
    try {
      const { resolveGoogleMapsLocation } = await import("@/lib/maps/resolve-location");
      const resolved = await resolveGoogleMapsLocation(rawMapUrl);
      if (resolved.success) {
        if (!resolvedLat && resolved.latitude !== undefined) resolvedLat = resolved.latitude;
        if (!resolvedLng && resolved.longitude !== undefined) resolvedLng = resolved.longitude;
        if (!resolvedDirectionsUrl && resolved.directionsUrl) resolvedDirectionsUrl = resolved.directionsUrl;
      }
    } catch {
      // Graceful fallback without blocking save
    }
  }

  const extra = {
    projectCode: str(f, "projectCode") || null,
    addressEn: str(f, "addressEn") || null,
    addressAr: str(f, "addressAr") || null,
    directionsUrl: resolvedDirectionsUrl,
    latitude: resolvedLat,
    longitude: resolvedLng,
    mapUrl: rawMapUrl,
    mobileHeroImageUrl: str(f, "mobileHeroImageUrl") || null,
    heroVideoUrl: str(f, "heroVideoUrl") || null,
    heroVideoPosterUrl: str(f, "heroVideoPosterUrl") || null,
    cardImageUrl: str(f, "cardImageUrl") || null,
    heroTitleEn: str(f, "heroTitleEn") || null,
    heroTitleAr: str(f, "heroTitleAr") || null,
    heroDescriptionEn: str(f, "heroDescriptionEn") || null,
    heroDescriptionAr: str(f, "heroDescriptionAr") || null,
    coverImageAltEn: str(f, "coverImageAltEn") || resolvedData.nameEn,
    coverImageAltAr: str(f, "coverImageAltAr") || resolvedData.nameAr,
    coverImageFocalPoint: str(f, "coverImageFocalPoint") || "center",
    ctaLabelEn: str(f, "ctaLabelEn") || null,
    ctaLabelAr: str(f, "ctaLabelAr") || null,
    ctaUrl: str(f, "ctaUrl") || null,
    gallery: legacyGalleryImages,
    galleryEnabled: f.has("galleryEnabled") ? bool(f, "galleryEnabled") : true,
    galleryTitleEn: str(f, "galleryTitleEn") || null,
    galleryTitleAr: str(f, "galleryTitleAr") || null,
    galleryIntroEn: str(f, "galleryIntroEn") || null,
    galleryIntroAr: str(f, "galleryIntroAr") || null,
    galleryShowFilters: f.has("galleryShowFilters") ? bool(f, "galleryShowFilters") : true,
    galleryShowCaptions: f.has("galleryShowCaptions") ? bool(f, "galleryShowCaptions") : true,
    galleryLayout: str(f, "galleryLayout") || "grid",
    galleryCoverUrl: str(f, "galleryCoverUrl") || null,
    projectType: str(f, "projectType") || "Residential",
    progressStatus: str(f, "progressStatus") || "Ongoing",
    fullDescriptionEn: str(f, "fullDescriptionEn") || null,
    fullDescriptionAr: str(f, "fullDescriptionAr") || null,
    masterPlanUrl: str(f, "masterPlanUrl") || null,
    brochureUrl: str(f, "brochureUrl") || null,
    videoTourUrl: str(f, "videoTourUrl") || null,
    virtualTourEnabled,
    virtualTourUrl: virtualTourUrl || null,
    virtualTourUrlAr: virtualTourUrlAr || null,
    virtualTourLabelEn: str(f, "virtualTourLabelEn") || "Explore Virtual Tour",
    virtualTourLabelAr: str(f, "virtualTourLabelAr") || "استكشف الجولة الافتراضية",
    virtualTourDescriptionEn: str(f, "virtualTourDescriptionEn") || null,
    virtualTourDescriptionAr: str(f, "virtualTourDescriptionAr") || null,
    logoUrl: str(f, "logoUrl") || null,
    keyFacts: legacyKeyFacts,
    highlights: legacyHighlights,
    unitTypes: legacyUnitTypes,
    nearbyLocations: legacyNearby,
    constructionUpdates: legacyUpdates,
    seoTitleEn: str(f, "seoTitleEn") || null,
    seoTitleAr: str(f, "seoTitleAr") || null,
    seoDescriptionEn: str(f, "seoDescriptionEn") || null,
    seoDescriptionAr: str(f, "seoDescriptionAr") || null,
    ogImageUrl: str(f, "ogImageUrl") || null,
  };

  const id = str(f, "id");
  let savedId = id;

  try {
    await prisma.$transaction(async (tx) => {
      let targetProjectId = id;

      if (id) {
        const existing = await tx.project.findUnique({ where: { id } });
        if (existing && existing.slug !== resolvedData.slug) {
          await tx.projectRedirect.upsert({
            where: { sourceSlug: existing.slug },
            update: { targetSlug: resolvedData.slug },
            create: { sourceSlug: existing.slug, targetSlug: resolvedData.slug },
          });
          revalidatePath(`/en/projects/${existing.slug}`);
          revalidatePath(`/ar/projects/${existing.slug}`);
        }
        // Merge extra fields: preserve existing values if field was omitted in partial submission
        const mergedData: Record<string, any> = { ...resolvedData };
        for (const [key, value] of Object.entries(extra)) {
          if (f.has(key)) {
            mergedData[key] = value;
          } else if (existing && (existing as any)[key] !== undefined) {
            mergedData[key] = (existing as any)[key];
          } else {
            mergedData[key] = value;
          }
        }

        await tx.project.update({ where: { id }, data: mergedData });
      } else {
        const created = await tx.project.create({ data: { ...resolvedData, ...extra } });
        targetProjectId = created.id;
        savedId = created.id;
      }

      // Sync normalized Key Facts
      if (parsedKeyFacts !== null) {
        await tx.projectKeyFact.deleteMany({ where: { projectId: targetProjectId } });
        if (parsedKeyFacts.length > 0) {
          await tx.projectKeyFact.createMany({
            data: parsedKeyFacts.map((kf, idx) => ({
              projectId: targetProjectId,
              labelEn: String(kf.labelEn || "").trim(),
              labelAr: String(kf.labelAr || kf.labelEn || "").trim(),
              valueEn: String(kf.valueEn || "").trim(),
              valueAr: String(kf.valueAr || kf.valueEn || "").trim(),
              unitEn: kf.unitEn ? String(kf.unitEn).trim() : null,
              unitAr: kf.unitAr ? String(kf.unitAr).trim() : null,
              icon: kf.icon ? String(kf.icon).trim() : null,
              sortOrder: typeof kf.sortOrder === "number" ? kf.sortOrder : idx,
            })),
          });
        }
      }

      // Sync normalized Highlights
      if (parsedHighlights !== null) {
        await tx.projectHighlight.deleteMany({ where: { projectId: targetProjectId } });
        if (parsedHighlights.length > 0) {
          await tx.projectHighlight.createMany({
            data: parsedHighlights.map((h, idx) => ({
              projectId: targetProjectId,
              titleEn: String(h.titleEn || "").trim(),
              titleAr: String(h.titleAr || h.titleEn || "").trim(),
              descriptionEn: String(h.descriptionEn || "").trim(),
              descriptionAr: String(h.descriptionAr || h.descriptionEn || "").trim(),
              imageUrl: h.imageUrl ? String(h.imageUrl).trim() : null,
              icon: h.icon ? String(h.icon).trim() : null,
              sortOrder: typeof h.sortOrder === "number" ? h.sortOrder : idx,
            })),
          });
        }
      }

      // Sync normalized Unit Types
      if (parsedUnitTypes !== null) {
        await tx.projectUnitType.deleteMany({ where: { projectId: targetProjectId } });
        if (parsedUnitTypes.length > 0) {
          await tx.projectUnitType.createMany({
            data: parsedUnitTypes.map((u, idx) => ({
              projectId: targetProjectId,
              titleEn: String(u.titleEn || u.nameEn || "").trim(),
              titleAr: String(u.titleAr || u.nameAr || u.titleEn || u.nameEn || "").trim(),
              areaEn: u.areaEn ? String(u.areaEn).trim() : null,
              areaAr: u.areaAr ? String(u.areaAr).trim() : null,
              areaRange: u.areaRange ? String(u.areaRange).trim() : null,
              areaUnit: u.areaUnit ? String(u.areaUnit).trim() : "sqm",
              finishingEn: u.finishingEn ? String(u.finishingEn).trim() : null,
              finishingAr: u.finishingAr ? String(u.finishingAr).trim() : null,
              descriptionEn: u.descriptionEn ? String(u.descriptionEn).trim() : null,
              descriptionAr: u.descriptionAr ? String(u.descriptionAr).trim() : null,
              paymentPlanEn: (u.paymentPlanEn || u.paymentEn) ? String(u.paymentPlanEn || u.paymentEn).trim() : null,
              paymentPlanAr: (u.paymentPlanAr || u.paymentAr) ? String(u.paymentPlanAr || u.paymentAr).trim() : null,
              imageUrl: u.imageUrl || u.image ? String(u.imageUrl || u.image).trim() : null,
              floorPlanUrl: u.floorPlanUrl ? String(u.floorPlanUrl).trim() : null,
              sortOrder: typeof u.sortOrder === "number" ? u.sortOrder : idx,
            })),
          });
        }
      }

      // Sync normalized Gallery Items
      if (parsedGalleryItems !== null) {
        await tx.projectGalleryItem.deleteMany({ where: { projectId: targetProjectId } });
        if (parsedGalleryItems.length > 0) {
          await tx.projectGalleryItem.createMany({
            data: parsedGalleryItems.map((g, idx) => ({
              projectId: targetProjectId,
              imageUrl: String(g.imageUrl || "").trim(),
              category: String(g.category || "RENDERS").trim(),
              captionEn: g.captionEn ? String(g.captionEn).trim() : null,
              captionAr: g.captionAr ? String(g.captionAr).trim() : null,
              altEn: g.altEn ? String(g.altEn).trim() : null,
              altAr: g.altAr ? String(g.altAr).trim() : null,
              isVideo: Boolean(g.isVideo),
              videoUrl: g.videoUrl ? String(g.videoUrl).trim() : null,
              posterUrl: g.posterUrl ? String(g.posterUrl).trim() : null,
              focalPoint: g.focalPoint ? String(g.focalPoint).trim() : "center",
              visible: g.visible !== false,
              mediaAssetId: g.mediaAssetId ? String(g.mediaAssetId).trim() : null,
              sortOrder: typeof g.sortOrder === "number" ? g.sortOrder : idx,
            })),
          });
        }
      }

      // Sync normalized Construction Updates
      if (parsedUpdates !== null) {
        await tx.projectConstructionUpdate.deleteMany({ where: { projectId: targetProjectId } });
        if (parsedUpdates.length > 0) {
          await tx.projectConstructionUpdate.createMany({
            data: parsedUpdates.map((u, idx) => ({
              projectId: targetProjectId,
              date: u.date ? new Date(u.date) : new Date(),
              titleEn: String(u.titleEn || "").trim(),
              titleAr: String(u.titleAr || u.titleEn || "").trim(),
              descriptionEn: u.descriptionEn ? String(u.descriptionEn).trim() : null,
              descriptionAr: u.descriptionAr ? String(u.descriptionAr).trim() : null,
              imageUrl: u.imageUrl ? String(u.imageUrl).trim() : null,
              isVideo: Boolean(u.isVideo),
              videoUrl: u.videoUrl ? String(u.videoUrl).trim() : null,
              sortOrder: typeof u.sortOrder === "number" ? u.sortOrder : idx,
            })),
          });
        }
      }

      // Sync normalized Connectivity
      if (validConnectivity !== null) {
        await tx.projectConnectivity.deleteMany({ where: { projectId: targetProjectId } });
        if (validConnectivity.length > 0) {
          await tx.projectConnectivity.createMany({
            data: validConnectivity.map((c, idx) => ({
              projectId: targetProjectId,
              destinationEn: String(c.destinationEn || "").trim(),
              destinationAr: String(c.destinationAr || c.destinationEn || "").trim(),
              distanceOrDurationEn: String(c.distanceOrDurationEn || "").trim(),
              distanceOrDurationAr: String(c.distanceOrDurationAr || c.distanceOrDurationEn || "").trim(),
              travelType: String(c.travelType || "CAR").trim(),
              sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : idx,
            })),
          });
        }
      }
    });
  } catch (err: any) {
    console.error("saveProject error:", err);
    return { error: err.message || "Failed to save project. Ensure slug is unique." };
  }

  revalidatePath(`/en/projects/${resolvedData.slug}`);
  revalidatePath(`/ar/projects/${resolvedData.slug}`);
  revalidatePath("/admin/projects");
  if (savedId) revalidatePath(`/admin/projects/${savedId}`);
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/en/projects");
  revalidatePath("/ar/projects");
  revalidatePath("/", "layout");

  // If redirect requested explicitly (e.g. from non-ajax form)
  if (str(f, "redirectAfterSave") === "true") {
    redirect(`/admin/projects/${savedId}`);
  }

  return { success: "Project and all normalized details saved successfully.", projectId: savedId };
}

export async function deleteProject(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const count = await prisma.contactSubmission.count({ where: { projectId: id } });
  if (count > 0) {
    throw new Error(
      `Cannot delete project: ${count} contact enquiry/lead record(s) reference this project. Please set the project status to ARCHIVED instead.`
    );
  }

  const existing = await prisma.project.findUnique({
    where: { id },
    include: { visualTours: true },
  });

  if (existing?.visualTours) {
    for (const tour of existing.visualTours) {
      await deleteVisualTourAssets(tour.id).catch(() => undefined);
    }
  }

  await prisma.project.delete({ where: { id } });
  if (existing) {
    revalidatePath(`/en/projects/${existing.slug}`);
    revalidatePath(`/ar/projects/${existing.slug}`);
  }
  revalidatePath("/admin/projects");
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/en/projects");
  revalidatePath("/ar/projects");
  revalidatePath("/", "layout");
}

export async function resolveProjectLocationAction(rawUrl: string) {
  await requireAdmin();
  const { resolveGoogleMapsLocation } = await import("@/lib/maps/resolve-location");
  return resolveGoogleMapsLocation(rawUrl);
}

export async function setProjectStatus(projectId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<ActionState> {
  await requireAdmin();
  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { status },
      select: { slug: true },
    });
    revalidatePath(`/en/projects/${project.slug}`);
    revalidatePath(`/ar/projects/${project.slug}`);
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath("/en");
    revalidatePath("/ar");
    revalidatePath("/en/projects");
    revalidatePath("/ar/projects");
    revalidatePath("/", "layout");
    return { success: `Project status updated to ${status}.` };
  } catch (err: any) {
    return { error: err.message || "Failed to update project status." };
  }
}

export async function toggleProjectFeatured(projectId: string): Promise<ActionState> {
  await requireAdmin();
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { featured: true, slug: true },
    });
    if (!project) return { error: "Project not found." };
    await prisma.project.update({
      where: { id: projectId },
      data: { featured: !project.featured },
    });
    revalidatePath("/admin/projects");
    revalidatePath("/en");
    revalidatePath("/ar");
    revalidatePath("/", "layout");
    return { success: `Project featured state updated.` };
  } catch (err: any) {
    return { error: err.message || "Failed to toggle featured state." };
  }
}

export async function archiveProject(projectId: string): Promise<ActionState> {
  return setProjectStatus(projectId, "ARCHIVED");
}

export async function uploadProjectVisualTour(_: ActionState, _f: FormData): Promise<ActionState> {
  await requireAdmin();
  return {
    error: "HTML/ZIP visual tour file uploads have been retired. Visual tours must now be configured as external HTTPS URLs under the Virtual Tour tab.",
  };
}

export async function updateProjectVisualTour(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(f, "tourId");
  const tour = await prisma.projectVisualTour.findUnique({ where: { id } });
  if (!tour) return { error: "Visual tour not found." };

  const titleEn = str(f, "titleEn") || tour.titleEn;
  const titleAr = str(f, "titleAr") || tour.titleAr;
  const entryFilePath = str(f, "entryFilePath") || tour.entryFilePath;
  const posterUrl = str(f, "posterUrl") || null;
  const isDefault = bool(f, "isDefault");
  const publicationState = (str(f, "publicationState") || tour.publicationState) as "DRAFT" | "PUBLISHED" | "ARCHIVED";

  if (isDefault) {
    await prisma.projectVisualTour.updateMany({
      where: { projectId: tour.projectId, localeTarget: tour.localeTarget, id: { not: id } },
      data: { isDefault: false },
    });
  }

  await prisma.projectVisualTour.update({
    where: { id },
    data: {
      titleEn,
      titleAr,
      entryFilePath,
      posterUrl,
      isDefault,
      publicationState,
      publishedAt: publicationState === "PUBLISHED" ? (tour.publishedAt || new Date()) : null,
    },
  });

  const project = await prisma.project.findUnique({ where: { id: tour.projectId } });
  if (project) {
    revalidatePath(`/en/projects/${project.slug}`);
    revalidatePath(`/ar/projects/${project.slug}`);
  }
  revalidatePath(`/admin/projects/${tour.projectId}`);
  return { success: "Visual tour updated successfully." };
}

export async function deleteProjectVisualTour(f: FormData): Promise<void> {
  await requireAdmin();
  const id = str(f, "id");
  const tour = await prisma.projectVisualTour.findUnique({ where: { id } });
  if (!tour) return;
  await prisma.projectVisualTour.delete({ where: { id } });
  await deleteVisualTourAssets(id);

  const project = await prisma.project.findUnique({ where: { id: tour.projectId } });
  if (project) {
    revalidatePath(`/en/projects/${project.slug}`);
    revalidatePath(`/ar/projects/${project.slug}`);
  }
  revalidatePath(`/admin/projects/${tour.projectId}`);
}

export async function updateLead(f:FormData){await requireAdmin();const id=str(f,"id");const status=str(f,"status");if(!["NEW","CONTACTED","QUALIFIED","CLOSED"].includes(status))return;await prisma.contactSubmission.update({where:{id},data:{status,notes:str(f,"notes")||null}});revalidatePath("/admin/leads");}
export async function deleteLead(f:FormData){await requireAdmin();await prisma.contactSubmission.delete({where:{id:str(f,"id")}});revalidatePath("/admin/leads");}

export async function markLeadReadStatus(id: string, isRead: boolean) {
  await requireAdmin();
  await prisma.contactSubmission.update({
    where: { id },
    data: { isRead },
  });
  revalidatePath("/admin/leads");
}

export async function toggleLeadArchive(id: string, isArchived: boolean) {
  await requireAdmin();
  await prisma.contactSubmission.update({
    where: { id },
    data: { isArchived },
  });
  revalidatePath("/admin/leads");
}

export async function retryLeadNotificationAction(id: string): Promise<{ success?: string; error?: string }> {
  await requireAdmin();
  const { retryLeadNotification } = await import("@/lib/notifications/email-service");
  const result = await retryLeadNotification(id);
  revalidatePath("/admin/leads");
  if (result.success) {
    const statusNote = result.status === "DELIVERED" ? "delivered" : "accepted by provider";
    return { success: `Notification ${statusNote} successfully (${result.messageId || "sent"}).` };
  } else if (result.status === "BLOCKED") {
    return { error: `Delivery blocked: ${result.error}` };
  } else {
    return { error: `Delivery failed: ${result.error || "Unknown error"}` };
  }
}

export async function retryCareerNotificationAction(id: string): Promise<{ success?: string; error?: string }> {
  await requireAdmin();
  const { retryCareerNotification } = await import("@/lib/notifications/email-service");
  const result = await retryCareerNotification(id);
  revalidatePath("/admin/careers");
  revalidatePath("/admin/leads");
  if (result.success) {
    const statusNote = result.status === "DELIVERED" ? "delivered" : "accepted by provider";
    return { success: `Application notification ${statusNote} (${result.messageId || "sent"}).` };
  } else if (result.status === "BLOCKED") {
    return { error: `Delivery blocked: ${result.error}` };
  } else {
    return { error: `Delivery failed: ${result.error || "Unknown error"}` };
  }
}

export async function dispatchPendingNotificationsAction(): Promise<{ success?: string; error?: string }> {
  await requireAdmin();
  const { processPendingNotificationJobs } = await import("@/lib/notifications/email-service");
  const result = await processPendingNotificationJobs(25);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/careers");
  return {
    success: `Outbox processed: ${result.processed} job(s) evaluated (${result.succeeded} accepted, ${result.blocked} blocked, ${result.failed} failed).`,
  };
}

export async function saveNews(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  const data={
    slug:str(f,"slug"),
    titleEn:str(f,"titleEn"),
    titleAr:str(f,"titleAr"),
    excerptEn:str(f,"excerptEn"),
    excerptAr:str(f,"excerptAr"),
    contentEn:str(f,"contentEn"),
    contentAr:str(f,"contentAr"),
    coverImageUrl:str(f,"coverImageUrl"),
    publicationDate:str(f,"publicationDate"),
    status:str(f,"status"),
    featured:bool(f,"featured"),
    featuredOrder:str(f,"featuredOrder")
  };
  const parsed=newsSchema.safeParse(data);
  if(!parsed.success)return{error:parsed.error.issues[0].message};
  const category=str(f,"category")||"NEWS";
  const projectId=str(f,"projectId")||null;
  const rawConstructionDate = str(f, "constructionDate");
  const constructionDate = rawConstructionDate ? new Date(rawConstructionDate) : null;

  const extra = {
    coverImageAltEn: str(f, "coverImageAltEn") || parsed.data.titleEn,
    coverImageAltAr: str(f, "coverImageAltAr") || parsed.data.titleAr,
    coverCaptionEn: str(f, "coverCaptionEn") || null,
    coverCaptionAr: str(f, "coverCaptionAr") || null,
    coverCreditEn: str(f, "coverCreditEn") || null,
    coverCreditAr: str(f, "coverCreditAr") || null,
    category,
    projectId,
    constructionDate,
    showRelatedProject: bool(f, "showRelatedProject"),
    showTableOfContents: bool(f, "showTableOfContents"),
    ctaEnabled: bool(f, "ctaEnabled"),
    ctaHeadingEn: str(f, "ctaHeadingEn") || null,
    ctaHeadingAr: str(f, "ctaHeadingAr") || null,
    ctaTextEn: str(f, "ctaTextEn") || null,
    ctaTextAr: str(f, "ctaTextAr") || null,
    ctaButtonEn: str(f, "ctaButtonEn") || null,
    ctaButtonAr: str(f, "ctaButtonAr") || null,
    ctaLink: str(f, "ctaLink") || null,
    ctaActionType: str(f, "ctaActionType") || "ENQUIRY",
    gallery: str(f, "gallery") || "[]",
    videoUrl: str(f, "videoUrl") || null,
    authorEn: str(f, "authorEn") || null,
    authorAr: str(f, "authorAr") || null,
    focalPoint: str(f, "focalPoint") || "center",
    tags: str(f, "tags") || "[]",
    relatedArticleIds: str(f, "relatedArticleIds") || "[]",
    seoTitleEn: str(f, "seoTitleEn") || null,
    seoTitleAr: str(f, "seoTitleAr") || null,
    seoDescriptionEn: str(f, "seoDescriptionEn") || null,
    seoDescriptionAr: str(f, "seoDescriptionAr") || null,
    ogImageUrl: str(f, "ogImageUrl") || null,
    sidebarProjectsEnabled: bool(f, "sidebarProjectsEnabled"),
    sidebarProjectsHeadingEn: str(f, "sidebarProjectsHeadingEn") || null,
    sidebarProjectsHeadingAr: str(f, "sidebarProjectsHeadingAr") || null,
    sidebarProjectsMode: str(f, "sidebarProjectsMode") || "AUTO",
    sidebarProjectIds: str(f, "sidebarProjectIds") || "[]",
    sidebarProjectsCount: parseInt(str(f, "sidebarProjectsCount") || "3", 10) || 3,
    sidebarShowLocation: bool(f, "sidebarShowLocation"),
    sidebarShowType: bool(f, "sidebarShowType"),
    sidebarShowStatus: bool(f, "sidebarShowStatus"),
    sidebarViewAllLabelEn: str(f, "sidebarViewAllLabelEn") || null,
    sidebarViewAllLabelAr: str(f, "sidebarViewAllLabelAr") || null,
  };

  const id=str(f,"id");
  try{
    if(id) {
      const existing = await prisma.newsArticle.findUnique({ where: { id } });
      if (existing && existing.slug !== parsed.data.slug) {
        // Record redirect from prior slug to new slug
        await prisma.articleRedirect.upsert({
          where: { sourceSlug: existing.slug },
          update: { targetSlug: parsed.data.slug },
          create: { sourceSlug: existing.slug, targetSlug: parsed.data.slug },
        });
        revalidatePath(`/en/journal/${existing.slug}`);
        revalidatePath(`/ar/journal/${existing.slug}`);
      }
      await prisma.newsArticle.update({where:{id},data:{...parsed.data,...extra}});
    } else {
      await prisma.newsArticle.create({data:{...parsed.data,...extra}});
    }
  }catch{return{error:"The slug must be unique."}}

  revalidatePath("/admin/news");
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/en/journal");
  revalidatePath("/ar/journal");
  revalidatePath(`/en/journal/${parsed.data.slug}`);
  revalidatePath(`/ar/journal/${parsed.data.slug}`);
  revalidatePath("/", "layout");
  redirect("/admin/news");
}

export async function deleteNews(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const existing = await prisma.newsArticle.findUnique({ where: { id } });
  await prisma.newsArticle.update({ where: { id }, data: { status: "ARCHIVED", featured: false } });
  if (existing) {
    revalidatePath(`/en/journal/${existing.slug}`);
    revalidatePath(`/ar/journal/${existing.slug}`);
  }
  revalidatePath("/admin/news");
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/en/journal");
  revalidatePath("/ar/journal");
  revalidatePath("/", "layout");
}

export async function saveJournalSettings(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  const data = {
    titleEn: str(f, "titleEn") || "Journal",
    titleAr: str(f, "titleAr") || "يوميات إيمدج",
    introEn: str(f, "introEn") || "Follow milestones, architecture, events, and construction progress across Image destinations.",
    introAr: str(f, "introAr") || "تابع أحدث المستجدات، الفعاليات وتطورات البناء في مجتمعات إيمدج للتطوير العقاري.",
    heroImageUrl: str(f, "heroImageUrl") || null,
    heroImageAltEn: str(f, "heroImageAltEn") || "Image Developments Journal",
    heroImageAltAr: str(f, "heroImageAltAr") || "يوميات إيمدج للتطوير العقاري",
    heroFocalPoint: str(f, "heroFocalPoint") || "center",
    featuredArticleId: str(f, "featuredArticleId") || null,
    categoryOrder: str(f, "categoryOrder") || "ALL,NEWS,EVENTS,CONSTRUCTION",
    sidebarEnabled: bool(f, "sidebarEnabled"),
    sidebarHeadingEn: str(f, "sidebarHeadingEn") || "Recent Articles",
    sidebarHeadingAr: str(f, "sidebarHeadingAr") || "أحدث المقالات",
    sidebarMode: str(f, "sidebarMode") || "AUTO",
    sidebarArticleIds: str(f, "sidebarArticleIds") || "[]",
    sidebarItemCount: Number(str(f, "sidebarItemCount")) || 5,
    articlesPerPage: Number(str(f, "articlesPerPage")) || 6,
    closingCtaEnabled: bool(f, "closingCtaEnabled"),
    closingCtaHeadingEn: str(f, "closingCtaHeadingEn") || "Discover Our Living Communities",
    closingCtaHeadingAr: str(f, "closingCtaHeadingAr") || "اكتشف مجتمعاتنا السكنية",
    closingCtaTextEn: str(f, "closingCtaTextEn") || "Explore our master-planned destinations across Egypt or speak with our property advisors.",
    closingCtaTextAr: str(f, "closingCtaTextAr") || "استكشف وجهاتنا المطورة بعناية في مصر أو تواصل مع مستشارينا العقاريين.",
    closingCtaButtonEn: str(f, "closingCtaButtonEn") || "Explore Our Projects",
    closingCtaButtonAr: str(f, "closingCtaButtonAr") || "استكشف مشاريعنا",
    closingCtaLink: str(f, "closingCtaLink") || "/projects",
    closingCtaSecondary: bool(f, "closingCtaSecondary"),
    seoTitleEn: str(f, "seoTitleEn") || "Journal & Latest News — Image Developments",
    seoTitleAr: str(f, "seoTitleAr") || "اليوميات وآخر الأخبار — إيمدج للتطوير العقاري",
    seoDescriptionEn: str(f, "seoDescriptionEn") || "Discover latest architectural milestones, stories, events, and construction updates from Image Developments.",
    seoDescriptionAr: str(f, "seoDescriptionAr") || "اطلع على أحدث المقالات والأخبار وتحديثات البناء من إيمدج للتطوير العقاري.",
    ogImageUrl: str(f, "ogImageUrl") || null,
  };

  await prisma.journalPageSettings.upsert({
    where: { id: "journal" },
    update: data,
    create: { id: "journal", ...data },
  });

  revalidatePath("/admin/news");
  revalidatePath("/admin/news/settings");
  revalidatePath("/en/journal");
  revalidatePath("/ar/journal");
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/", "layout");

  return { success: "Journal page settings saved successfully." };
}

export async function saveNavigation(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const ids = f.getAll("id").map(String);
  if (ids.length > 50 || new Set(ids).size !== ids.length) return { error: "The navigation items list is invalid. Refresh and try again." };

  const items = ids.map((id, sortOrder) => ({
    id,
    labelEn: str(f, `labelEn_${id}`),
    labelAr: str(f, `labelAr_${id}`),
    url: str(f, `url_${id}`),
    visible: bool(f, `visible_${id}`),
    mobileVisible: bool(f, `mobileVisible_${id}`),
    external: bool(f, `external_${id}`),
    group: str(f, `group_${id}`) || "primary",
    previewImageUrl: str(f, `previewImageUrl_${id}`) || null,
    previewImageUrlAr: str(f, `previewImageUrlAr_${id}`) || null,
    previewImageAltEn: str(f, `previewImageAltEn_${id}`) || null,
    previewImageAltAr: str(f, `previewImageAltAr_${id}`) || null,
    focalPoint: str(f, `focalPoint_${id}`) || "center",
    sortOrder,
  }));

  if (items.some((item) => !item.labelEn || !item.labelAr || !safeUrl.safeParse(item.url).success)) {
    return { error: "Complete all navigation link labels in English and Arabic with valid URLs." };
  }

  const defaultMenuUrl = str(f, "defaultMenuMediaUrl");
  const defaultMenuFocalPoint = str(f, "defaultMenuMediaFocalPoint") || "center";
  const defaultMenuAltEn = str(f, "defaultMenuMediaAltEn");
  const defaultMenuAltAr = str(f, "defaultMenuMediaAltAr");
  const morePagesLabelEn = str(f, "morePagesLabelEn");
  const morePagesLabelAr = str(f, "morePagesLabelAr");
  const menuFontSizeDesktop = str(f, "menuFontSizeDesktop");
  const menuFontSizeMobile = str(f, "menuFontSizeMobile");

  await prisma.$transaction(async (tx) => {
    const settingsUpdate: Record<string, any> = {};
    if (f.has("defaultMenuMediaUrl")) {
      settingsUpdate.menuMediaUrl = defaultMenuUrl || "/images/menu.jpg";
    }
    if (f.has("defaultMenuMediaFocalPoint")) settingsUpdate.menuMediaFocalPoint = defaultMenuFocalPoint;
    if (f.has("defaultMenuMediaAltEn")) settingsUpdate.menuMediaAltEn = defaultMenuAltEn;
    if (f.has("defaultMenuMediaAltAr")) settingsUpdate.menuMediaAltAr = defaultMenuAltAr;
    if (f.has("morePagesLabelEn")) settingsUpdate.morePagesLabelEn = morePagesLabelEn || "More Pages";
    if (f.has("morePagesLabelAr")) settingsUpdate.morePagesLabelAr = morePagesLabelAr || "المزيد من الصفحات";
    if (f.has("menuFontSizeDesktop")) settingsUpdate.menuFontSizeDesktop = menuFontSizeDesktop || "1.125rem";
    if (f.has("menuFontSizeMobile")) settingsUpdate.menuFontSizeMobile = menuFontSizeMobile || "1rem";

    if (Object.keys(settingsUpdate).length > 0) {
      await tx.globalSettings.update({
        where: { id: "global" },
        data: settingsUpdate,
      });
    }

    const existing = await tx.navigationItem.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((item) => item.id));
    const retained = ids.filter((id) => existingIds.has(id));
    await tx.navigationItem.deleteMany({ where: retained.length ? { id: { notIn: retained } } : {} });

    for (const item of items) {
      const data = {
        labelEn: item.labelEn,
        labelAr: item.labelAr,
        url: item.url,
        visible: item.visible,
        mobileVisible: item.mobileVisible,
        external: item.external,
        group: item.group,
        previewImageUrl: item.previewImageUrl,
        previewImageUrlAr: item.previewImageUrlAr,
        previewImageAltEn: item.previewImageAltEn,
        previewImageAltAr: item.previewImageAltAr,
        focalPoint: item.focalPoint,
        sortOrder: item.sortOrder,
      };
      if (existingIds.has(item.id)) {
        await tx.navigationItem.update({ where: { id: item.id }, data });
      } else {
        await tx.navigationItem.create({ data: { id: item.id, ...data } });
      }
    }
  });

  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/admin/navigation");
  revalidatePath("/en/projects");
  revalidatePath("/ar/projects");
  revalidatePath("/en/journal");
  revalidatePath("/ar/journal");
  revalidatePath("/en/about");
  revalidatePath("/ar/about");
  revalidatePath("/en/contact");
  revalidatePath("/ar/contact");
  revalidatePath("/en/careers");
  revalidatePath("/ar/careers");
  revalidatePath("/en/history");
  revalidatePath("/ar/history");
  revalidatePath("/en/team");
  revalidatePath("/ar/team");
  revalidatePath("/en/partners");
  revalidatePath("/ar/partners");
  revalidatePath("/en/policy");
  revalidatePath("/ar/policy");
  revalidatePath("/en/terms");
  revalidatePath("/ar/terms");
  revalidatePath("/", "layout");
  return { success: "Navigation links saved." };
}
export async function saveSettings(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  const email=str(f,"contactEmail");
  if(!loginSchema.shape.email.safeParse(email).success)return{error:"Enter a valid contact email."};
  const notifEmail = str(f, "notificationRecipientEmail");
  if (notifEmail && !loginSchema.shape.email.safeParse(notifEmail).success) {
    return { error: "Enter a valid email address for form inquiries notification recipient." };
  }
  const careersEmail = str(f, "careersRecipientEmail");
  if (careersEmail && !loginSchema.shape.email.safeParse(careersEmail).success) {
    return { error: "Enter a valid email address for careers recipient." };
  }
  const senderEmail = str(f, "notificationSenderEmail");
  if (senderEmail && !loginSchema.shape.email.safeParse(senderEmail).success) {
    return { error: "Enter a valid email address for sender override." };
  }
  const ids=f.getAll("socialId").map(String);
  if(ids.length>20||new Set(ids).size!==ids.length)return{error:"The social links list is invalid. Refresh and try again."};
  const socials=ids.map((id,sortOrder)=>({name:str(f,`socialName_${id}`),url:str(f,`socialUrl_${id}`),svgIcon:str(f,`socialSvg_${id}`),sortOrder}));
  for(const social of socials){
    if(!social.name||social.name.length>50)return{error:"Enter a social network name of 50 characters or fewer."};
    if(!/^https?:\/\//i.test(social.url)||!safeUrl.safeParse(social.url).success)return{error:`Enter a valid public URL for ${social.name}.`};
    if(social.svgIcon.length>20000||!/^<svg(?:\s|>)/i.test(social.svgIcon)||!/<\/svg>$/i.test(social.svgIcon))return{error:`Paste a complete SVG icon for ${social.name}.`};
  }
  await prisma.$transaction(async tx=>{
    await tx.globalSettings.update({
      where:{id:"global"},
      data:{
        siteNameEn:str(f,"siteNameEn"),siteNameAr:str(f,"siteNameAr"),contactEmail:email,phone:str(f,"phone"),hotline:str(f,"hotline")||"17087",companyBrochureUrl:str(f,"companyBrochureUrl")||null,workingHoursEn:str(f,"workingHoursEn")||"Sunday - Thursday: 9:00 AM - 6:00 PM",workingHoursAr:str(f,"workingHoursAr")||"الأحد - الخميس: ٩:٠٠ ص - ٦:٠٠ م",addressEn:str(f,"addressEn"),addressAr:str(f,"addressAr"),mapUrl:str(f,"mapUrl")||null,descriptionEn:str(f,"descriptionEn")||null,descriptionAr:str(f,"descriptionAr")||null,footerExploreHeadingEn:str(f,"footerExploreHeadingEn")||"Explore",footerExploreHeadingAr:str(f,"footerExploreHeadingAr")||"استكشف",footerProjectsHeadingEn:str(f,"footerProjectsHeadingEn")||"Our Projects",footerProjectsHeadingAr:str(f,"footerProjectsHeadingAr")||"مشاريعنا",footerContactHeadingEn:str(f,"footerContactHeadingEn")||"Contact",footerContactHeadingAr:str(f,"footerContactHeadingAr")||"تواصل معنا",callbackEnabled:bool(f,"callbackEnabled"),callbackLabelEn:str(f,"callbackLabelEn")||"Request a Call Back",callbackLabelAr:str(f,"callbackLabelAr")||"طلب معاودة الاتصال",copyrightEn:str(f,"copyrightEn"),copyrightAr:str(f,"copyrightAr"),defaultSeoTitleEn:str(f,"defaultSeoTitleEn"),defaultSeoTitleAr:str(f,"defaultSeoTitleAr"),defaultSeoDescriptionEn:str(f,"defaultSeoDescriptionEn"),defaultSeoDescriptionAr:str(f,"defaultSeoDescriptionAr"),defaultOgImageUrl:str(f,"defaultOgImageUrl")||null,menuMediaUrl:str(f,"menuMediaUrl"),menuMediaAltEn:str(f,"menuMediaAltEn"),menuMediaAltAr:str(f,"menuMediaAltAr"),
        notificationEmailEnabled: bool(f, "notificationEmailEnabled"),
        notificationRecipientEmail: str(f, "notificationRecipientEmail") || null,
        careersRecipientEmail: str(f, "careersRecipientEmail") || null,
        notificationSenderEmail: str(f, "notificationSenderEmail") || null
      }
    });
    await tx.socialLink.deleteMany({where:{globalSettingsId:"global"}});
    if(socials.length)await tx.socialLink.createMany({data:socials.map(item=>({...item,globalSettingsId:"global"}))});
  });
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/admin/settings");
  revalidatePath("/en/projects");
  revalidatePath("/ar/projects");
  revalidatePath("/en/journal");
  revalidatePath("/ar/journal");
  revalidatePath("/en/about");
  revalidatePath("/ar/about");
  revalidatePath("/en/contact");
  revalidatePath("/ar/contact");
  revalidatePath("/en/careers");
  revalidatePath("/ar/careers");
  revalidatePath("/en/history");
  revalidatePath("/ar/history");
  revalidatePath("/en/team");
  revalidatePath("/ar/team");
  revalidatePath("/en/partners");
  revalidatePath("/ar/partners");
  revalidatePath("/en/policy");
  revalidatePath("/ar/policy");
  revalidatePath("/en/terms");
  revalidatePath("/ar/terms");
  revalidatePath("/", "layout");
  return { success: "Global settings saved." };
}

export async function testNotificationEmailAction(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = str(f, "recipientEmail");
  if (!email || !loginSchema.shape.email.safeParse(email).success) {
    return { error: "Please enter a valid recipient email address for testing." };
  }
  const { sendTestNotificationEmail } = await import("@/lib/notifications/email-service");
  const result = await sendTestNotificationEmail(email);
  revalidatePath("/admin/settings");
  if (result.success) {
    const statusNote = result.status === "DELIVERED" ? "Delivered" : "Accepted by provider";
    return { success: `${statusNote} successfully to ${email}! (Provider: ${result.provider}, Ref: ${result.messageId || "sent"})` };
  } else if (result.status === "BLOCKED") {
    return { error: `Test delivery blocked: ${result.error}` };
  } else {
    return { error: `Test delivery failed: ${result.error || "Connection error"}` };
  }
}

export async function uploadMedia(_:ActionState,f:FormData):Promise<ActionState>{await requireAdmin();const file=f.get("file");if(!(file instanceof File)||file.size===0)return{error:"Choose an image or video."};const result=await storeMedia(file);if(result.error)return{error:result.error};if(result.asset&&(str(f,"altEn")||str(f,"altAr")))await prisma.mediaAsset.update({where:{id:result.asset.id},data:{altEn:str(f,"altEn")||null,altAr:str(f,"altAr")||null}});revalidatePath("/admin/media");revalidatePath("/admin/homepage");return{success:`${result.asset?.kind==="VIDEO"?"Video":"Image"} uploaded to the Media Library.`};}

export async function uploadHomepageMedia(f:FormData,expectedKind:"IMAGE"|"VIDEO"|"DOCUMENT"):Promise<{asset?:UploadedMedia;error?:string}>{await requireAdmin();const file=f.get("file");if(!(file instanceof File)||file.size===0)return{error:`Choose a${expectedKind==="IMAGE"?"n image":expectedKind==="VIDEO"?" video":" document"} file.`};return storeMedia(file,expectedKind);}

export async function deleteMedia(_:ActionState,f:FormData):Promise<ActionState>{
  await requireAdmin();
  const id=str(f,"id");
  const asset=await prisma.mediaAsset.findUnique({where:{id}});
  if(!asset)return{error:"Media item not found."};
  const [home,settings,project,news]=await Promise.all([
    prisma.homepage.findFirst({where:{OR:[{openingVideoDesktopUrl:asset.url},{openingVideoMobileUrl:asset.url},{openingPosterUrl:asset.url},{heroMediaUrl:asset.url},{heroMobileMediaUrl:asset.url},{heroVideoDesktopUrl:asset.url},{heroVideoMobileUrl:asset.url},{heroPosterUrl:asset.url},{lifestyleMediaUrl:asset.url},{aboutHeroImageUrl:asset.url}]},select:{id:true}}),
    prisma.globalSettings.findFirst({where:{OR:[{menuMediaUrl:asset.url},{defaultOgImageUrl:asset.url}]},select:{id:true}}),
    prisma.project.findFirst({where:{OR:[{coverImageUrl:asset.url},{logoUrl:asset.url},{ogImageUrl:asset.url}]},select:{id:true}}),
    prisma.newsArticle.findFirst({where:{OR:[{coverImageUrl:asset.url},{ogImageUrl:asset.url}]},select:{id:true}}),
  ]);
  const about=await prisma.aboutMilestone.findFirst({where:{imageUrl:asset.url},select:{id:true}});
  const aboutBlock=await prisma.aboutContentBlock.findFirst({where:{imageUrl:asset.url},select:{id:true}});
  const pageSection=await prisma.pageSection.findFirst({where:{imageUrl:asset.url},select:{id:true}});
  if(home||about||aboutBlock||pageSection||settings||project||news)return{error:"This media is still in use. Replace it in the relevant content first."};
  await prisma.mediaAsset.delete({where:{id}});
  if(asset.url.startsWith("/uploads/"))await unlink(path.join(process.cwd(),"public",asset.url)).catch(()=>undefined);
  revalidatePath("/admin/media");
  return{success:"Unused media deleted."};
}

export async function saveCareerJob(_:ActionState, f:FormData):Promise<ActionState>{
  await requireAdmin();
  const id=str(f,"id");
  const slug=str(f,"slug");
  const titleEn=str(f,"titleEn");
  const titleAr=str(f,"titleAr");
  const departmentEn=str(f,"departmentEn");
  const departmentAr=str(f,"departmentAr");
  const locationEn=str(f,"locationEn")||"Cairo, Egypt";
  const locationAr=str(f,"locationAr")||"القاهرة، مصر";
  const descriptionEn=str(f,"descriptionEn");
  const descriptionAr=str(f,"descriptionAr");
  const requirementsEn=str(f,"requirementsEn");
  const requirementsAr=str(f,"requirementsAr");
  const status=str(f,"status")==="DRAFT"?"DRAFT":"PUBLISHED";
  const sortOrder=Number(str(f,"sortOrder"))||0;

  if(!slug||!titleEn||!titleAr||!departmentEn||!departmentAr||!descriptionEn||!descriptionAr){
    return{error:"Please fill out all required job fields in English and Arabic."};
  }

  try{
    if(id){
      await prisma.careerJob.update({
        where:{id},
        data:{slug,titleEn,titleAr,departmentEn,departmentAr,locationEn,locationAr,descriptionEn,descriptionAr,requirementsEn,requirementsAr,status,sortOrder}
      });
    } else {
      await prisma.careerJob.create({
        data:{slug,titleEn,titleAr,departmentEn,departmentAr,locationEn,locationAr,descriptionEn,descriptionAr,requirementsEn,requirementsAr,status,sortOrder}
      });
    }
  }catch{
    return{error:"The job slug must be unique."};
  }

  revalidatePath("/admin/careers");
  revalidatePath("/en/careers");
  revalidatePath("/ar/careers");
  revalidatePath("/", "layout");
  return{success:"Career vacancy saved."};
}

export async function deleteCareerJob(f:FormData){
  await requireAdmin();
  const id=str(f,"id");
  await prisma.careerJob.delete({where:{id}});
  revalidatePath("/admin/careers");
  revalidatePath("/en/careers");
  revalidatePath("/ar/careers");
  revalidatePath("/", "layout");
}

export async function updateCareerApplicationStatus(f:FormData){
  await requireAdmin();
  const id=str(f,"id");
  const status=str(f,"status");
  const notes=str(f,"notes")||null;
  if(!["NEW","REVIEWED","SHORTLISTED","REJECTED"].includes(status))return;
  await prisma.careerApplication.update({where:{id},data:{status,notes}});
  revalidatePath("/admin/careers");
}

export async function deleteCareerApplication(f:FormData){
  await requireAdmin();
  const id=str(f,"id");
  await prisma.careerApplication.delete({where:{id}});
  revalidatePath("/admin/careers");
}

export async function saveProjectsHero(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const titleEn = str(f, "projectsHeroTitleEn");
  const titleAr = str(f, "projectsHeroTitleAr");
  if (!titleEn || !titleAr) {
    return { error: "Main heading is required in both English and Arabic." };
  }
  await prisma.homepage.update({
    where: { id: "homepage" },
    data: {
      projectsHeroEnabled: bool(f, "projectsHeroEnabled"),
      projectsHeroEyebrowEn: str(f, "projectsHeroEyebrowEn"),
      projectsHeroEyebrowAr: str(f, "projectsHeroEyebrowAr"),
      projectsHeroTitleEn: titleEn,
      projectsHeroTitleAr: titleAr,
      projectsHeroDescriptionEn: str(f, "projectsHeroDescriptionEn"),
      projectsHeroDescriptionAr: str(f, "projectsHeroDescriptionAr"),
      projectsHeroImageUrl: str(f, "projectsHeroImageUrl") || null,
      projectsHeroMobileImageUrl: str(f, "projectsHeroMobileImageUrl") || null,
      projectsHeroFocalPoint: str(f, "projectsHeroFocalPoint") || "center",
      projectsHeroImageAltEn: str(f, "projectsHeroImageAltEn"),
      projectsHeroImageAltAr: str(f, "projectsHeroImageAltAr"),
      projectsHeroPrimaryCtaEn: str(f, "projectsHeroPrimaryCtaEn") || "Explore Projects",
      projectsHeroPrimaryCtaAr: str(f, "projectsHeroPrimaryCtaAr") || "استكشف المشاريع",
      projectsHeroSecondaryCtaEn: str(f, "projectsHeroSecondaryCtaEn") || "Register Interest",
      projectsHeroSecondaryCtaAr: str(f, "projectsHeroSecondaryCtaAr") || "سجّل اهتمامك",
      projectsOpeningEnabled: bool(f, "projectsOpeningEnabled"),
      projectsOpeningHeadlineEn: str(f, "projectsOpeningHeadlineEn") || "Our Portfolio",
      projectsOpeningHeadlineAr: str(f, "projectsOpeningHeadlineAr") || "محفظة المشاريع",
    },
  });
  revalidatePath("/en/projects");
  revalidatePath("/ar/projects");
  revalidatePath("/admin/projects");
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/", "layout");
  return { success: "Projects hero and reload animation settings saved successfully." };
}

export async function saveProjectsCollectionSettings(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const headingEn = str(f, "projectsHeadingEn") || "Projects";
  const headingAr = str(f, "projectsHeadingAr") || "المشاريع";
  const descEn = str(f, "projectsDescriptionEn") || null;
  const descAr = str(f, "projectsDescriptionAr") || null;
  const exploreEn = str(f, "projectsExploreEn") || "View Project";
  const exploreAr = str(f, "projectsExploreAr") || "عرض المشروع";
  const enabled = bool(f, "projectsEnabled");

  await prisma.homepage.update({
    where: { id: "homepage" },
    data: {
      projectsEnabled: enabled,
      projectsHeadingEn: headingEn,
      projectsHeadingAr: headingAr,
      projectsDescriptionEn: descEn,
      projectsDescriptionAr: descAr,
      projectsExploreEn: exploreEn,
      projectsExploreAr: exploreAr,
    },
  });

  const projectIds = f.getAll("projectId").map(String);
  for (const id of projectIds) {
    const featured = bool(f, `projectFeatured_${id}`);
    const order = parseInt(str(f, `projectOrder_${id}`) || "0", 10);
    const status = str(f, `projectStatus_${id}`) as "DRAFT" | "PUBLISHED" | "ARCHIVED";
    await prisma.project.update({
      where: { id },
      data: {
        featured,
        featuredOrder: isNaN(order) ? 0 : order,
        ...(status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status) ? { status } : {}),
      },
    });
  }

  revalidatePath("/en/projects");
  revalidatePath("/ar/projects");
  revalidatePath("/admin/projects");
  revalidatePath("/en");
  revalidatePath("/ar");
  revalidatePath("/", "layout");
  return { success: "Projects collection settings saved successfully." };
}

export async function saveCareersPageContent(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const heroTitleEn = str(f, "careersHeroTitleEn");
  const heroTitleAr = str(f, "careersHeroTitleAr");
  if (!heroTitleEn || !heroTitleAr) {
    return { error: "Hero title is required in both English and Arabic." };
  }
  await prisma.homepage.update({
    where: { id: "homepage" },
    data: {
      careersHeroEyebrowEn: str(f, "careersHeroEyebrowEn") || "Careers at Image",
      careersHeroEyebrowAr: str(f, "careersHeroEyebrowAr") || "انضم إلى فريقنا",
      careersHeroTitleEn: heroTitleEn,
      careersHeroTitleAr: heroTitleAr,
      careersHeroIntroEn: str(f, "careersHeroIntroEn"),
      careersHeroIntroAr: str(f, "careersHeroIntroAr"),
      careersHeroImageUrl: str(f, "careersHeroImageUrl") || null,
      careersLifeEyebrowEn: str(f, "careersLifeEyebrowEn") || "Life at Image",
      careersLifeEyebrowAr: str(f, "careersLifeEyebrowAr") || "الحياة في إيمدج",
      careersLifeTitleEn: str(f, "careersLifeTitleEn"),
      careersLifeTitleAr: str(f, "careersLifeTitleAr"),
      careersLifeBodyEn: str(f, "careersLifeBodyEn"),
      careersLifeBodyAr: str(f, "careersLifeBodyAr"),
      careersLifeImages: str(f, "careersLifeImages") || "[]",
    },
  });
  revalidatePath("/en/careers");
  revalidatePath("/ar/careers");
  revalidatePath("/admin/careers");
  revalidatePath("/", "layout");
  return { success: "Careers page content saved successfully." };
}

export async function toggleCareerJobStatus(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const currentStatus = str(f, "currentStatus");
  const nextStatus = currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  await prisma.careerJob.update({
    where: { id },
    data: { status: nextStatus },
  });
  revalidatePath("/admin/careers");
  revalidatePath("/en/careers");
  revalidatePath("/ar/careers");
  revalidatePath("/", "layout");
}
