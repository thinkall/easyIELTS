import { notFound } from "next/navigation";
import Link from "next/link";
import { getBook } from "@/server/books";
import { Container } from "@/components/ui/Container";

export const dynamic = "force-dynamic";

export default async function BookViewerPage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book } = await params;
  const file = decodeURIComponent(book);
  const found = getBook(file);
  if (!found) notFound();

  const src = `/api/books/file?name=${encodeURIComponent(file)}`;
  return (
    <Container className="py-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="truncate text-lg font-semibold">{found.title}</h1>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <a href={src} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Open in new tab
          </a>
          <Link href="/books" className="text-gray-600 hover:underline dark:text-gray-300">
            ← All books
          </Link>
        </div>
      </div>
      <iframe
        src={src}
        title={found.title}
        className="h-[80vh] w-full rounded-xl border border-gray-200 dark:border-gray-800"
      />
    </Container>
  );
}
