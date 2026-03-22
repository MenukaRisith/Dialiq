import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAuthenticatedAdmin } from "@/lib/auth/admin-session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getAuthenticatedAdmin();
  if (admin) {
    redirect("/admin");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const next =
    typeof resolvedSearchParams?.next === "string" ? resolvedSearchParams.next : "/admin";
  const error =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,237,220,0.92),rgba(247,242,234,0.88)_48%,rgba(239,235,228,0.96))] px-4 py-10 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[var(--max-width)] items-center justify-center">
        <AdminLoginForm next={next} error={error} />
      </div>
    </div>
  );
}
