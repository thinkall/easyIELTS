import { getCookie, serializeCookie } from "@/server/cookies";
import { readVisitCount, incrementVisitCount } from "@/server/visit-counter";

const VISITED_COOKIE = "eielts_visited";

/**
 * Return the site visit count. A first-time browser (no `eielts_visited` cookie)
 * increments the persisted counter and receives the cookie, so refreshes and
 * repeat visits from the same browser are not counted again.
 */
export async function GET(request: Request) {
  if (getCookie(request, VISITED_COOKIE)) {
    return Response.json({ count: readVisitCount() });
  }
  const count = incrementVisitCount();
  // Non-sensitive flag; omit Secure so dedup works whether served over HTTP or HTTPS.
  const cookie = serializeCookie(VISITED_COOKIE, "1", {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
  });
  return Response.json({ count }, { headers: { "Set-Cookie": cookie } });
}
