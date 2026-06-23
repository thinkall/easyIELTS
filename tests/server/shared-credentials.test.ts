import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getSharedCopilotToken,
  getSharedGeminiKey,
  sharedCredentialStatus,
} from "@/server/shared-credentials";

afterEach(() => vi.unstubAllEnvs());

describe("shared-credentials", () => {
  it("returns undefined when nothing is configured", () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getSharedCopilotToken()).toBeUndefined();
    expect(getSharedGeminiKey()).toBeUndefined();
    const s = sharedCredentialStatus();
    expect(s.copilotConnected).toBe(false);
    expect(s.geminiSet).toBe(false);
    expect(s.geminiHint).toBe("");
  });

  it("reads the live values from process.env", () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    vi.stubEnv("GEMINI_API_KEY", "AIzaSyABCDEFG1234");
    expect(getSharedCopilotToken()).toBe("gho_shared");
    expect(getSharedGeminiKey()).toBe("AIzaSyABCDEFG1234");
  });

  it("reports status with a masked gemini hint and never leaks the full key", () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    vi.stubEnv("GEMINI_API_KEY", "AIzaSyABCDEFG1234");
    const s = sharedCredentialStatus();
    expect(s.copilotConnected).toBe(true);
    expect(s.geminiSet).toBe(true);
    expect(s.geminiHint).toContain("1234"); // last 4 shown
    expect(s.geminiHint).not.toContain("AIzaSyABCDEFG"); // body masked
  });
});
