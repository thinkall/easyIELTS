export interface UserSettings {
  geminiApiKey?: string;
  githubToken?: string;
  /** Selected Copilot model id for AI evaluation (e.g. "claude-opus-4.8"). */
  model?: string;
}

const KEY = "easyielts.settings";

export function getSettings(): UserSettings {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as UserSettings) : {};
  } catch {
    return {};
  }
}

export function saveSettings(patch: UserSettings): void {
  if (typeof localStorage === "undefined") return;
  const next = { ...getSettings(), ...patch };
  // Drop empty-string values so "unset" is consistent.
  for (const k of Object.keys(next) as (keyof UserSettings)[]) {
    if (!next[k]) delete next[k];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}

export function clearSettings(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}
