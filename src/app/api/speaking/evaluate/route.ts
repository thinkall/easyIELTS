import { z } from "zod";
import { scoreSpeakingTranscript } from "@/lib/speaking/score-speaking";
import { evaluateSpeaking, GeminiEvalError } from "@/server/gemini-eval";
import { resolveChatJson, chatErrorResponse } from "@/server/llm-router";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  transcript: z
    .array(z.object({ role: z.enum(["examiner", "candidate"]), text: z.string() }))
    .min(1),
  token: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  /** Base64 WAV of the candidate's microphone audio (enables real pronunciation). */
  audio: z.string().min(1).optional(),
  /** The user's own Gemini key (own quota); otherwise the owner key is used. */
  geminiApiKey: z.string().min(1).optional(),
});

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Preferred path: Gemini multimodal evaluation. With the candidate's audio this
  // scores real pronunciation; without it, Gemini still scores from the transcript.
  // Uses the user's own key if supplied, else the owner key (server-side only).
  const geminiKey = body.geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (geminiKey) {
    // Rate-limit only the shared owner key; a user's own key is their own quota.
    if (!body.geminiApiKey && !rateLimit(`speaking:${clientIp(request)}`, 10, 60 * 60 * 1000).allowed) {
      return Response.json(
        { error: "Rate limit reached. Add your own Gemini key in Settings or try later." },
        { status: 429 },
      );
    }
    try {
      const result = await evaluateSpeaking({
        transcript: body.transcript,
        audioBase64: body.audio,
        apiKey: geminiKey,
        models: process.env.GEMINI_EVAL_MODEL
          ? process.env.GEMINI_EVAL_MODEL.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
      return Response.json(result);
    } catch (error) {
      if (error instanceof GeminiEvalError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json({ error: "Evaluation failed." }, { status: 500 });
    }
  }

  // Fallback: transcript-only evaluation (no Gemini key configured). A connected
  // user runs on their Copilot account; otherwise the shared owner token is used.
  const resolved = await resolveChatJson(request, {
    model: body.model,
    bodyToken: body.token,
    rateLimitKey: "speaking",
  });
  if ("error" in resolved) {
    return Response.json({ error: resolved.error.message }, { status: resolved.error.status });
  }

  try {
    const result = await scoreSpeakingTranscript(body.transcript, resolved.chat);
    return Response.json(result);
  } catch (error) {
    return chatErrorResponse(error) ?? Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
