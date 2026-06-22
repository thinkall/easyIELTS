"use client";

import { useState } from "react";
import { getSettings, saveSettings } from "@/lib/settings/settings";
import { getStorage } from "@/lib/storage/adapter";
import { ConnectGitHub } from "@/components/auth/ConnectGitHub";

export function SettingsForm() {
  const [geminiApiKey, setGeminiApiKey] = useState(() => getSettings().geminiApiKey ?? "");
  const [githubToken, setGithubToken] = useState(() => getSettings().githubToken ?? "");
  const [saved, setSaved] = useState(false);

  function save() {
    saveSettings({ geminiApiKey, githubToken });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearData() {
    getStorage().clear();
    saveSettings({ geminiApiKey: "", githubToken: "" });
    setGeminiApiKey("");
    setGithubToken("");
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Your API keys (optional)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Stored only in this browser. Your Gemini key connects the speaking test directly to Google (your quota);
          your GitHub token is used for writing &amp; speaking feedback. Leave blank to use the shared, rate-limited service.
        </p>
        <label className="text-sm font-medium" htmlFor="gemini">Gemini Live API key</label>
        <input id="gemini" type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" placeholder="AIza…" />
        <label className="text-sm font-medium" htmlFor="ghtoken">GitHub token (models:read)</label>
        <input id="ghtoken" type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" placeholder="ghp_… or gho_…" />
        <div className="flex items-center gap-3">
          <button onClick={save} className="self-start rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Save settings
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Or connect GitHub with a device code</h2>
        <ConnectGitHub />
      </section>

      <section className="rounded-xl border border-red-200 p-5 dark:border-red-900">
        <h2 className="text-lg font-semibold">Reset</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Remove your saved keys and all practice history from this browser.</p>
        <button onClick={clearData} className="mt-3 self-start rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
          Clear all my data
        </button>
      </section>
    </div>
  );
}
