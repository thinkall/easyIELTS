import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listBooks, getBook, resolveBookPath } from "@/server/books";
import { GET } from "@/app/api/books/file/route";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-books-"));
  process.env.EASYIELTS_BOOKS_DIR = dir;
});
afterEach(() => {
  delete process.env.EASYIELTS_BOOKS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

function fileReq(name: string) {
  return new Request(`http://x/api/books/file?name=${encodeURIComponent(name)}`);
}

describe("books loader", () => {
  it("lists only PDF files, with a title derived from the file name", () => {
    writeFileSync(join(dir, "Vocabulary Guide.pdf"), "PDF");
    writeFileSync(join(dir, "notes.txt"), "ignore me");
    const books = listBooks();
    expect(books.map((b) => b.file)).toEqual(["Vocabulary Guide.pdf"]);
    expect(books[0].title).toBe("Vocabulary Guide");
  });

  it("returns empty when the directory does not exist", () => {
    process.env.EASYIELTS_BOOKS_DIR = join(dir, "nope");
    expect(listBooks()).toEqual([]);
  });

  it("looks up a single book by file name", () => {
    writeFileSync(join(dir, "a.pdf"), "PDF");
    expect(getBook("a.pdf")?.title).toBe("a");
    expect(getBook("missing.pdf")).toBeUndefined();
  });

  it("resolves a valid pdf path and blocks traversal / non-pdf", () => {
    writeFileSync(join(dir, "a.pdf"), "PDF");
    expect(resolveBookPath("a.pdf")).toBe(join(dir, "a.pdf"));
    expect(resolveBookPath("../a.pdf")).toBeNull();
    expect(resolveBookPath("a.txt")).toBeNull();
    expect(resolveBookPath("missing.pdf")).toBeNull();
  });
});

describe("GET /api/books/file", () => {
  it("serves a PDF inline", async () => {
    writeFileSync(join(dir, "a.pdf"), "PDFDATA");
    const res = await GET(fileReq("a.pdf"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(await res.text()).toBe("PDFDATA");
  });

  it("404s for traversal or a missing file", async () => {
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "sub", "secret.pdf"), "X");
    expect((await GET(fileReq("../sub/secret.pdf"))).status).toBe(404);
    expect((await GET(fileReq("missing.pdf"))).status).toBe(404);
  });
});
