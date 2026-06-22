/**
 * Normalize a free-text answer for comparison: lowercase, trim, collapse
 * internal whitespace, and strip surrounding quotes/punctuation. Internal
 * apostrophes and hyphens (e.g. "o'clock", "well-known") are preserved.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^["'.,;:!?]+|["'.,;:!?]+$/g, "")
    .trim();
}

/** Count whitespace-separated word tokens. A bare number ("14") counts as one. */
export function wordCount(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/** True if `raw` exceeds `wordLimit` (when a limit is set). */
export function exceedsWordLimit(raw: string, wordLimit: number | undefined): boolean {
  if (wordLimit === undefined) return false;
  return wordCount(raw) > wordLimit;
}
