import { chatJson, GitHubModelsError } from "@/server/github-models";
import { chatJsonCopilot, listCopilotModels } from "@/server/copilot-models";
import { CopilotError } from "@/server/copilot-token";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";
import { getSharedCopilotToken } from "@/server/shared-credentials";

export type ChatJsonFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

/** Copilot model ids have no vendor prefix; GitHub Models ids do (e.g. "openai/gpt-5"). */
export function isCopilotModel(model: string | undefined): model is string {
  return !!model && !model.includes("/");
}

/** Last-resort default when the user's Copilot catalog can't be read. */
const FALLBACK_COPILOT_MODEL = "gpt-4o";

/**
 * Choose a sensible default Copilot model for a connected user who hasn't picked
 * one, preferring a general-purpose chat model from their own catalog so we never
 * fall back to the rate-limited GitHub Models API.
 */
async function pickDefaultCopilotModel(oauthToken: string): Promise<string> {
  try {
    const models = await listCopilotModels(oauthToken);
    if (models.length === 0) return FALLBACK_COPILOT_MODEL;
    return (
      models.find((m) => m.id === "gpt-4o")?.id ??
      models.find((m) => m.id === "gpt-4.1")?.id ??
      models.find((m) => m.category === "versatile")?.id ??
      models.find((m) => m.category === "lightweight")?.id ??
      models[0].id
    );
  } catch {
    return FALLBACK_COPILOT_MODEL;
  }
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
 * Build a structured-JSON chat function for a generation/evaluation route.
 *
 * Routing (a user's own credential always wins; the admin's shared Copilot is the
 * fallback for users who haven't connected their own):
 *  - vendor-prefixed id (e.g. "openai/gpt-5")     → GitHub Models (explicit opt-in)
 *  - bare *premium* id → Copilot via the user's cookie, else the shared admin token,
 *    else 401 (connect / ask admin)
 *  - no model → the user's own credential first (cookie Copilot, then a body GitHub
 *    Models token), then the shared admin Copilot, then the rate-limited owner token
 */
export async function resolveChatJson(
  request: Request,
  opts: { model?: string; bodyToken?: string; rateLimitKey: string; rateLimitMax?: number },
): Promise<ChatResolution> {
  const cookieToken = getCookie(request, "eielts_gh");
  const sharedToken = getSharedCopilotToken();
  // A vendor-prefixed id (e.g. "openai/gpt-5") is an explicit GitHub Models request.
  const wantsGitHubModels = !!opts.model && opts.model.includes("/");

  // Explicit GitHub Models request → token path (own token → rate-limited owner).
  if (wantsGitHubModels) {
    return githubModelsResolution(request, opts);
  }

  // A bare premium id (e.g. "gpt-5.5") can only run on Copilot. The user's own
  // connected account (cookie) wins; otherwise fall back to the shared admin account.
  if (isCopilotModel(opts.model)) {
    const copilotOauth = cookieToken ?? sharedToken;
    if (copilotOauth) {
      return { chat: (o) => chatJsonCopilot({ ...o, oauthToken: copilotOauth, model: opts.model! }) };
    }
    return {
      error: {
        message:
          "Connect GitHub (device code) in Settings to use this model, or ask the site admin to connect a shared account.",
        status: 401,
      },
    };
  }

  // No model selected. Honour the user's OWN credential before any shared fallback:
  //  1. their connected Copilot account (cookie),
  //  2. their own GitHub Models token (body.token), then
  //  3. the admin's shared Copilot, then
  //  4. the rate-limited owner GitHub Models token.
  if (cookieToken) {
    const model = await pickDefaultCopilotModel(cookieToken);
    return { chat: (o) => chatJsonCopilot({ ...o, oauthToken: cookieToken, model }) };
  }
  if (opts.bodyToken) {
    return githubModelsResolution(request, opts);
  }
  if (sharedToken) {
    const model = await pickDefaultCopilotModel(sharedToken);
    return { chat: (o) => chatJsonCopilot({ ...o, oauthToken: sharedToken, model }) };
  }
  return githubModelsResolution(request, opts);
}

/** GitHub Models path: user body/cookie token, else rate-limited owner token. */
async function githubModelsResolution(
  request: Request,
  opts: { model?: string; bodyToken?: string; rateLimitKey: string; rateLimitMax?: number },
): Promise<ChatResolution> {
  let token = opts.bodyToken ?? getCookie(request, "eielts_gh");
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
