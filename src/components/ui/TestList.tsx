import Link from "next/link";

export interface TestListItem {
  href: string;
  title: string;
  meta?: string;
}

export function TestList({ tests }: { tests: TestListItem[] }) {
  if (tests.length === 0) {
    return <p className="mt-8 text-sm text-gray-500">No tests yet — generate one to get started.</p>;
  }
  return (
    <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {tests.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-800"
          >
            <span className="flex flex-col">
              <span className="font-semibold">{t.title}</span>
              {t.meta && <span className="text-sm text-gray-500 dark:text-gray-400">{t.meta}</span>}
            </span>
            <span className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
