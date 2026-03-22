import {
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppError } from "@/lib/api/route-handler";
import { env } from "@/lib/config/env";
import {
  authenticateAdminUser,
  findActiveAdminUserById,
  type AdminUserRecord,
} from "@/lib/repositories/admin-users";

const ADMIN_SESSION_COOKIE = "dialiq_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function getSessionSecret() {
  if (!env.APP_ENCRYPTION_KEY) {
    throw new AppError("APP_ENCRYPTION_KEY is required for admin sessions.", {
      statusCode: 500,
      code: "APP_ENCRYPTION_KEY_MISSING",
    });
  }

  return createHash("sha256").update(env.APP_ENCRYPTION_KEY).digest();
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function buildSessionToken(userId: string, expiresAt: number) {
  const payload = `${userId}:${expiresAt}`;
  const signature = signSessionPayload(payload);

  return Buffer.from(`${payload}:${signature}`, "utf8").toString("base64url");
}

function parseSessionToken(token: string) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId, expiresAtRaw, signature] = decoded.split(":");

    if (!userId || !expiresAtRaw || !signature) {
      return null;
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt)) {
      return null;
    }

    const payload = `${userId}:${expiresAt}`;
    const expectedSignature = signSessionPayload(payload);
    const validSignature =
      signature.length === expectedSignature.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    if (!validSignature || expiresAt <= Date.now()) {
      return null;
    }

    return {
      userId,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export async function createAdminSession(user: Pick<AdminUserRecord, "id">) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;

  cookieStore.set(ADMIN_SESSION_COOKIE, buildSessionToken(user.id, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = parseSessionToken(token);
  if (!session) {
    await clearAdminSession();
    return null;
  }

  const user = await findActiveAdminUserById(session.userId);
  if (!user) {
    await clearAdminSession();
    return null;
  }

  return user;
}

export async function requireAuthenticatedAdmin(next = "/admin") {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return user;
}

export async function requireAuthenticatedAdminApi() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    throw new AppError("Admin authentication is required.", {
      statusCode: 401,
      code: "ADMIN_AUTH_REQUIRED",
    });
  }

  return user;
}

export async function verifyAdminLogin(email: string, password: string) {
  return authenticateAdminUser(email, password);
}
