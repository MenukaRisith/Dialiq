import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const normalized = password.trim();

  if (normalized.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(normalized, salt, KEY_LENGTH).toString("base64url");

  return `${HASH_PREFIX}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split(":");

  if (prefix !== HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password.trim(), salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "base64url");

  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}
