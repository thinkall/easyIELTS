import { describe, it, expect } from "vitest";
import { getCookie, serializeCookie } from "@/server/cookies";

describe("cookies", () => {
  it("reads a named cookie from a request", () => {
    const req = new Request("http://x", { headers: { cookie: "a=1; eielts_gh=tok123; b=2" } });
    expect(getCookie(req, "eielts_gh")).toBe("tok123");
    expect(getCookie(req, "missing")).toBeUndefined();
  });

  it("returns the raw value when a cookie is malformed-percent-encoded (no throw)", () => {
    const req = new Request("http://x", { headers: { cookie: "eielts_gh=%E0%A4%A" } });
    expect(() => getCookie(req, "eielts_gh")).not.toThrow();
    expect(getCookie(req, "eielts_gh")).toBe("%E0%A4%A");
  });

  it("serializes an httpOnly cookie with attributes", () => {
    const c = serializeCookie("eielts_gh", "tok", { maxAge: 60, httpOnly: true, secure: true });
    expect(c).toContain("eielts_gh=tok");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Max-Age=60");
    expect(c).toContain("Path=/");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
  });

  it("serializes an expiring (cleared) cookie with Max-Age=0", () => {
    expect(serializeCookie("eielts_gh", "", { maxAge: 0 })).toContain("Max-Age=0");
  });
});
