import { AppShell } from "@/components/layout/app-shell";
import { adminNavigation } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell
      mode="admin"
      navigation={adminNavigation}
      title="Platform control room"
      description="Secure provider controls, tenant operations, usage visibility, and safety tooling for the Dialiq platform."
    >
      {children}
    </AppShell>
  );
}
