import Link from "next/link";
import { getListeningTests } from "@/lib/content/listening";

export const metadata = { title: "Listening practice — easyIELTS" };

export default function ListeningIndexPage() {
  const tests = getListeningTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Listening practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          The recording plays once. Answer, submit, and get your band instantly.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link href={`/listening/${test.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700">
              <span className="font-semibold">{test.title}</span>
              <span className="ml-2 text-sm text-gray-500">~{test.timeMinutes} min</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
