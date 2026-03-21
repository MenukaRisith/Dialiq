import { getWorkspaceSnapshot } from "@/lib/platform";

export async function GET() {
  const snapshot = await getWorkspaceSnapshot();
  return Response.json(snapshot);
}
