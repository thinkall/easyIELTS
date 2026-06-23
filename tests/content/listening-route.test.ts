import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/content/listening/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

const generated = {
  title: "Gym enrolment",
  sectionName: "Part 1",
  script: "Staff: Hello, welcome. Caller: Hi, I'd like to join the gym.",
  questions: Array.from({ length: 6 }, (_, i) => ({ type: "sentence_completion", prompt: `q${i}`, accepted: ["gym"], wordLimit: 1 })),
};

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/content/listening", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => _resetRateLimitStore());
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/content/listening", () => {
  it("returns a generated listening test (cookie credential)", async () => {
    const content = JSON.stringify(generated);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content })));
    const res = await POST(req({ topic: "gym" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    const test = await res.json();
    expect(test.skill).toBe("listening");
    expect(test.sections[0].questions).toHaveLength(6);
  });

  it("requires a connection (401) for a premium model without a cookie", async () => {
    const res = await POST(req({ topic: "x", model: "gpt-5.5" }));
    expect(res.status).toBe(401);
  });
});
