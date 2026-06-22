import type { Attempt } from "./types";
import { LocalStorageAdapter } from "./local";

export interface StorageAdapter {
  listAttempts(): Attempt[];
  saveAttempt(attempt: Attempt): void;
  clear(): void;
}

let instance: StorageAdapter | null = null;

/** The active storage adapter. Today: localStorage. Later: an API/DB adapter for logged-in users. */
export function getStorage(): StorageAdapter {
  if (!instance) instance = new LocalStorageAdapter();
  return instance;
}

/** Convenience: record a completed attempt (generates id + timestamp if absent). */
export function recordAttempt(input: Omit<Attempt, "id" | "createdAt"> & { id?: string; createdAt?: number }): void {
  const id = input.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
  getStorage().saveAttempt({ ...input, id, createdAt: input.createdAt ?? Date.now() });
}
