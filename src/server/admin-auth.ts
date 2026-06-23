import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "eielts_admin";

/** Constant label so the derived cookie token is stable for a given password. */
const COOKIE_LABEL = "easyielts-admin-session-v1";

function adminPassword(): string | undefined {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length > 0 ? pw : undefined;
}

/** True when an admin password is configured (otherwise the admin area is disabled). */
export function isAdminConfigured(): boolean {
  return adminPassword() !== undefined;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Verify a submitted password against ADMIN_PASSWORD in constant time. */
export function verifyAdminPassword(submitted: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  return safeEqual(submitted, pw);
}

/**
 * Stateless session token derived from the password via HMAC. It changes if the
 * password changes (invalidating old cookies) and reveals nothing about it.
 */
export function adminCookieValue(): string {
  const pw = adminPassword();
  if (!pw) return "";
  return createHmac("sha256", pw).update(COOKIE_LABEL).digest("hex");
}

/** Validate an admin session cookie value against the current password. */
export function isValidAdminCookie(value: string | undefined): boolean {
  if (!value) return false;
  const expected = adminCookieValue();
  if (!expected) return false;
  return safeEqual(value, expected);
}
