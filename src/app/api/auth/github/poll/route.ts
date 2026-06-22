import { pollAccessToken } from "@/server/github-device";
import { getCookie, serializeCookie } from "@/server/cookies";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const deviceCode = getCookie(request, "eielts_ghdev");
  if (!deviceCode) return Response.json({ status: "error", error: "no_device_code" }, { status: 400 });

  try {
    const result = await pollAccessToken(deviceCode, env.GITHUB_OAUTH_CLIENT_ID);
    if (result.status === "connected") {
      const secure = env.NODE_ENV === "production";
      const headers = new Headers();
      headers.append("Set-Cookie", serializeCookie("eielts_gh", result.accessToken, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, secure }));
      headers.append("Set-Cookie", serializeCookie("eielts_ghdev", "", { maxAge: 0, httpOnly: true, secure }));
      return Response.json({ status: "connected" }, { headers });
    }
    return Response.json({ status: result.status });
  } catch {
    return Response.json({ status: "pending" });
  }
}
