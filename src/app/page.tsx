import Link from "next/link";

const SKILLS = [
  { name: "Listening", target: "Band 7 = 30-31 / 40" },
  { name: "Reading", target: "Band 7 = 34-35 / 40 (GT)" },
  { name: "Writing", target: "AI-scored, 4 criteria" },
  { name: "Speaking", target: "Live AI examiner" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">easyIELTS</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Practice IELTS General Training and reach <strong>Band 7</strong> in all four skills.
        </p>
      </header>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SKILLS.map((s) => {
          const card = (
            <div className="h-full rounded-xl border border-gray-200 p-5 hover:border-indigo-400 dark:border-gray-700">
              <h2 className="text-xl font-semibold">{s.name}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.target}</p>
            </div>
          );
          const href = s.name === "Reading" ? "/reading" : s.name === "Listening" ? "/listening" : null;
          return href ? (
            <Link key={s.name} href={href}>{card}</Link>
          ) : (
            <div key={s.name}>{card}</div>
          );
        })}
      </section>
    </main>
  );
}
