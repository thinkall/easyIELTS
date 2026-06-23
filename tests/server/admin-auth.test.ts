import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isAdminConfigured,
  verifyAdminPassword,
  adminCookieValue,
  isValidAdminCookie,
  ADMIN_COOKIE,
} from "@/server/admin-auth";

afterEach(() => vi.unstubAllEnvs());

describe("admin-auth", () => {
  it("is not configured when ADMIN_PASSWORD is unset", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(isAdminConfigured()).toBe(false);
    expect(verifyAdminPassword("anything")).toBe(false);
    expect(isValidAdminCookie("anything")).toBe(false);
  });

  it("verifies the correct password and rejects wrong ones", () => {
    vi.stubEnv("ADMIN_PASSWORD", "s3cret");
    expect(isAdminConfigured()).toBe(true);
    expect(verifyAdminPassword("s3cret")).toBe(true);
    expect(verifyAdminPassword("nope")).toBe(false);
    expect(verifyAdminPassword("")).toBe(false);
  });

  it("issues a cookie value that validates, and rejects tampered values", () => {
    vi.stubEnv("ADMIN_PASSWORD", "s3cret");
    const value = adminCookieValue();
    expect(value.length).toBeGreaterThan(0);
    expect(isValidAdminCookie(value)).toBe(true);
    expect(isValidAdminCookie(value + "x")).toBe(false);
    expect(isValidAdminCookie("")).toBe(false);
  });

  it("invalidates an old cookie when the password changes", () => {
    vi.stubEnv("ADMIN_PASSWORD", "s3cret");
    const value = adminCookieValue();
    vi.stubEnv("ADMIN_PASSWORD", "different");
    expect(isValidAdminCookie(value)).toBe(false);
  });

  it("exposes the cookie name", () => {
    expect(ADMIN_COOKIE).toBe("eielts_admin");
  });
});
