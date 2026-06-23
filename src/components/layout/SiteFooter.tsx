import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} easyIELTS — practice for IELTS General Training.</p>
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-gray-200">Dashboard</Link>
          <Link href="/settings" className="hover:text-gray-900 dark:hover:text-gray-200">Settings</Link>
          <Link href="/connect" className="hover:text-gray-900 dark:hover:text-gray-200">Connect GitHub</Link>
        </nav>
      </div>
    </footer>
  );
}
