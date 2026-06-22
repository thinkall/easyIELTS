import { serializeCookie } from "@/server/cookies";
import { env } from "@/lib/env";

export async function POST() {
  const cookie = serializeCookie("eielts_gh", "", { maxAge: 0, httpOnly: true, secure: env.NODE_ENV === "production" });
  return Response.json({ status: "disconnected" }, { headers: { "Set-Cookie": cookie } });
}
