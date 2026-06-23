import { requestDeviceCode } from "@/server/github-device";
import { serializeCookie } from "@/server/cookies";
import { isAdminRequest, adminUnauthorized } from "@/server/admin-guard";
import { env } from "@/lib/env";

const ADMIN_DEVICE_COOKIE = "eielts_admin_ghdev";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  try {
    const code = await requestDeviceCode(env.GITHUB_OAUTH_CLIENT_ID);
    const cookie = serializeCookie(ADMIN_DEVICE_COOKIE, code.deviceCode, {
      maxAge: code.expiresIn,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
    });
    return Response.json(
      { userCode: code.userCode, verificationUri: code.verificationUri, interval: code.interval, expiresIn: code.expiresIn },
      { headers: { "Set-Cookie": cookie } },
    );
  } catch {
    return Response.json({ error: "Could not start GitHub sign-in." }, { status: 502 });
  }
}
