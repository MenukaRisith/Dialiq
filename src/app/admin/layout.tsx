import { requireAuthenticatedAdmin } from "@/lib/auth/admin-session";
import { AppShell } from "@/components/layout/app-shell";
import { Panel } from "@/components/ui/panel";
import { logoutAdminAction } from "@/app/login/actions";
import { adminNavigation } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requireAuthenticatedAdmin("/admin");

  return (
    <AppShell
      mode="admin"
      navigation={adminNavigation}
      title="Platform control room"
      description="Secure provider controls, tenant operations, usage visibility, and safety tooling for the Dialiq platform."
    >
      <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Signed in
          </p>
          <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
            {admin.name ?? admin.email}
          </p>
          <p className="text-sm text-[var(--muted-strong)]">
            {admin.email} • {admin.role}
          </p>
        </div>

        <form action={logoutAdminAction}>
          <button
            type="submit"
            className="rounded-full border border-[color:var(--border-strong)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
          >
            Sign out
          </button>
        </form>
      </Panel>

      {children}
    </AppShell>
  );
}
