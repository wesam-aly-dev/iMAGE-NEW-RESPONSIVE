import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for AES-GCM

function getDerivedKey(): Buffer {
  const secret =
    process.env.SMTP_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    "image-developments-secure-smtp-fallback-secret-2026";
  return crypto.createHash("sha256").update(secret).digest();
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt a plaintext string using AES-256-GCM authenticated encryption.
 * The authentication tag prevents tampering.
 */
export function encryptCredential(plaintext: string): EncryptedPayload {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty credential.");
  }
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag().toString("base64");

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag,
  };
}

/**
 * Decrypt an AES-256-GCM ciphertext payload and verify its authentication tag.
 * Returns null if tampering occurs or credentials are invalid.
 */
export function decryptCredential(payload: {
  ciphertext: string | null | undefined;
  iv: string | null | undefined;
  tag: string | null | undefined;
}): string | null {
  if (!payload.ciphertext || !payload.iv || !payload.tag) {
    return null;
  }

  try {
    const key = getDerivedKey();
    const iv = Buffer.from(payload.iv, "base64");
    const tag = Buffer.from(payload.tag, "base64");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err: unknown) {
    console.error("Warning: Failed to decrypt credential (authentication tag mismatch or corrupted ciphertext).");
    return null;
  }
}

