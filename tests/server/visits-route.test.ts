import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "@/app/api/visits/route";

let dir: string;
let prevCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-visits-route-"));
  prevCwd = process.cwd();
  process.chdir(dir);
});
afterEach(() => {
  process.chdir(prevCwd);
  rmSync(dir, { recursive: true, force: true });
});

function req(cookie?: string) {
  return new Request("http://x/api/visits", {
    headers: { ...(cookie ? { cookie } : {}) },
  });
}

describe("GET /api/visits", () => {
  it("increments and sets a 'visited' cookie for a new visitor", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(1);
    expect(res.headers.get("set-cookie")).toContain("eielts_visited=");
  });

  it("does not increment again for a returning visitor (cookie present)", async () => {
    await GET(req()); // count -> 1
    const res = await GET(req("eielts_visited=1"));
    expect((await res.json()).count).toBe(1); // unchanged
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("counts distinct new visitors", async () => {
    await GET(req());
    const res = await GET(req()); // another new visitor (no cookie)
    expect((await res.json()).count).toBe(2);
  });
});
