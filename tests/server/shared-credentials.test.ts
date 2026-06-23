import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getSharedCopilotToken,
  getSharedGeminiKey,
  getSharedModel,
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

  it("exposes the admin-selected shared model in status", () => {
    vi.stubEnv("EASYIELTS_SHARED_MODEL", "gpt-5.5");
    expect(getSharedModel()).toBe("gpt-5.5");
    expect(sharedCredentialStatus().model).toBe("gpt-5.5");
  });

  it("reports an empty model when none is selected", () => {
    vi.stubEnv("EASYIELTS_SHARED_MODEL", "");
    expect(getSharedModel()).toBeUndefined();
    expect(sharedCredentialStatus().model).toBe("");
  });
});
