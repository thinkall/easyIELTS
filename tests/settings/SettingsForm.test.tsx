import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSettings } from "@/lib/settings/settings";
import { getStorage } from "@/lib/storage/adapter";

beforeEach(() => localStorage.clear());

describe("SettingsForm", () => {
  it("saves the entered Gemini key", async () => {
    render(<SettingsForm />);
    await userEvent.type(screen.getByLabelText(/gemini/i), "my-gemini-key");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(getSettings().geminiApiKey).toBe("my-gemini-key");
  });

  it("clears all local data", async () => {
    localStorage.setItem("easyielts.attempts", "[{}]");
    render(<SettingsForm />);
    await userEvent.click(screen.getByRole("button", { name: /clear all my data/i }));
    expect(getStorage().listAttempts()).toEqual([]);
  });
});
