import { adminSessionCookie } from "@/server/admin-guard";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookie("", 0) } });
}
