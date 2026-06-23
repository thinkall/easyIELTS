import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Path to the persisted counter file (gitignored data dir under the cwd). */
export function _visitsFilePath(dir: string = process.cwd()): string {
  return join(dir, "data", "visits.json");
}

/** In-memory cache so reads don't hit disk on every request. */
let cached: number | undefined;
let cachedFor: string | undefined;

function loadFromDisk(file: string): number {
  if (!existsSync(file)) return 0;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { count?: unknown };
    return typeof parsed.count === "number" && Number.isFinite(parsed.count) ? parsed.count : 0;
  } catch {
    return 0;
  }
}

/** Current visit count (0 if never written). */
export function readVisitCount(dir: string = process.cwd()): number {
  const file = _visitsFilePath(dir);
  if (cached !== undefined && cachedFor === file) return cached;
  const count = loadFromDisk(file);
  cached = count;
  cachedFor = file;
  return count;
}

/** Increment the persisted visit count and return the new value. */
export function incrementVisitCount(dir: string = process.cwd()): number {
  const file = _visitsFilePath(dir);
  const next = loadFromDisk(file) + 1;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ count: next }));
  cached = next;
  cachedFor = file;
  return next;
}
