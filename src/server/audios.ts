import "server-only";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname, sep } from "node:path";

/** Base directory holding user-provided audio files (gitignored, private). */
export function audiosDir(): string {
  return process.env.EASYIELTS_AUDIOS_DIR || join(process.cwd(), "private", "audios");
}

const AUDIO_EXTS = new Set([".mp3", ".m4a", ".mp4", ".aac", ".ogg", ".oga", ".wav", ".flac", ".webm"]);

export interface AudioTrack {
  /** Path relative to the audios dir, using "/" separators (used in URLs). */
  path: string;
  /** The file name. */
  name: string;
  /** The containing folder relative to the audios dir ("" for the root), "/"-joined. */
  folder: string;
  /** File size in bytes. */
  size: number;
}

export interface AudioFolder {
  /** Folder path relative to the audios dir ("" for the root). */
  folder: string;
  tracks: AudioTrack[];
}

/** Recursively collect audio files under `dir`, relative to `base`. */
function walk(base: string, dir: string, out: AudioTrack[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(base, full, out);
    } else if (stats.isFile() && AUDIO_EXTS.has(extname(entry).toLowerCase())) {
      const rel = full.slice(base.length + 1).split(sep).join("/");
      const slash = rel.lastIndexOf("/");
      out.push({
        path: rel,
        name: slash === -1 ? rel : rel.slice(slash + 1),
        folder: slash === -1 ? "" : rel.slice(0, slash),
        size: stats.size,
      });
    }
  }
}

/** List all audio tracks, sorted by path. */
export function listAudios(): AudioTrack[] {
  const base = resolve(audiosDir());
  if (!existsSync(base)) return [];
  const out: AudioTrack[] = [];
  walk(base, base, out);
  return out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

/** Group audio tracks by their containing folder, folders sorted by name. */
export function listAudioFolders(): AudioFolder[] {
  const byFolder = new Map<string, AudioTrack[]>();
  for (const track of listAudios()) {
    const list = byFolder.get(track.folder) ?? [];
    list.push(track);
    byFolder.set(track.folder, list);
  }
  return [...byFolder.entries()]
    .map(([folder, tracks]) => ({ folder, tracks }))
    .sort((a, b) => a.folder.localeCompare(b.folder, undefined, { numeric: true }));
}

/**
 * Resolve a relative audio path to an absolute path INSIDE the audios folder, or
 * null if the path is unsafe or escapes the folder (path traversal). Nested paths
 * are allowed; only audio file types are served.
 */
export function resolveAudioPath(relPath: string): string | null {
  if (!relPath || relPath.length === 0) return null;
  // Normalize separators and reject absolute paths / traversal segments.
  const parts = relPath.split(/[/\\]+/);
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  if (!AUDIO_EXTS.has(extname(relPath).toLowerCase())) return null;

  const base = resolve(audiosDir());
  const target = resolve(base, ...parts);
  if (target !== base && !target.startsWith(base + sep)) return null;
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return target;
}

export const AUDIO_MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};
