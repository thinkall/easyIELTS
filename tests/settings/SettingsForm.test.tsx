import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSettings, saveSettings } from "@/lib/settings/settings";
import { getStorage } from "@/lib/storage/adapter";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("SettingsForm", () => {
  it("saves the entered Gemini key", async () => {
    render(<SettingsForm />);
    await userEvent.type(screen.getByLabelText(/gemini/i), "my-gemini-key");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(getSettings().geminiApiKey).toBe("my-gemini-key");
  });

  it("clears all local data", async () => {
    localStorage.setItem("easyielts.attempts", "[{}]");
    const fetch = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    render(<SettingsForm />);
    await userEvent.click(screen.getByRole("button", { name: /clear all my data/i }));
    expect(getStorage().listAttempts()).toEqual([]);
    expect(fetch).toHaveBeenCalledWith("/api/auth/github/logout", { method: "POST" });
  });

  it("does not read saved keys during server render", () => {
    saveSettings({ geminiApiKey: "stored-gemini-key", githubToken: "stored-github-token" });
    const html = renderToString(<SettingsForm />);
    expect(html).not.toContain("stored-gemini-key");
    expect(html).not.toContain("stored-github-token");
  });

  it("lists the connected user's models and saves the selection", async () => {
    const models = [
      { id: "claude-opus-4.8", name: "Claude Opus 4.8", category: "powerful", api: "chat" },
      { id: "gpt-5.5", name: "GPT-5.5", category: "versatile", api: "responses" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/models"
          ? { ok: true, json: async () => ({ connected: true, models }) }
          : { ok: true, json: async () => ({}) },
      ),
    );
    render(<SettingsForm />);
    const select = await screen.findByLabelText(/evaluation model/i);
    await userEvent.selectOptions(select, "gpt-5.5");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(getSettings().model).toBe("gpt-5.5");
  });

  it("lets the user reset a stored model to default even when no models load", async () => {
    saveSettings({ model: "claude-opus-4.8" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/models"
          ? { ok: true, json: async () => ({ connected: false, models: [] }) }
          : { ok: true, json: async () => ({}) },
      ),
    );
    render(<SettingsForm />);
    const select = await screen.findByLabelText(/evaluation model/i);
    await userEvent.selectOptions(select, "");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(getSettings().model).toBeUndefined();
  });
});
