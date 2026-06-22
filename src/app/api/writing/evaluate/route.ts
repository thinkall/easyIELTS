import { z } from "zod";
import { evaluateWritingTask } from "@/lib/writing/evaluate";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  taskNumber: z.union([z.literal(1), z.literal(2)]),
  prompt: z.string().min(1),
  response: z.string().min(1),
  token: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Prefer a user-supplied credential (own quota, no shared rate limit):
  // explicit body token, then the device-flow cookie. Otherwise use the shared
  // owner/CLI token under the rate limit.
  const userToken = body.token ?? getCookie(request, "eielts_gh");
  let token = userToken;
  if (!token) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    const limit = rateLimit(`writing:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        { error: "Rate limit reached for shared evaluations. Sign in with GitHub or use your own token." },
        { status: 429 },
      );
    }
    token = await resolveServerToken();
  }

  try {
    const result = await evaluateWritingTask(
      { taskNumber: body.taskNumber, prompt: body.prompt, response: body.response },
      (options) => chatJson({ ...options, token }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
