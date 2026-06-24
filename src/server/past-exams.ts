import "server-only";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import {
  parseManifest,
  manifestSkills,
  type PastExamManifest,
  type PastExamSummary,
} from "@/lib/past-exams/manifest";

/** Base directory holding user-provided past-exam folders (gitignored, private). */
export function pastExamsDir(): string {
  return process.env.EASYIELTS_PAST_EXAMS_DIR || join(process.cwd(), "private", "past-exams");
}

/** A folder name is the exam id; keep it filesystem-safe. */
function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(id) && id !== "." && id !== "..";
}

/** Load and validate a single exam manifest by id, or undefined if absent/invalid. */
export function getPastExam(id: string): { id: string; manifest: PastExamManifest } | undefined {
  if (!isSafeId(id)) return undefined;
  const file = join(pastExamsDir(), id, "manifest.json");
  if (!existsSync(file)) return undefined;
  try {
    const manifest = parseManifest(JSON.parse(readFileSync(file, "utf8")));
    return { id, manifest };
  } catch {
    return undefined;
  }
}

/** List all valid past exams found on disk (each folder with a parseable manifest.json). */
export function listPastExams(): PastExamSummary[] {
  const dir = pastExamsDir();
  if (!existsSync(dir)) return [];
  const summaries: PastExamSummary[] = [];
  for (const entry of readdirSync(dir)) {
    if (!isSafeId(entry)) continue;
    if (!statSync(join(dir, entry)).isDirectory()) continue;
    const loaded = getPastExam(entry);
    if (loaded) {
      summaries.push({ id: entry, title: loaded.manifest.title, skills: manifestSkills(loaded.manifest) });
    }
  }
  return summaries.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Resolve a request for a past-exam audio file to an absolute path INSIDE the
 * exam folder, or null if the id/file is unsafe or escapes the folder (path
 * traversal). Does not read the file — the caller streams it.
 */
export function resolvePastExamAudioPath(examId: string, file: string): string | null {
  if (!isSafeId(examId)) return null;
  // Reject any path separators / traversal in the file name.
  if (file !== basename(file) || file.includes("..") || file.length === 0) return null;
  const examDir = resolve(pastExamsDir(), examId);
  const target = resolve(examDir, file);
  // Must stay within the exam directory.
  if (target !== join(examDir, file)) return null;
  if (!target.startsWith(examDir)) return null;
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return target;
}
