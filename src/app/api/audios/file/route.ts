import { createReadStream, statSync } from "node:fs";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { resolveAudioPath, AUDIO_MIME } from "@/server/audios";

/**
 * Stream an audio file from the local (gitignored) audios folder. Supports HTTP
 * Range requests so the player can seek. Strict path-traversal protection applies.
 */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const path = resolveAudioPath(name);
  if (!path) {
    return Response.json({ error: "Audio not found." }, { status: 404 });
  }

  const size = statSync(path).size;
  const type = AUDIO_MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  const range = request.headers.get("range");

  // Partial content for seeking: "bytes=start-end".
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : size - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(path, { start, end })) as unknown as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
