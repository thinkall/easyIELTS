import { chatJson, GitHubModelsError } from "@/server/github-models";
import { chatJsonCopilot } from "@/server/copilot-models";
import { CopilotError } from "@/server/copilot-token";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

export type ChatJsonFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

/** Copilot model ids have no vendor prefix; GitHub Models ids do (e.g. "openai/gpt-5"). */
export function isCopilotModel(model: string | undefined): model is string {
  return !!model && !model.includes("/");
}

export type ChatResolution =
  | { chat: ChatJsonFn }
  | { error: { message: string; status: number } };

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

/**
 * Build a structured-JSON chat function for a generation/evaluation route, routing
 * a selected premium model id (no vendor prefix, e.g. "gpt-5.5") through the user's
 * connected GitHub Copilot account, and otherwise through the shared GitHub Models
 * API (user token → device-flow cookie → rate-limited owner token).
 */
export async function resolveChatJson(
  request: Request,
  opts: { model?: string; bodyToken?: string; rateLimitKey: string; rateLimitMax?: number },
): Promise<ChatResolution> {
  const cookieToken = getCookie(request, "eielts_gh");

  if (isCopilotModel(opts.model)) {
    if (!cookieToken) {
      return { error: { message: "Connect GitHub (device code) in Settings to use this model.", status: 401 } };
    }
    return { chat: (o) => chatJsonCopilot({ ...o, oauthToken: cookieToken, model: opts.model! }) };
  }

  let token = opts.bodyToken ?? cookieToken;
  if (!token) {
    const limit = rateLimit(`${opts.rateLimitKey}:${clientIp(request)}`, opts.rateLimitMax ?? 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return { error: { message: "Rate limit reached. Sign in with GitHub or use your own token.", status: 429 } };
    }
    token = await resolveServerToken();
  }
  const model = opts.model;
  return { chat: (o) => chatJson({ ...o, token, ...(model ? { model } : {}) }) };
}

/** Map an LLM client error to a Response, or null if it isn't a known LLM error. */
export function chatErrorResponse(error: unknown): Response | null {
  if (error instanceof GitHubModelsError || error instanceof CopilotError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
