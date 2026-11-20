import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only and next dependencies
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(),
  getAdminSession: vi.fn(),
}));

import { prisma } from "./prisma";
import { encryptCredential, decryptCredential } from "./crypto";
import { resolveActiveSmtpConfig, getResolvedNotificationSettings } from "./notifications/email-service";
import { saveHomepage, saveSettings, testSmtpConnectionAction } from "@/app/admin/actions";
import { getHomepageContentUncached } from "./content";

describe("Opening Animation Media Slots & CMS-Managed Email Configuration Suite", () => {
  beforeEach(async () => {
    // Reset test state if needed
  });

  describe("A. AES-256-GCM Credential Encryption & Security", () => {
    it("encrypts plaintext credentials with authenticated tag and decrypts accurately", () => {
      const plaintext = "SuperSecretSmtpPass!2026#";
      const encrypted = encryptCredential(plaintext);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.ciphertext).not.toBe(plaintext);

      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("detects tampered ciphertext or corrupted tag and returns null without throwing", () => {
      const encrypted = encryptCredential("MyPassword123");
      // Tamper ciphertext
      const tampered = {
        ciphertext: Buffer.from("CorruptedData").toString("base64"),
        iv: encrypted.iv,
        tag: encrypted.tag,
      };

      const result = decryptCredential(tampered);
      expect(result).toBeNull();
    });

    it("returns null safely when given empty or missing inputs", () => {
      expect(decryptCredential({ ciphertext: null, iv: null, tag: null })).toBeNull();
      expect(decryptCredential({ ciphertext: "", iv: "", tag: "" })).toBeNull();
    });
  });

  describe("B. CMS-Managed SMTP Settings Persistence & Password Preservation", () => {
    it("saves CMS SMTP connection configuration and securely encrypts password", async () => {
      const initialSettings = await prisma.globalSettings.findUniqueOrThrow({ where: { id: "global" } });

      const fd = new FormData();
      fd.set("siteNameEn", initialSettings.siteNameEn);
      fd.set("siteNameAr", initialSettings.siteNameAr);
      fd.set("contactEmail", initialSettings.contactEmail);
      fd.set("phone", initialSettings.phone);
      fd.set("addressEn", initialSettings.addressEn);
      fd.set("addressAr", initialSettings.addressAr);
      fd.set("copyrightEn", initialSettings.copyrightEn);
      fd.set("copyrightAr", initialSettings.copyrightAr);
      fd.set("defaultSeoTitleEn", initialSettings.defaultSeoTitleEn);
      fd.set("defaultSeoTitleAr", initialSettings.defaultSeoTitleAr);
      fd.set("defaultSeoDescriptionEn", initialSettings.defaultSeoDescriptionEn);
      fd.set("defaultSeoDescriptionAr", initialSettings.defaultSeoDescriptionAr);
      fd.set("menuMediaUrl", initialSettings.menuMediaUrl);
      fd.set("menuMediaAltEn", initialSettings.menuMediaAltEn);
      fd.set("menuMediaAltAr", initialSettings.menuMediaAltAr);

      // CMS Email & Notifications fields
      fd.set("notificationRecipientEmail", "awessam311@gmail.com");
      fd.set("additionalRecipients", "info@image-developments.com, sales@image-developments.com");
      fd.set("notificationSenderName", "Image Developments Official");
      fd.set("notificationSenderEmail", "info@image-developments.com");
      fd.set("smtpActiveSource", "CMS");
      fd.set("smtpHost", "image-developments.com");
      fd.set("smtpPort", "465");
      fd.set("smtpEncryption", "SSL");
      fd.set("smtpUser", "info@image-developments.com");
      fd.set("smtpPassword", "CompanySmtpSecret2026!");

      const saveRes = await saveSettings({}, fd);
      expect(saveRes.success).toBe("Global settings saved.");

      const updated = await prisma.globalSettings.findUniqueOrThrow({ where: { id: "global" } });
      expect(updated.notificationRecipientEmail).toBe("awessam311@gmail.com");
      expect(updated.additionalRecipients).toBe("info@image-developments.com, sales@image-developments.com");
      expect(updated.smtpActiveSource).toBe("CMS");
      expect(updated.smtpHost).toBe("image-developments.com");
      expect(updated.smtpPort).toBe(465);
      expect(updated.smtpEncryption).toBe("SSL");
      expect(updated.smtpUser).toBe("info@image-developments.com");
      expect(updated.smtpPasswordEncrypted).toBeDefined();
      expect(updated.smtpPasswordEncrypted).not.toBe("CompanySmtpSecret2026!");

      // Verify decrypted password matches
      const decrypted = decryptCredential({
        ciphertext: updated.smtpPasswordEncrypted,
        iv: updated.smtpPasswordIv,
        tag: updated.smtpPasswordTag,
      });
      expect(decrypted).toBe("CompanySmtpSecret2026!");
    });

    it("preserves existing encrypted password when user leaves password field blank on edit", async () => {
      const before = await prisma.globalSettings.findUniqueOrThrow({ where: { id: "global" } });
      expect(before.smtpPasswordEncrypted).toBeDefined();

      const fd = new FormData();
      fd.set("siteNameEn", before.siteNameEn);
      fd.set("siteNameAr", before.siteNameAr);
      fd.set("contactEmail", before.contactEmail);
      fd.set("phone", before.phone);
      fd.set("addressEn", before.addressEn);
      fd.set("addressAr", before.addressAr);
      fd.set("copyrightEn", before.copyrightEn);
      fd.set("copyrightAr", before.copyrightAr);
      fd.set("defaultSeoTitleEn", before.defaultSeoTitleEn);
      fd.set("defaultSeoTitleAr", before.defaultSeoTitleAr);
      fd.set("defaultSeoDescriptionEn", before.defaultSeoDescriptionEn);
      fd.set("defaultSeoDescriptionAr", before.defaultSeoDescriptionAr);
      fd.set("menuMediaUrl", before.menuMediaUrl);
      fd.set("menuMediaAltEn", before.menuMediaAltEn);
      fd.set("menuMediaAltAr", before.menuMediaAltAr);

      // Edit recipient and leave password blank
      fd.set("notificationRecipientEmail", "awessam311@gmail.com");
      fd.set("additionalRecipients", "info@image-developments.com, sales@image-developments.com");
      fd.set("smtpActiveSource", "CMS");
      fd.set("smtpHost", "image-developments.com");
      fd.set("smtpPort", "465");
      fd.set("smtpEncryption", "SSL");
      fd.set("smtpUser", "info@image-developments.com");
      fd.set("smtpPassword", ""); // Blank on edit!

      const saveRes = await saveSettings({}, fd);
      expect(saveRes.success).toBe("Global settings saved.");

      const after = await prisma.globalSettings.findUniqueOrThrow({ where: { id: "global" } });
      // Password must remain preserved!
      expect(after.smtpPasswordEncrypted).toBe(before.smtpPasswordEncrypted);
      expect(after.smtpPasswordIv).toBe(before.smtpPasswordIv);
      expect(after.smtpPasswordTag).toBe(before.smtpPasswordTag);

      const decrypted = decryptCredential({
        ciphertext: after.smtpPasswordEncrypted,
        iv: after.smtpPasswordIv,
        tag: after.smtpPasswordTag,
      });
      expect(decrypted).toBe("CompanySmtpSecret2026!");
    });

    it("resolves active SMTP configuration from CMS when source is CMS", async () => {
      const resolved = await resolveActiveSmtpConfig();
      expect(resolved).not.toBeNull();
      expect(resolved!.host).toBe("image-developments.com");
      expect(resolved!.port).toBe(465);
      expect(resolved!.secure).toBe(true);
      expect(resolved!.user).toBe("info@image-developments.com");
      expect(resolved!.pass).toBe("CompanySmtpSecret2026!");
      expect(resolved!.from).toContain("info@image-developments.com");
    });

    it("parses additional recipients list accurately in getResolvedNotificationSettings", async () => {
      const meta = await getResolvedNotificationSettings();
      expect(meta.recipientEmail).toBe("awessam311@gmail.com");
      expect(meta.additionalRecipients).toContain("info@image-developments.com");
      expect(meta.additionalRecipients).toContain("sales@image-developments.com");
      expect(meta.hasSmtpPassword).toBe(true);
      expect(meta.smtpConfigured).toBe(true);
      expect(meta.isConfigured).toBe(true);
    });

    it("rejects invalid SMTP port numbers outside 1-65535", async () => {
      const s = await prisma.globalSettings.findUniqueOrThrow({ where: { id: "global" } });
      const fd = new FormData();
      fd.set("siteNameEn", s.siteNameEn);
      fd.set("siteNameAr", s.siteNameAr);
      fd.set("contactEmail", s.contactEmail);
      fd.set("phone", s.phone);
      fd.set("addressEn", s.addressEn);
      fd.set("addressAr", s.addressAr);
      fd.set("copyrightEn", s.copyrightEn);
      fd.set("copyrightAr", s.copyrightAr);
      fd.set("defaultSeoTitleEn", s.defaultSeoTitleEn);
      fd.set("defaultSeoTitleAr", s.defaultSeoTitleAr);
      fd.set("defaultSeoDescriptionEn", s.defaultSeoDescriptionEn);
      fd.set("defaultSeoDescriptionAr", s.defaultSeoDescriptionAr);
      fd.set("menuMediaUrl", s.menuMediaUrl);
      fd.set("menuMediaAltEn", s.menuMediaAltEn);
      fd.set("menuMediaAltAr", s.menuMediaAltAr);

      fd.set("smtpPort", "99999"); // Invalid!
      const res = await saveSettings({}, fd);
      expect(res.error).toContain("Enter a valid SMTP port number between 1 and 65535");
    });
  });

  describe("C. Opening Experience Media Slots & Mobile Animation", () => {
    it("saves all 5 opening montage slots with distinct desktop and mobile images", async () => {
      const h = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });

      const fd = new FormData();
      fd.set("openingEnabled", "on");
      fd.set("openingHeadlineEn", "A New Perspective");
      fd.set("openingHeadlineAr", "منظور جديد");
      fd.set("openingPosterUrl", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200");
      fd.set("openingMobilePosterUrl", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600");

      // Slot 1 (Outer Left)
      fd.set("openingSlot1ImageUrl", "https://images.unsplash.com/photo-slot1-desk?w=800");
      fd.set("openingSlot1MobileImageUrl", "https://images.unsplash.com/photo-slot1-mob?w=400");
      fd.set("openingSlot1AltEn", "Slot 1 Architectural Detail EN");
      fd.set("openingSlot1AltAr", "تفاصيل معمارية للوحة الأولى");

      // Slot 2 (Inner Left)
      fd.set("openingSlot2ImageUrl", "https://images.unsplash.com/photo-slot2-desk?w=800");
      fd.set("openingSlot2MobileImageUrl", "https://images.unsplash.com/photo-slot2-mob?w=400");
      fd.set("openingSlot2AltEn", "Slot 2 Landscape EN");
      fd.set("openingSlot2AltAr", "طبيعة خلابة للوحة الثانية");

      // Slot 3 (Center Hero)
      fd.set("openingSlot3ImageUrl", "https://images.unsplash.com/photo-slot3-desk?w=1600");
      fd.set("openingSlot3MobileImageUrl", "https://images.unsplash.com/photo-slot3-mob?w=800");
      fd.set("openingSlot3AltEn", "Slot 3 Central Hero EN");
      fd.set("openingSlot3AltAr", "اللوحة الرئيسية المركزية");

      // Slot 4 (Inner Right)
      fd.set("openingSlot4ImageUrl", "https://images.unsplash.com/photo-slot4-desk?w=800");
      fd.set("openingSlot4MobileImageUrl", "https://images.unsplash.com/photo-slot4-mob?w=400");
      fd.set("openingSlot4AltEn", "Slot 4 Interior EN");
      fd.set("openingSlot4AltAr", "المساحات الداخلية للوحة الرابعة");

      // Slot 5 (Outer Right)
      fd.set("openingSlot5ImageUrl", "https://images.unsplash.com/photo-slot5-desk?w=800");
      fd.set("openingSlot5MobileImageUrl", "https://images.unsplash.com/photo-slot5-mob?w=400");
      fd.set("openingSlot5AltEn", "Slot 5 Facade EN");
      fd.set("openingSlot5AltAr", "واجهة معمارية للوحة الخامسة");

      // Fill required hero fields
      fd.set("heroEyebrowEn", h.heroEyebrowEn);
      fd.set("heroEyebrowAr", h.heroEyebrowAr);
      fd.set("heroTitleEn", h.heroTitleEn);
      fd.set("heroTitleAr", h.heroTitleAr);
      fd.set("heroNoteEn", h.heroNoteEn);
      fd.set("heroNoteAr", h.heroNoteAr);
      fd.set("heroDiscoverEn", h.heroDiscoverEn);
      fd.set("heroDiscoverAr", h.heroDiscoverAr);
      fd.set("heroMediaUrl", h.heroMediaUrl);
      fd.set("heroMediaAltEn", h.heroMediaAltEn);
      fd.set("heroMediaAltAr", h.heroMediaAltAr);

      const saveRes = await saveHomepage({}, fd);
      expect(saveRes.success).toBe("Homepage saved.");

      const updated = await prisma.homepage.findUniqueOrThrow({ where: { id: "homepage" } });
      expect(updated.openingMobilePosterUrl).toBe("https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600");
      expect(updated.openingSlot1ImageUrl).toBe("https://images.unsplash.com/photo-slot1-desk?w=800");
      expect(updated.openingSlot1MobileImageUrl).toBe("https://images.unsplash.com/photo-slot1-mob?w=400");
      expect(updated.openingSlot1AltEn).toBe("Slot 1 Architectural Detail EN");
      expect(updated.openingSlot3ImageUrl).toBe("https://images.unsplash.com/photo-slot3-desk?w=1600");
      expect(updated.openingSlot3MobileImageUrl).toBe("https://images.unsplash.com/photo-slot3-mob?w=800");
    });

    it("loads configured opening slots into HomeContent for public renderer", async () => {
      const contentEn = await getHomepageContentUncached("en");
      expect(contentEn.opening).toBeDefined();
      expect(contentEn.opening?.mobilePoster).toBe("https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600");
      expect(contentEn.opening?.slots).toBeDefined();
      expect(contentEn.opening?.slots?.length).toBe(5);

      // Slot 1
      expect(contentEn.opening?.slots?.[0].imageUrl).toBe("https://images.unsplash.com/photo-slot1-desk?w=800");
      expect(contentEn.opening?.slots?.[0].mobileImageUrl).toBe("https://images.unsplash.com/photo-slot1-mob?w=400");
      expect(contentEn.opening?.slots?.[0].alt).toBe("Slot 1 Architectural Detail EN");

      // Slot 3 (Center)
      expect(contentEn.opening?.slots?.[2].imageUrl).toBe("https://images.unsplash.com/photo-slot3-desk?w=1600");
      expect(contentEn.opening?.slots?.[2].mobileImageUrl).toBe("https://images.unsplash.com/photo-slot3-mob?w=800");
      expect(contentEn.opening?.slots?.[2].alt).toBe("Slot 3 Central Hero EN");

      // Arabic localization
      const contentAr = await getHomepageContentUncached("ar");
      expect(contentAr.opening?.slots?.[0].alt).toBe("تفاصيل معمارية للوحة الأولى");
    });

    it("falls back to desktop asset when mobile asset is not configured for a slot", async () => {
      // Clear mobile override for slot 1
      await prisma.homepage.update({
        where: { id: "homepage" },
        data: {
          openingSlot1MobileImageUrl: null,
        },
      });

      const content = await getHomepageContentUncached("en");
      expect(content.opening?.slots?.[0].imageUrl).toBe("https://images.unsplash.com/photo-slot1-desk?w=800");
      expect(content.opening?.slots?.[0].mobileImageUrl).toBeNull();
    });
  });
});
