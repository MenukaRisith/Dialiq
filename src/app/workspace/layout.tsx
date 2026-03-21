import { AppShell } from "@/components/layout/app-shell";
import { workspaceNavigation } from "@/lib/navigation";
import { workspaceProfile } from "@/lib/mock-data";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell
      mode="workspace"
      navigation={workspaceNavigation}
      title={workspaceProfile.workspaceName}
      description={workspaceProfile.summary}
    >
      {children}
    </AppShell>
  );
}
