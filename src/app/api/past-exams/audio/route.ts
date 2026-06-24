import { createReadStream, statSync } from "node:fs";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { resolvePastExamAudioPath } from "@/server/past-exams";

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

/**
 * Stream a past-exam audio file from the local (gitignored) past-exams folder.
 * The file is resolved with strict path-traversal protection; nothing outside an
 * exam folder can be served.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const exam = url.searchParams.get("exam") ?? "";
  const file = url.searchParams.get("file") ?? "";

  const path = resolvePastExamAudioPath(exam, file);
  if (!path) {
    return Response.json({ error: "Audio not found." }, { status: 404 });
  }

  const size = statSync(path).size;
  const type = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  const stream = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
