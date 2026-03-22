"use server";

import { redirect } from "next/navigation";

import {
  clearAdminSession,
  createAdminSession,
  verifyAdminLogin,
} from "@/lib/auth/admin-session";
import type { AdminLoginActionState } from "@/app/login/state";

export async function loginAdminAction(
  _previousState: AdminLoginActionState,
  formData: FormData,
): Promise<AdminLoginActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin").trim() || "/admin";

  if (!email || !password) {
    return {
      status: "error",
      message: "Email and password are required.",
    };
  }

  const admin = await verifyAdminLogin(email, password);

  if (!admin) {
    return {
      status: "error",
      message: "Invalid admin credentials.",
    };
  }

  await createAdminSession(admin);
  redirect(next.startsWith("/") ? next : "/admin");
}

export async function logoutAdminAction() {
  await clearAdminSession();
  redirect("/login");
}
