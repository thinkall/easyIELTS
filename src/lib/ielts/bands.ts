/**
 * IELTS raw-score (out of 40) → band-score conversion tables.
 *
 * Sources: ielts.org "understanding-ielts-scoring" (Listening Band 7 avg = 30;
 * General Training Reading Band 7 avg = 35), and ieltsbuddy.com/ielts-scores.html.
 * Official note: exact marks vary slightly per test version; these are the
 * industry-standard tables. GT Reading needs MORE correct answers than Academic.
 */

interface BandRow {
  /** Minimum raw score (inclusive) to reach `band`. Rows are sorted descending. */
  minRaw: number;
  band: number;
}

const LISTENING_TABLE: BandRow[] = [
  { minRaw: 39, band: 9 },
  { minRaw: 37, band: 8.5 },
  { minRaw: 35, band: 8 },
  { minRaw: 32, band: 7.5 },
  { minRaw: 30, band: 7 },
  { minRaw: 26, band: 6.5 },
  { minRaw: 23, band: 6 },
  { minRaw: 18, band: 5.5 },
  { minRaw: 16, band: 5 },
  { minRaw: 13, band: 4.5 },
  { minRaw: 11, band: 4 },
  { minRaw: 8, band: 3.5 },
  { minRaw: 6, band: 3 },
  { minRaw: 4, band: 2.5 },
];

const GT_READING_TABLE: BandRow[] = [
  { minRaw: 40, band: 9 },
  { minRaw: 39, band: 8.5 },
  { minRaw: 37, band: 8 },
  { minRaw: 36, band: 7.5 },
  { minRaw: 34, band: 7 },
  { minRaw: 32, band: 6.5 },
  { minRaw: 30, band: 6 },
  { minRaw: 27, band: 5.5 },
  { minRaw: 23, band: 5 },
  { minRaw: 19, band: 4.5 },
  { minRaw: 15, band: 4 },
  { minRaw: 12, band: 3.5 },
  { minRaw: 9, band: 3 },
  { minRaw: 6, band: 2.5 },
];

function rawToBand(table: BandRow[], raw: number): number {
  if (!Number.isFinite(raw)) {
    throw new Error(`raw score must be a finite number, received: ${raw}`);
  }
  const clamped = Math.max(0, Math.min(40, Math.round(raw)));
  for (const row of table) {
    if (clamped >= row.minRaw) return row.band;
  }
  // Below the lowest documented threshold — sub-meaningful for a Band-7 tool.
  return 1;
}

/** Listening raw score (0-40) → band score. */
export function listeningRawToBand(raw: number): number {
  return rawToBand(LISTENING_TABLE, raw);
}

/** General Training Reading raw score (0-40) → band score. */
export function gtReadingRawToBand(raw: number): number {
  return rawToBand(GT_READING_TABLE, raw);
}
