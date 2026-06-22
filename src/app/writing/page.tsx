import Link from "next/link";
import { getWritingTests } from "@/lib/content/writing";

export const metadata = { title: "Writing practice — easyIELTS" };

export default function WritingIndexPage() {
  const tests = getWritingTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">GT Writing practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">Write Task 1 and Task 2, then get AI band feedback.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link href={`/writing/${test.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700">
              <span className="font-semibold">{test.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
