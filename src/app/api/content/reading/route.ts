import { z } from "zod";
import { generateReadingTest } from "@/lib/content/generate-reading";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  topic: z.string().max(200).optional(),
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
    if (!rateLimit(`content:${ip}`, 10, 60 * 60 * 1000).allowed) {
      return Response.json({ error: "Rate limit reached. Sign in with GitHub or use your own token." }, { status: 429 });
    }
    token = await resolveServerToken();
  }

  try {
    const test = await generateReadingTest(body.topic ?? "", (options) => chatJson({ ...options, token }));
    return Response.json(test);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Generation failed. The model may have returned an unexpected format — try again." }, { status: 502 });
  }
}
