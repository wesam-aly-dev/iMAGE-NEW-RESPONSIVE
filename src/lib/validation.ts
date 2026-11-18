import { z } from "zod";

export const contentSlugSchema = z.string().trim().transform(value=>value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"")
  .toLowerCase()
  .replace(/&/g," and ")
  .replace(/[^a-z0-9]+/g,"-")
  .replace(/^-+|-+$/g,"")
  .replace(/-+/g,"-"))
  .pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"Enter a name using at least one English letter or number. The URL slug will be formatted automatically."));

export const usernameSchema = z.string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must not exceed 30 characters.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, hyphens, and underscores.");

export const updateUsernameSchema = z.object({
  newUsername: usernameSchema,
  currentPassword: z.string().min(1, "Enter your current password to confirm the change."),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Confirm your new password."),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New password and confirmation do not match.",
  path: ["confirmPassword"],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password.",
  path: ["newPassword"],
});

export const emailSchema = z.string().trim().email("Enter a valid email address.");

export const loginSchema = Object.assign(
  z.object({
    email: emailSchema.optional(),
    identifier: z.string().trim().optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
  }).superRefine((data, ctx) => {
    const raw = (data.identifier || data.email || "").trim();
    if (!raw || raw.length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter your username or email.", path: ["identifier"] });
      return;
    }
    if (raw.includes("@")) {
      const res = emailSchema.safeParse(raw);
      if (!res.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email address.", path: ["identifier"] });
      }
    } else {
      const res = usernameSchema.safeParse(raw);
      if (!res.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Username must be between 3 and 30 characters using letters, numbers, hyphens, or underscores.", path: ["identifier"] });
      }
    }
  }).transform(data => {
    const raw = (data.identifier || data.email || "").trim().toLowerCase();
    return {
      identifier: raw,
      email: raw,
      password: data.password,
    };
  }),
  {
    shape: {
      email: emailSchema,
      password: z.string().min(8),
    },
  }
);
export const coordinateLatitudeSchema = z.union([
  z.number().min(-90, "Latitude must be between -90 and 90.").max(90, "Latitude must be between -90 and 90."),
  z.string().trim().refine((val) => {
    if (!val) return true;
    const num = Number(val);
    return !isNaN(num) && num >= -90 && num <= 90;
  }, "Latitude must be a valid number between -90 and 90."),
  z.null(),
  z.undefined(),
]);

export const coordinateLongitudeSchema = z.union([
  z.number().min(-180, "Longitude must be between -180 and 180.").max(180, "Longitude must be between -180 and 180."),
  z.string().trim().refine((val) => {
    if (!val) return true;
    const num = Number(val);
    return !isNaN(num) && num >= -180 && num <= 180;
  }, "Longitude must be a valid number between -180 and 180."),
  z.null(),
  z.undefined(),
]);

export const projectSchema = z
  .object({
    slug: contentSlugSchema,
    nameEn: z.string().trim().min(1, "English name is required."),
    nameAr: z.string().trim().min(1, "Arabic name is required."),
    shortDescriptionEn: z.string().trim().min(1, "English short description is required."),
    shortDescriptionAr: z.string().trim().min(1, "Arabic short description is required."),
    locationEn: z.string().trim().min(1, "English location is required."),
    locationAr: z.string().trim().min(1, "Arabic location is required."),
    coverImageUrl: z.string().trim().min(1, "Cover image is required."),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    featuredOrder: z.coerce.number().int("Featured order must be an integer.").min(-1, "Featured order must be 0 or greater (or -1 for unranked)."),
    featured: z.boolean(),
    latitude: coordinateLatitudeSchema.optional(),
    longitude: coordinateLongitudeSchema.optional(),
    mapUrl: z.string().trim().optional().nullable(),
    directionsUrl: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.latitude !== undefined && data.latitude !== null && data.latitude !== "";
    const hasLng = data.longitude !== undefined && data.longitude !== null && data.longitude !== "";
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please provide both latitude and longitude coordinates, or leave both empty.",
        path: [hasLat ? "longitude" : "latitude"],
      });
    }
  });

export const newsSchema = z.object({
  slug: contentSlugSchema,
  titleEn: z.string().trim().min(1),
  titleAr: z.string().trim().min(1),
  excerptEn: z.string().trim().min(1),
  excerptAr: z.string().trim().min(1),
  contentEn: z.string().trim().min(1),
  contentAr: z.string().trim().min(1),
  coverImageUrl: z.string().trim().min(1),
  publicationDate: z.coerce.date(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  featured: z.boolean(),
  featuredOrder: z.coerce.number().int("Featured order must be an integer.").min(-1, "Featured order must be 0 or greater (or -1 for unranked)."),
});
export const safeUrl = z.string().refine(v => v.startsWith("#") || v.startsWith("/") || /^https?:\/\//i.test(v) || /^mailto:/i.test(v) || /^tel:/i.test(v), "Enter an anchor, internal path, or safe full URL");
export const sectionOrderSchema = z.array(z.enum(["projects","lifestyle","stats","journal","closing"])).length(5).refine(v=>new Set(v).size===5,"Each homepage section must appear exactly once");
