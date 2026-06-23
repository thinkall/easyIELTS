import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { SKILLS } from "@/components/ui/skills";
import Link from "next/link";

const STEPS = [
  { title: "Pick a skill", body: "Listening, Reading, Writing, or Speaking — or generate a brand-new test with AI." },
  { title: "Practise like the real exam", body: "Timed tests, play-once audio, and a live AI examiner for speaking." },
  { title: "Get instant feedback", body: "Auto-scored bands for Listening & Reading; AI band feedback for Writing & Speaking." },
];

export default function Home() {
  return (
    <div>
      <section className="border-b border-gray-200 bg-gradient-to-b from-indigo-50 to-transparent dark:border-gray-800 dark:from-indigo-950/40">
        <Container className="flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-300">
            IELTS General Training
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            easyIELTS — practice <span className="text-indigo-600">all four skills</span> with instant feedback
          </h1>
          <p className="max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Realistic IELTS General Training practice with instant scoring, AI-written content, and a live AI
            speaking examiner — whatever band you&apos;re aiming for. No sign-up required; your progress is saved in your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/reading" className="px-6 py-2.5">Start practising</ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary" className="px-6 py-2.5">View your progress</ButtonLink>
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <h2 className="text-xl font-semibold">Choose a skill</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SKILLS.map((s) => (
            <Link
              key={s.name}
              href={s.href}
              className="group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-800"
            >
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${s.accent}`}>{s.icon}</span>
              <span className="flex flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{s.name}</span>
                  <span className="text-gray-400 transition-transform group-hover:translate-x-0.5">→</span>
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{s.blurb}</span>
                <span className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">{s.target}</span>
              </span>
            </Link>
          ))}
        </div>
      </Container>

      <Container className="pb-16">
        <h2 className="text-xl font-semibold">How it works</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-gray-500">
          Want AI feedback on your own account?{" "}
          <Link href="/connect" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Connect GitHub Copilot
          </Link>{" "}
          or add your keys in{" "}
          <Link href="/settings" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Settings
          </Link>.
        </p>
      </Container>
    </div>
  );
}
