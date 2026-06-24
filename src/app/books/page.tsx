import Link from "next/link";
import { listBooks } from "@/server/books";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books — easyIELTS" };

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function BooksPage() {
  const books = listBooks();
  return (
    <Container className="py-10">
      <PageHeader title="Books" subtitle="Read the PDF study books in your private library." />
      {books.length === 0 ? (
        <div className="mt-6 rounded-xl border border-gray-200 p-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <p className="font-medium">No books found.</p>
          <p className="mt-2">
            Add your own PDF files to the gitignored <code>private/books/</code> folder, then refresh
            this page. Only add material you are legally entitled to use. See
            <code> examples/books/</code> and the README for details.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {books.map((book) => (
            <li key={book.file}>
              <Link
                href={`/books/${encodeURIComponent(book.file)}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-800"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                    📕
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{book.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">PDF · {formatSize(book.size)}</span>
                  </span>
                </span>
                <span className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
