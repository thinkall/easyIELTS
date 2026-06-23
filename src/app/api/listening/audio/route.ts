import { z } from "zod";
import { generateListeningAudio, ListeningTtsError } from "@/server/listening-tts";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  script: z.string().min(1),
  /** The user's own Gemini key (own quota); otherwise the owner key is used. */
  geminiApiKey: z.string().min(1).optional(),
});

// Small in-memory cache so the same section isn't re-synthesised on replay or by
// other listeners. Keyed by the script text; bounded to avoid unbounded growth.
const cache = new Map<string, Uint8Array>();
const CACHE_LIMIT = 50;

export function _resetListeningAudioCache(): void {
  cache.clear();
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function audioResponse(wav: Uint8Array): Response {
  return new Response(wav.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const cached = cache.get(body.script);
  if (cached) return audioResponse(cached);

  const apiKey = body.geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Listening audio is unavailable (no Gemini key configured)." }, { status: 503 });
  }

  // Rate-limit only the shared owner key; a user's own key is their own quota.
  if (!body.geminiApiKey && !rateLimit(`listening-audio:${clientIp(request)}`, 30, 60 * 60 * 1000).allowed) {
    return Response.json({ error: "Rate limit reached. Add your own Gemini key in Settings or try later." }, { status: 429 });
  }

  try {
    const wav = await generateListeningAudio({
      script: body.script,
      apiKey,
      model: process.env.GEMINI_TTS_MODEL || undefined,
    });
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(body.script, wav);
    return audioResponse(wav);
  } catch (error) {
    if (error instanceof ListeningTtsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Audio generation failed." }, { status: 500 });
  }
}
