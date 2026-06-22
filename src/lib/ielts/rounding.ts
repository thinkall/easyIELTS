/**
 * Round an IELTS score to the nearest half band. Exact .25/.75 midpoints round
 * up (the official rule: ".25 rounds up to the next half band, .75 rounds up to
 * the next whole band"). Result is clamped to the valid [0, 9] band range.
 */
export function roundToHalfBand(value: number): number {
  const clamped = Math.min(9, Math.max(0, value));
  return Math.round(clamped * 2) / 2;
}
