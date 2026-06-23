import "server-only";
import { getCookie, serializeCookie } from "@/server/cookies";
import { ADMIN_COOKIE, isValidAdminCookie, isAdminConfigured } from "@/server/admin-auth";

/** Returns true when the request carries a valid admin session cookie. */
export function isAdminRequest(request: Request): boolean {
  return isValidAdminCookie(getCookie(request, ADMIN_COOKIE));
}

/** Standard 401 for admin-gated routes. */
export function adminUnauthorized(): Response {
  return Response.json({ error: "Admin authentication required." }, { status: 401 });
}

/** Serialize the admin session cookie (empty value + maxAge 0 clears it). */
export function adminSessionCookie(value: string, maxAgeSeconds: number): string {
  return serializeCookie(ADMIN_COOKIE, value, {
    maxAge: maxAgeSeconds,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

export { ADMIN_COOKIE, isAdminConfigured };
