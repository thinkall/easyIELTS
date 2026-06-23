import "server-only";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Choose which env file to persist to: prefer an existing `.env.local` (it
 * overrides `.env` at load time), then `.env`, otherwise default to `.env`.
 */
export function _envFilePathFor(dir: string = process.cwd()): string {
  const local = join(dir, ".env.local");
  if (existsSync(local)) return local;
  return join(dir, ".env");
}

function readLines(file: string): string[] {
  if (!existsSync(file)) return [];
  const content = readFileSync(file, "utf8");
  if (content === "") return [];
  // Split but remember whether the file ended with a newline.
  return content.split("\n");
}

function lineMatchesKey(line: string, key: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith(`${key}=`) || trimmed.startsWith(`export ${key}=`);
}

/**
 * Insert or update `KEY=value` in the env file, preserving other lines and
 * comments, and mirror the value into `process.env` so it takes effect live.
 */
export function upsertEnvVar(key: string, value: string, dir: string = process.cwd()): void {
  const file = _envFilePathFor(dir);
  const lines = readLines(file);
  const newLine = `${key}=${value}`;

  let replaced = false;
  const out = lines.map((line) => {
    if (!replaced && lineMatchesKey(line, key)) {
      replaced = true;
      return newLine;
    }
    return line;
  });

  if (!replaced) {
    // Append, keeping the file newline-terminated.
    if (out.length > 0 && out[out.length - 1] === "") {
      out[out.length - 1] = newLine;
      out.push("");
    } else {
      out.push(newLine);
      out.push("");
    }
  }

  writeFileSync(file, out.join("\n"));
  process.env[key] = value;
}

/**
 * Remove every `KEY=...` line from the env file (preserving the rest) and delete
 * the value from `process.env`.
 */
export function removeEnvVar(key: string, dir: string = process.cwd()): void {
  const file = _envFilePathFor(dir);
  if (existsSync(file)) {
    const lines = readLines(file);
    const out = lines.filter((line) => !lineMatchesKey(line, key));
    writeFileSync(file, out.join("\n"));
  }
  delete process.env[key];
}
