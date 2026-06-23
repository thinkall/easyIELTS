import { isAdminRequest, adminUnauthorized } from "@/server/admin-guard";
import { upsertEnvVar, removeEnvVar } from "@/server/env-file";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  let model = "";
  try {
    model = (await request.json())?.model ?? "";
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof model !== "string" || model.trim().length === 0) {
    return Response.json({ error: "A non-empty model id is required." }, { status: 400 });
  }
  upsertEnvVar("EASYIELTS_SHARED_MODEL", model.trim());
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  removeEnvVar("EASYIELTS_SHARED_MODEL");
  return Response.json({ ok: true });
}
