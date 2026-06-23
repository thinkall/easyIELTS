import { verifyAdminPassword, adminCookieValue, isAdminConfigured } from "@/server/admin-auth";
import { adminSessionCookie } from "@/server/admin-guard";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return Response.json({ error: "Admin is not configured (set ADMIN_PASSWORD)." }, { status: 401 });
  }
  let password = "";
  try {
    password = (await request.json())?.password ?? "";
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!verifyAdminPassword(password)) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }
  const cookie = adminSessionCookie(adminCookieValue(), 60 * 60 * 12);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
