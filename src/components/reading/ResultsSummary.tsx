import type { ReadingResult } from "@/lib/reading/score-reading";

export function ResultsSummary({ result }: { result: ReadingResult }) {
  const toSeven = Math.max(0, 7 - result.band);
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950">
      <h2 className="text-lg font-semibold">Your result</h2>
      <p className="mt-1 text-3xl font-bold">
        Band {result.band.toFixed(1)}
        {result.bandIsEstimated && (
          <span className="ml-2 align-middle text-xs font-normal text-gray-500">estimated</span>
        )}
      </p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {result.raw} / {result.total} correct
        {result.bandIsEstimated && ` (scaled to ${result.scaledTo40}/40)`}
      </p>
      <p className="mt-2 text-sm">
        {result.band >= 7
          ? "On target — Band 7 or above. 🎯"
          : `${toSeven.toFixed(1)} band(s) below your Band 7 goal.`}
      </p>
    </div>
  );
}
