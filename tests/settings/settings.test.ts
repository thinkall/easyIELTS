import { describe, it, expect, beforeEach } from "vitest";
import { getSettings, saveSettings, clearSettings } from "@/lib/settings/settings";

beforeEach(() => localStorage.clear());

describe("settings store", () => {
  it("returns empty settings by default", () => {
    expect(getSettings()).toEqual({});
  });

  it("saves and merges settings", () => {
    saveSettings({ geminiApiKey: "g" });
    saveSettings({ githubToken: "t" });
    expect(getSettings()).toEqual({ geminiApiKey: "g", githubToken: "t" });
  });

  it("clears settings", () => {
    saveSettings({ geminiApiKey: "g" });
    clearSettings();
    expect(getSettings()).toEqual({});
  });

  it("tolerates corrupt storage", () => {
    localStorage.setItem("easyielts.settings", "{bad");
    expect(getSettings()).toEqual({});
  });
});
