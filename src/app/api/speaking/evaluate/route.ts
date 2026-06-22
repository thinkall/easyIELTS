import { z } from "zod";
import { scoreSpeakingTranscript } from "@/lib/speaking/score-speaking";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  transcript: z
    .array(z.object({ role: z.enum(["examiner", "candidate"]), text: z.string() }))
    .min(1),
  token: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userToken = body.token ?? getCookie(request, "eielts_gh");
  let token = userToken;
  if (!token) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (!rateLimit(`speaking:${ip}`, 10, 60 * 60 * 1000).allowed) {
      return Response.json(
        { error: "Rate limit reached. Sign in with GitHub or use your own token." },
        { status: 429 },
      );
    }
    token = await resolveServerToken();
  }

  try {
    const result = await scoreSpeakingTranscript(body.transcript, (options) =>
      chatJson({ ...options, token }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
