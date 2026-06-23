import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("parses optional keys as undefined when absent", () => {
    const env = parseEnv({ NODE_ENV: "test" });
    expect(env.NODE_ENV).toBe("test");
    expect(env.GITHUB_MODELS_TOKEN).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it("keeps provided owner keys", () => {
    const env = parseEnv({ NODE_ENV: "production", GITHUB_MODELS_TOKEN: "ghp_x", GEMINI_API_KEY: "g_x" });
    expect(env.GITHUB_MODELS_TOKEN).toBe("ghp_x");
    expect(env.GEMINI_API_KEY).toBe("g_x");
  });

  it("treats present-but-empty values as unset (no throw)", () => {
    expect(() => parseEnv({ GITHUB_MODELS_TOKEN: "", GEMINI_API_KEY: "" })).not.toThrow();
    const env = parseEnv({ GITHUB_MODELS_TOKEN: "", GEMINI_API_KEY: "" });
    expect(env.GITHUB_MODELS_TOKEN).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.GITHUB_MODELS_MODEL).toBe("openai/gpt-4o");
  });

  it("defaults to the Copilot-entitled device-flow client id", () => {
    expect(parseEnv({ NODE_ENV: "test" }).GITHUB_OAUTH_CLIENT_ID).toBe("01ab8ac9400c4e429b23");
  });
});
