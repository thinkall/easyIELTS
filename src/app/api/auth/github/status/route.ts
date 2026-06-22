import { getCookie } from "@/server/cookies";

export async function GET(request: Request) {
  return Response.json({ connected: Boolean(getCookie(request, "eielts_gh")) });
}
