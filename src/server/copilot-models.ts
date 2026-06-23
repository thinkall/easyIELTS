import "server-only";
import { getCopilotToken, CopilotError, type CopilotTokenDeps } from "./copilot-token";

export type CopilotApiKind = "chat" | "responses";

export interface CopilotModel {
  id: string;
  name: string;
  /** model_picker_category: "powerful" | "versatile" | "lightweight" | "". */
  category: string;
  /** Which API the model is invoked through. */
  api: CopilotApiKind;
}

interface RawModel {
  id: string;
  name?: string;
  model_picker_enabled?: boolean;
  model_picker_category?: string;
  supported_endpoints?: string[];
  capabilities?: { type?: string; supports?: { structured_outputs?: boolean } };
}

const COPILOT_HEADERS: Record<string, string> = {
  "Copilot-Integration-Id": "vscode-chat",
  "Editor-Version": "vscode/1.99.0",
  "User-Agent": "easyIELTS",
};

const CATEGORY_RANK: Record<string, number> = { powerful: 0, versatile: 1, lightweight: 2 };

/**
 * Reduce the raw Copilot model catalog to the models usable for structured-JSON
 * evaluation: picker-enabled chat models that support structured outputs and a
 * chat/completions or responses endpoint. Internal models are dropped.
 */
export function filterUsableModels(raw: RawModel[]): CopilotModel[] {
  const models: CopilotModel[] = [];
  for (const m of raw) {
    if (m.capabilities?.type !== "chat") continue;
    if (!m.capabilities?.supports?.structured_outputs) continue;
    if (!m.model_picker_enabled) continue;
    if (m.id.endsWith("-internal")) continue;

    const endpoints = m.supported_endpoints ?? [];
    const api: CopilotApiKind | null = endpoints.includes("/chat/completions")
      ? "chat"
      : endpoints.includes("/responses")
        ? "responses"
        : null;
    if (!api) continue;

    models.push({ id: m.id, name: m.name ?? m.id, category: m.model_picker_category ?? "", api });
  }
  return models.sort(
    (a, b) => (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9) || a.id.localeCompare(b.id),
  );
}

const MODELS_TTL_MS = 5 * 60_000;
const modelsCache = new Map<string, { models: CopilotModel[]; fetchedAtMs: number }>();

/** Test helper: clear the cached model catalogs. */
export function _resetCopilotModelsCache(): void {
  modelsCache.clear();
}

/** List the connected user's usable Copilot models (cached per OAuth token). */
export async function listCopilotModels(
  oauthToken: string,
  deps: CopilotTokenDeps = {},
): Promise<CopilotModel[]> {
  const now = deps.now ?? Date.now;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const cached = modelsCache.get(oauthToken);
  if (cached && now() - cached.fetchedAtMs < MODELS_TTL_MS) return cached.models;

  const { token, endpoint } = await getCopilotToken(oauthToken, deps);
  const res = await fetchImpl(`${endpoint}/models`, {
    headers: { Authorization: `Bearer ${token}`, ...COPILOT_HEADERS },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new CopilotError(
      `Copilot models request failed (${res.status}): ${detail.slice(0, 160)}`,
      res.status,
    );
  }
  const data = (await res.json()) as { data?: RawModel[] };
  const models = filterUsableModels(data.data ?? []);
  modelsCache.set(oauthToken, { models, fetchedAtMs: now() });
  return models;
}

export interface ChatJsonCopilotOptions {
  oauthToken: string;
  model: string;
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
  deps?: CopilotTokenDeps;
}

/** Determine which API a model uses from the (cached) catalog; default to chat. */
async function resolveApiKind(
  oauthToken: string,
  model: string,
  deps: CopilotTokenDeps,
): Promise<CopilotApiKind> {
  try {
    const models = await listCopilotModels(oauthToken, deps);
    return models.find((m) => m.id === model)?.api ?? "chat";
  } catch {
    return "chat";
  }
}

function extractChatContent(data: unknown): string | undefined {
  const choices = (data as { choices?: { message?: { content?: string } }[] }).choices;
  return choices?.[0]?.message?.content;
}

function extractResponsesContent(data: unknown): string | undefined {
  const d = data as {
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (typeof d.output_text === "string" && d.output_text.length > 0) return d.output_text;
  const message = d.output?.find((o) => o.type === "message");
  return message?.content?.find((c) => c.type === "output_text")?.text;
}

/**
 * Run a structured-JSON completion against the Copilot API using the user's
 * connected account, dispatching to /chat/completions or /responses per model.
 */
export async function chatJsonCopilot<T>(options: ChatJsonCopilotOptions): Promise<T> {
  const deps = options.deps ?? {};
  const fetchImpl = deps.fetchImpl ?? fetch;

  const { token, endpoint } = await getCopilotToken(options.oauthToken, deps);
  const api = await resolveApiKind(options.oauthToken, options.model, deps);

  // Some Copilot vendors (notably Anthropic/Gemini) accept `response_format`/`text.format`
  // but do not strictly enforce it, so we also state the required shape in the prompt.
  const userContent =
    `${options.user}\n\nReturn ONLY a JSON object matching this JSON Schema ` +
    `(use exactly these field names, no extra fields, no markdown fences):\n` +
    JSON.stringify(options.schema.schema);
  const messages = [
    { role: "system", content: options.system },
    { role: "user", content: userContent },
  ];

  const url = `${endpoint}/${api === "chat" ? "chat/completions" : "responses"}`;
  const body =
    api === "chat"
      ? {
          model: options.model,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: { name: options.schema.name, schema: options.schema.schema, strict: true },
          },
        }
      : {
          model: options.model,
          input: messages,
          text: {
            format: {
              type: "json_schema",
              name: options.schema.name,
              schema: options.schema.schema,
              strict: true,
            },
          },
        };

  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...COPILOT_HEADERS },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new CopilotError(`Copilot request failed (${res.status}): ${detail.slice(0, 200)}`, res.status);
  }

  const data = await res.json();
  const content = api === "chat" ? extractChatContent(data) : extractResponsesContent(data);
  if (typeof content !== "string") {
    throw new CopilotError("Copilot returned no content.", 502);
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new CopilotError("Copilot returned invalid JSON.", 502);
  }
}
