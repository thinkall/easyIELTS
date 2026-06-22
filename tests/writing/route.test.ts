import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "@/app/api/writing/evaluate/route";

afterEach(() => vi.unstubAllGlobals());

function req(body: unknown) {
  return new Request("http://localhost/api/writing/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const llmContent = JSON.stringify({
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 6.5 },
  feedback: { strengths: [], improvements: [], correctedExamples: [] },
  modelAnswer: "model",
});

describe("POST /api/writing/evaluate", () => {
  it("returns 400 for an invalid body", async () => {
    const res = await POST(req({ taskNumber: 3 }));
    expect(res.status).toBe(400);
  });

  it("returns an evaluation when the model responds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: llmContent } }] }),
      text: async () => llmContent,
    })));
    const res = await POST(req({ taskNumber: 2, prompt: "p", response: "a b c", token: "t" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.taskBand).toBe(7); // avg(7,7,7,6.5)=6.875 -> 7
  });

  it("propagates the GitHub Models error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 401, json: async () => ({}), text: async () => "bad token",
    })));
    const res = await POST(req({ taskNumber: 1, prompt: "p", response: "r", token: "t" }));
    expect(res.status).toBe(401);
  });
});
