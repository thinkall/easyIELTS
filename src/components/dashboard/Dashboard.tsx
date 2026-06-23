import type { Attempt, Skill } from "@/lib/storage/types";
import { computeStats } from "@/lib/storage/stats";

const SKILL_LABELS: Record<Skill, string> = {
  reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking",
};

function bandText(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

export function Dashboard({ attempts }: { attempts: Attempt[] }) {
  const stats = computeStats(attempts);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Your progress</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">Track your band scores across all four skills.</p>
      </header>

      <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950">
        <h2 className="text-sm font-semibold uppercase text-gray-500">Overall band</h2>
        <p className="text-4xl font-bold">{bandText(stats.overall)}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {stats.overall === null
            ? "Complete at least one test in each skill to see your overall band."
            : "Your average band across the four skills, on the IELTS 0–9 scale."}
        </p>
      </section>

      {stats.totalAttempts === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
          No attempts yet. Take a test to start tracking your progress.
        </p>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(Object.keys(SKILL_LABELS) as Skill[]).map((skill) => {
            const s = stats.perSkill[skill];
            return (
              <div key={skill} className="rounded-xl border border-gray-200 p-5 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{SKILL_LABELS[skill]}</h3>
                </div>
                <p className="mt-1 text-3xl font-bold">{bandText(s.latest)}</p>
                <p className="text-sm text-gray-500">
                  {s.latest === null
                    ? "No attempts yet"
                    : `Best ${bandText(s.best)} · ${s.attempts} attempt${s.attempts === 1 ? "" : "s"}`}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {stats.totalAttempts > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-gray-500">Recent attempts</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {[...attempts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10).map((a) => (
              <li key={a.id} className="flex justify-between border-b border-gray-100 py-1 dark:border-gray-800">
                <span>{SKILL_LABELS[a.skill].toLowerCase()} — {a.title.toLowerCase()}</span>
                <span className="font-medium">
                  Band {a.band.toFixed(1)}
                  {a.raw !== undefined && a.total !== undefined ? ` (${a.raw}/${a.total})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
