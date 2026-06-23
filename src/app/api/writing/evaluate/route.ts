import { z } from "zod";
import { evaluateWritingTask } from "@/lib/writing/evaluate";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { chatJsonCopilot } from "@/server/copilot-models";
import { CopilotError } from "@/server/copilot-token";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  taskNumber: z.union([z.literal(1), z.literal(2)]),
  prompt: z.string().min(1),
  response: z.string().min(1),
  token: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
});

/** Copilot model ids have no vendor prefix; GitHub Models ids do (e.g. "openai/gpt-4.1"). */
function isCopilotModel(model: string | undefined): model is string {
  return !!model && !model.includes("/");
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = { taskNumber: body.taskNumber, prompt: body.prompt, response: body.response };
  const cookieToken = getCookie(request, "eielts_gh");

  // A bare (no-slash) model id means a premium Copilot model, which runs through
  // the user's connected GitHub account — requires the device-flow cookie token.
  if (isCopilotModel(body.model)) {
    if (!cookieToken) {
      return Response.json(
        { error: "Connect GitHub (device code) in Settings to use this model." },
        { status: 401 },
      );
    }
    try {
      const result = await evaluateWritingTask(input, (options) =>
        chatJsonCopilot({ ...options, oauthToken: cookieToken, model: body.model! }),
      );
      return Response.json(result);
    } catch (error) {
      if (error instanceof CopilotError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json({ error: "Evaluation failed." }, { status: 500 });
    }
  }

  // GitHub Models path. Prefer a user credential (own quota, no shared rate limit):
  // explicit body token, then the device-flow cookie. Otherwise use the shared
  // owner/CLI token under the rate limit.
  const userToken = body.token ?? cookieToken;
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
    const result = await evaluateWritingTask(input, (options) =>
      chatJson({ ...options, token, ...(body.model ? { model: body.model } : {}) }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
