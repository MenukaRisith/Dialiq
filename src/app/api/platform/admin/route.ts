import { getAdminSnapshot } from "@/lib/platform";

export async function GET() {
  const snapshot = await getAdminSnapshot();
  return Response.json(snapshot);
}
