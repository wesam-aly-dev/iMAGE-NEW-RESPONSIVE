import {describe,expect,it} from "vitest";
import {loginSchema,newsSchema,projectSchema,safeUrl,sectionOrderSchema} from "./validation";

describe("admin validation",()=>{
  it("accepts a valid login and rejects weak input",()=>{expect(loginSchema.safeParse({email:"admin@example.com",password:"long-password"}).success).toBe(true);expect(loginSchema.safeParse({email:"bad",password:"short"}).success).toBe(false)});
  it("persists bilingual project-shaped content",()=>{expect(projectSchema.parse({slug:"new-cairo",nameEn:"Aera",nameAr:"إيرا",shortDescriptionEn:"A place",shortDescriptionAr:"مكان",locationEn:"Cairo",locationAr:"القاهرة",coverImageUrl:"/uploads/a.jpg",status:"PUBLISHED",featured:true,featuredOrder:"0"}).nameAr).toBe("إيرا")});
  it("rejects invalid slugs and enum values",()=>{expect(projectSchema.safeParse({slug:"Bad Slug",status:"LIVE"}).success).toBe(false)});
  it("formats human-readable slugs for CMS entries",()=>{const result=projectSchema.parse({slug:"New Cairo & Gardens!",nameEn:"Aera",nameAr:"إيرا",shortDescriptionEn:"A place",shortDescriptionAr:"مكان",locationEn:"Cairo",locationAr:"القاهرة",coverImageUrl:"/uploads/a.jpg",status:"DRAFT",featured:false,featuredOrder:0});expect(result.slug).toBe("new-cairo-and-gardens")});
  it("validates complete bilingual news content",()=>{expect(newsSchema.safeParse({slug:"studio-story",titleEn:"Story",titleAr:"قصة",excerptEn:"Excerpt",excerptAr:"مقتطف",contentEn:"Body",contentAr:"نص",coverImageUrl:"/image.jpg",publicationDate:"2026-10-04",status:"DRAFT",featured:false,featuredOrder:0}).success).toBe(true)});
  it("allows safe internal, anchor and absolute links",()=>{expect(safeUrl.safeParse("#contact").success).toBe(true);expect(safeUrl.safeParse("/en").success).toBe(true);expect(safeUrl.safeParse("https://example.com").success).toBe(true);expect(safeUrl.safeParse("javascript:alert(1)").success).toBe(false)});
  it("only accepts every controlled homepage section once",()=>{expect(sectionOrderSchema.safeParse(["projects","lifestyle","stats","journal","closing"]).success).toBe(true);expect(sectionOrderSchema.safeParse(["projects","projects","stats","journal","closing"]).success).toBe(false)});

  it("handles featuredOrder with -1 sentinel and positive values, rejecting < -1", () => {
    const base = {
      slug: "test-proj",
      nameEn: "Project",
      nameAr: "مشروع",
      shortDescriptionEn: "Desc",
      shortDescriptionAr: "وصف",
      locationEn: "Cairo",
      locationAr: "القاهرة",
      coverImageUrl: "/img.jpg",
      status: "PUBLISHED",
      featured: true,
    };
    // 0 is valid
    expect(projectSchema.safeParse({ ...base, featuredOrder: 0 }).success).toBe(true);
    // 5 is valid
    expect(projectSchema.safeParse({ ...base, featuredOrder: 5 }).success).toBe(true);
    // -1 sentinel is valid
    expect(projectSchema.safeParse({ ...base, featuredOrder: -1 }).success).toBe(true);
    // empty string coerced to 0 is valid
    expect(projectSchema.safeParse({ ...base, featuredOrder: "" }).success).toBe(true);
    // < -1 is rejected
    const resNegative = projectSchema.safeParse({ ...base, featuredOrder: -2 });
    expect(resNegative.success).toBe(false);
    if (!resNegative.success) {
      expect(resNegative.error.issues[0].message).toContain("Featured order must be 0 or greater (or -1 for unranked)");
    }
  });

  it("applies domain validation to geographic coordinates", () => {
    const base = {
      slug: "coords-proj",
      nameEn: "Project",
      nameAr: "مشروع",
      shortDescriptionEn: "Desc",
      shortDescriptionAr: "وصف",
      locationEn: "Cairo",
      locationAr: "القاهرة",
      coverImageUrl: "/img.jpg",
      status: "PUBLISHED",
      featured: false,
      featuredOrder: 0,
    };

    // Valid positive coordinates
    expect(projectSchema.safeParse({ ...base, latitude: 30.0131, longitude: 31.4913 }).success).toBe(true);

    // Valid negative coordinates (Southern/Western hemispheres)
    expect(projectSchema.safeParse({ ...base, latitude: -33.8688, longitude: 151.2093 }).success).toBe(true);
    expect(projectSchema.safeParse({ ...base, latitude: 40.7128, longitude: -74.0060 }).success).toBe(true);

    // Zero coordinates (valid)
    expect(projectSchema.safeParse({ ...base, latitude: 0, longitude: 0 }).success).toBe(true);

    // Both coordinates absent/null is valid
    expect(projectSchema.safeParse({ ...base, latitude: null, longitude: null }).success).toBe(true);

    // Incomplete pair (latitude without longitude)
    const resOnlyLat = projectSchema.safeParse({ ...base, latitude: 30.0131, longitude: null });
    expect(resOnlyLat.success).toBe(false);
    if (!resOnlyLat.success) {
      expect(resOnlyLat.error.issues[0].message).toContain("Please provide both latitude and longitude");
    }

    // Incomplete pair (longitude without latitude)
    const resOnlyLng = projectSchema.safeParse({ ...base, latitude: "", longitude: 31.4913 });
    expect(resOnlyLng.success).toBe(false);
    if (!resOnlyLng.success) {
      expect(resOnlyLng.error.issues[0].message).toContain("Please provide both latitude and longitude");
    }

    // Latitude out of bounds (> 90)
    const resLatOOB = projectSchema.safeParse({ ...base, latitude: 91.5, longitude: 31.4 });
    expect(resLatOOB.success).toBe(false);

    // Longitude out of bounds (> 180)
    const resLngOOB = projectSchema.safeParse({ ...base, latitude: 30.0, longitude: 185.0 });
    expect(resLngOOB.success).toBe(false);
  });
});
