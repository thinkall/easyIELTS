import "server-only";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename, extname } from "node:path";

/** Base directory holding user-provided PDF books (gitignored, private). */
export function booksDir(): string {
  return process.env.EASYIELTS_BOOKS_DIR || join(process.cwd(), "private", "books");
}

export interface BookSummary {
  /** The file name (used as the id and in URLs). */
  file: string;
  /** A human-friendly title (file name without the .pdf extension). */
  title: string;
  /** File size in bytes. */
  size: number;
}

function isSafeName(name: string): boolean {
  return (
    name.length > 0 &&
    name === basename(name) &&
    !name.includes("..") &&
    !name.startsWith(".")
  );
}

/** List PDF books found in the books directory, sorted by title. */
export function listBooks(): BookSummary[] {
  const dir = booksDir();
  if (!existsSync(dir)) return [];
  const books: BookSummary[] = [];
  for (const entry of readdirSync(dir)) {
    if (!isSafeName(entry)) continue;
    if (extname(entry).toLowerCase() !== ".pdf") continue;
    const full = join(dir, entry);
    if (!statSync(full).isFile()) continue;
    books.push({ file: entry, title: entry.replace(/\.pdf$/i, ""), size: statSync(full).size });
  }
  return books.sort((a, b) => a.title.localeCompare(b.title));
}

/** Look up a single book by file name, or undefined if absent. */
export function getBook(file: string): BookSummary | undefined {
  return listBooks().find((b) => b.file === file);
}

/**
 * Resolve a request for a book file to an absolute path INSIDE the books folder,
 * or null if the name is unsafe or escapes the folder (path traversal). Only PDFs
 * are served.
 */
export function resolveBookPath(file: string): string | null {
  if (!isSafeName(file)) return null;
  if (extname(file).toLowerCase() !== ".pdf") return null;
  const dir = resolve(booksDir());
  const target = resolve(dir, file);
  if (target !== join(dir, file)) return null;
  if (!target.startsWith(dir)) return null;
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return target;
}
