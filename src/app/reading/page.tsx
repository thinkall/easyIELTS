import Link from "next/link";
import { getReadingTests } from "@/lib/content/reading";

export const metadata = {
  title: "Reading practice — easyIELTS",
};

export default function ReadingIndexPage() {
  const tests = getReadingTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">GT Reading practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Take a test, submit, and get an instant score and band estimate.
        </p>
      </header>
      <Link href="/reading/generate" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        ✨ Generate a new test with AI
      </Link>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link
              href={`/reading/${test.id}`}
              className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700"
            >
              <span className="font-semibold">{test.title}</span>
              <span className="ml-2 text-sm text-gray-500">~{test.timeMinutes} min</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
