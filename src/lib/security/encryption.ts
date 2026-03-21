import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { AppError } from "@/lib/api/route-handler";
import { env } from "@/lib/config/env";

function resolveKeyMaterial() {
  if (!env.APP_ENCRYPTION_KEY) {
    throw new AppError("APP_ENCRYPTION_KEY is required for credential storage.", {
      statusCode: 500,
      code: "APP_ENCRYPTION_KEY_MISSING",
    });
  }

  if (/^[0-9a-fA-F]{64}$/.test(env.APP_ENCRYPTION_KEY)) {
    return Buffer.from(env.APP_ENCRYPTION_KEY, "hex");
  }

  try {
    const base64Key = Buffer.from(env.APP_ENCRYPTION_KEY, "base64");
    if (base64Key.length === 32) {
      return base64Key;
    }
  } catch {
    // Ignore invalid base64 and fall through to a deterministic hash.
  }

  return createHash("sha256").update(env.APP_ENCRYPTION_KEY).digest();
}

export function encryptSecret(secret: string) {
  const key = resolveKeyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string) {
  const [ivPart, tagPart, contentPart] = payload.split(".");

  if (!ivPart || !tagPart || !contentPart) {
    throw new AppError("Stored secret payload is invalid.", {
      statusCode: 500,
      code: "INVALID_SECRET_PAYLOAD",
    });
  }

  const key = resolveKeyMaterial();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(contentPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskSecret(secret: string) {
  const trimmed = secret.trim();

  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}${"*".repeat(Math.max(trimmed.length - 4, 0))}${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}${"*".repeat(Math.max(trimmed.length - 8, 8))}${trimmed.slice(-4)}`;
}
