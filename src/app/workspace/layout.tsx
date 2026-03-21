import { AppShell } from "@/components/layout/app-shell";
import { workspaceNavigation } from "@/lib/navigation";
import { getWorkspaceSnapshot } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const snapshot = await getWorkspaceSnapshot();

  return (
    <AppShell
      mode="workspace"
      navigation={workspaceNavigation}
      title={snapshot.profile.workspaceName}
      description={snapshot.profile.summary}
    >
      {children}
    </AppShell>
  );
}
