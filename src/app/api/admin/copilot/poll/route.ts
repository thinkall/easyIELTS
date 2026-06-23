import { pollAccessToken } from "@/server/github-device";
import { getCookie, serializeCookie } from "@/server/cookies";
import { isAdminRequest, adminUnauthorized } from "@/server/admin-guard";
import { upsertEnvVar } from "@/server/env-file";
import { env } from "@/lib/env";

const ADMIN_DEVICE_COOKIE = "eielts_admin_ghdev";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();

  const deviceCode = getCookie(request, ADMIN_DEVICE_COOKIE);
  if (!deviceCode) {
    return Response.json({ status: "error", error: "no_device_code" }, { status: 400 });
  }

  try {
    const result = await pollAccessToken(deviceCode, env.GITHUB_OAUTH_CLIENT_ID);
    if (result.status === "connected") {
      // Store the shared Copilot OAuth token server-side (env), for all users.
      upsertEnvVar("EASYIELTS_SHARED_COPILOT_TOKEN", result.accessToken);
      const clear = serializeCookie(ADMIN_DEVICE_COOKIE, "", {
        maxAge: 0,
        httpOnly: true,
        secure: env.NODE_ENV === "production",
      });
      return Response.json({ status: "connected" }, { headers: { "Set-Cookie": clear } });
    }
    return Response.json({ status: result.status });
  } catch {
    return Response.json({ status: "pending" });
  }
}
