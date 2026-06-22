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
});
