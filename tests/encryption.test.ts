import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("credential encryption", () => {
  it("encrypts and decrypts provider secrets with the configured app key", async () => {
    vi.stubEnv(
      "APP_ENCRYPTION_KEY",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    const { decryptSecret, encryptSecret, maskSecret } = await import(
      "@/lib/security/encryption"
    );

    const encrypted = encryptSecret("or-v1-secret-123456");

    expect(encrypted).not.toContain("secret-123456");
    expect(decryptSecret(encrypted)).toBe("or-v1-secret-123456");
    expect(maskSecret("or-v1-secret-123456")).toBe("or-v***********3456");
  });
});
