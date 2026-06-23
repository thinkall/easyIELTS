import { isAdminRequest, adminUnauthorized } from "@/server/admin-guard";
import { removeEnvVar } from "@/server/env-file";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  removeEnvVar("EASYIELTS_SHARED_COPILOT_TOKEN");
  return Response.json({ ok: true });
}
