import { requestDeviceCode } from "@/server/github-device";
import { serializeCookie } from "@/server/cookies";
import { env } from "@/lib/env";

export async function POST() {
  try {
    const code = await requestDeviceCode(env.GITHUB_OAUTH_CLIENT_ID);
    const cookie = serializeCookie("eielts_ghdev", code.deviceCode, {
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
