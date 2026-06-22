import { z } from "zod";
import { evaluateWritingTask } from "@/lib/writing/evaluate";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  taskNumber: z.union([z.literal(1), z.literal(2)]),
  prompt: z.string().min(1),
  response: z.string().min(1),
  token: z.string().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Throttle the owner-key path (no user token) to protect the owner's quota.
  if (!body.token) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    const limit = rateLimit(`writing:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        { error: "Rate limit reached for shared evaluations. Try again later or use your own GitHub token." },
        { status: 429 },
      );
    }
  }

  try {
    const result = await evaluateWritingTask(
      { taskNumber: body.taskNumber, prompt: body.prompt, response: body.response },
      (options) => chatJson({ ...options, token: body.token }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
