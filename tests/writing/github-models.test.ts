import { describe, it, expect, vi, afterEach } from "vitest";
import { chatJson } from "@/server/github-models";

const schema = { name: "x", schema: { type: "object" } };

afterEach(() => vi.unstubAllGlobals());

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })),
  );
}

describe("chatJson", () => {
  it("parses the JSON content from a successful response", async () => {
    mockFetchOnce(200, { choices: [{ message: { content: JSON.stringify({ band: 7 }) } }] });
    const result = await chatJson<{ band: number }>({ system: "s", user: "u", schema, token: "t" });
    expect(result.band).toBe(7);
  });

  it("throws GitHubModelsError with the status on a failed response", async () => {
    mockFetchOnce(401, { error: "bad token" });
    await expect(chatJson({ system: "s", user: "u", schema, token: "t" })).rejects.toMatchObject({
      name: "GitHubModelsError",
      status: 401,
    });
  });

  it("throws 503 when no token is available", async () => {
    await expect(chatJson({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 503 });
  });
});
