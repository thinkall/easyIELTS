import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Owner-configured keys — server-only, never sent to the client.
  GITHUB_MODELS_TOKEN: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  // Admin page password. When set, /admin lets the owner manage shared credentials.
  ADMIN_PASSWORD: z.string().min(1).optional(),
  // Shared GitHub Copilot OAuth token, managed by the admin page (fallback for
  // users who haven't connected their own).
  EASYIELTS_SHARED_COPILOT_TOKEN: z.string().min(1).optional(),
  // GitHub OAuth app client id for the device flow. Defaults to the public VS Code
  // GitHub Copilot client id, whose tokens both call GitHub Models AND can be
  // exchanged for a Copilot API token (premium models like Claude/GPT-5.x).
  GITHUB_OAUTH_CLIENT_ID: z.string().default("01ab8ac9400c4e429b23"),
  // Public base model ids (safe to expose).
  GITHUB_MODELS_MODEL: z.string().default("openai/gpt-4o"),
  GEMINI_LIVE_MODEL: z.string().default("gemini-3.1-flash-live-preview"),
  // Multimodal model(s) used to evaluate the candidate's recorded speaking audio.
  // Comma-separated; earlier entries are preferred, later are fallbacks on overload.
  GEMINI_EVAL_MODEL: z.string().default("gemini-2.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables. Empty strings (e.g. from an
 * unfilled `.env.example` copy) are treated as "unset", so optional keys stay
 * undefined and defaults apply instead of failing min-length validation.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const normalized: Record<string, string | undefined> = {};
  for (const key of Object.keys(envSchema.shape)) {
    const value = source[key];
    normalized[key] = value === "" ? undefined : value;
  }
  return envSchema.parse(normalized);
}

// Server-only singleton (enforced by `import "server-only"` above).
export const env: Env = parseEnv();
