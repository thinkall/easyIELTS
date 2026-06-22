import Link from "next/link";
import { getSpeakingTests } from "@/lib/content/speaking";

export const metadata = { title: "Speaking practice — easyIELTS" };

export default function SpeakingIndexPage() {
  const tests = getSpeakingTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Speaking practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Talk live with an AI examiner, then get your band and feedback. Requires a microphone.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link href={`/speaking/${test.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700">
              <span className="font-semibold">{test.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}