import { isAdminRequest, adminUnauthorized } from "@/server/admin-guard";
import { upsertEnvVar, removeEnvVar } from "@/server/env-file";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  let key = "";
  try {
    key = (await request.json())?.key ?? "";
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof key !== "string" || key.trim().length === 0) {
    return Response.json({ error: "A non-empty key is required." }, { status: 400 });
  }
  upsertEnvVar("GEMINI_API_KEY", key.trim());
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  removeEnvVar("GEMINI_API_KEY");
  return Response.json({ ok: true });
}
