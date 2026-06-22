import "server-only";
import { env } from "@/lib/env";

export class GitHubModelsError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubModelsError";
    this.status = status;
  }
}

export interface ChatJsonOptions {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
  /** Optional user-supplied GitHub token; defaults to the owner's server key. */
  token?: string;
  model?: string;
}

const ENDPOINT = "https://models.github.ai/inference/chat/completions";

export async function chatJson<T>(options: ChatJsonOptions): Promise<T> {
  const token = options.token ?? env.GITHUB_MODELS_TOKEN;
  if (!token) {
    throw new GitHubModelsError("No GitHub Models token configured.", 503);
  }
  const model = options.model ?? env.GITHUB_MODELS_MODEL;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      ...(model.includes("gpt-5") ? {} : { temperature: 0.2 }),
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: options.schema.name, schema: options.schema.schema, strict: true },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GitHubModelsError(
      `GitHub Models request failed (${response.status}): ${detail.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new GitHubModelsError("GitHub Models returned no content.", 502);
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new GitHubModelsError("GitHub Models returned invalid JSON.", 502);
  }
}
