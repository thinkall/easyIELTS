import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveServerToken, _resetTokenCache } from "@/server/github-token";

beforeEach(() => _resetTokenCache());

describe("resolveServerToken", () => {
  it("prefers the configured owner token", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: "owner", NODE_ENV: "production" },
      runGhCli,
    });
    expect(token).toBe("owner");
    expect(runGhCli).not.toHaveBeenCalled();
  });

  it("falls back to the gh CLI in development when no owner token", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "development" },
      runGhCli,
    });
    expect(token).toBe("gh-cli-token");
  });

  it("does NOT use the gh CLI in production", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "production" },
      runGhCli,
    });
    expect(token).toBeUndefined();
    expect(runGhCli).not.toHaveBeenCalled();
  });

  it("does NOT use the gh CLI in the test environment", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "test" },
      runGhCli,
    });
    expect(token).toBeUndefined();
    expect(runGhCli).not.toHaveBeenCalled();
  });

  it("caches the gh CLI result", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const env = { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "development" } as const;
    await resolveServerToken({ env, runGhCli });
    await resolveServerToken({ env, runGhCli });
    expect(runGhCli).toHaveBeenCalledTimes(1);
  });

  it("returns undefined if the gh CLI errors", async () => {
    const runGhCli = vi.fn(async () => { throw new Error("not installed"); });
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "development" },
      runGhCli,
    });
    expect(token).toBeUndefined();
  });
});
