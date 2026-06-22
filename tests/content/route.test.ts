import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/content/reading/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

beforeEach(() => _resetRateLimitStore());
afterEach(() => vi.unstubAllGlobals());

const generated = {
  title: "T", passageTitle: "P",
  passageParagraphs: ["one two three", "four five six"],
  questions: Array.from({ length: 8 }, (_, i) => ({ type: "true_false_notgiven", prompt: `q${i}`, accepted: ["true"] })),
};

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/content/reading", {
    method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
  });
}

describe("POST /api/content/reading", () => {
  it("returns a generated reading test (cookie credential)", async () => {
    const content = JSON.stringify(generated);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content })));
    const res = await POST(req({ topic: "gardens" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    const test = await res.json();
    expect(test.skill).toBe("reading");
    expect(test.sections[0].questions).toHaveLength(8);
  });

  it("propagates a model error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "bad token" })));
    const res = await POST(req({ topic: "x" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(401);
  });
});
