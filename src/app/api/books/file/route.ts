import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { resolveBookPath } from "@/server/books";

/**
 * Stream a PDF book from the local (gitignored) books folder, inline so the
 * browser's PDF viewer can render it. Strict path-traversal protection applies.
 */
export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get("name") ?? "";
  const path = resolveBookPath(file);
  if (!path) {
    return Response.json({ error: "Book not found." }, { status: 404 });
  }
  const size = statSync(path).size;
  const stream = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
