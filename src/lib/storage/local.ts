import type { Attempt } from "./types";

const KEY = "easyielts.attempts";

/** Persists attempts in the browser's localStorage (anonymous users). */
export class LocalStorageAdapter {
  private read(): Attempt[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
    } catch {
      return [];
    }
  }

  private write(attempts: Attempt[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(attempts));
  }

  listAttempts(): Attempt[] {
    return this.read().sort((a, b) => b.createdAt - a.createdAt);
  }

  saveAttempt(attempt: Attempt): void {
    this.write([...this.read(), attempt]);
  }

  clear(): void {
    this.write([]);
  }
}
