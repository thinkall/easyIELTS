import { roundToHalfBand } from "./rounding";

/** Writing band = (Task1 + 2 x Task2) / 3, rounded. Task 2 is double-weighted. */
export function writingBand(task1Band: number, task2Band: number): number {
  return roundToHalfBand((task1Band + 2 * task2Band) / 3);
}

/** Average of a skill's criteria bands (e.g. the 4 Writing/Speaking criteria), rounded. */
export function skillAverageBand(criteria: number[]): number {
  if (criteria.length === 0) {
    throw new Error("skillAverageBand requires at least one criterion band");
  }
  const sum = criteria.reduce((acc, value) => acc + value, 0);
  return roundToHalfBand(sum / criteria.length);
}

export interface SkillBands {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}

/** Overall band = average of the four skill bands, rounded. */
export function overallBand(bands: SkillBands): number {
  const { listening, reading, writing, speaking } = bands;
  return roundToHalfBand((listening + reading + writing + speaking) / 4);
}
