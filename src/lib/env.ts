import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Owner-configured keys — server-only, never sent to the client.
  GITHUB_MODELS_TOKEN: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  // GitHub OAuth app client id for the device flow. Defaults to the GitHub CLI
  // public client id, which supports device flow out of the box.
  GITHUB_OAUTH_CLIENT_ID: z.string().default("178c6fc778ccc68e1d6a"),
  // Public base model ids (safe to expose).
  GITHUB_MODELS_MODEL: z.string().default("openai/gpt-4o"),
  GEMINI_LIVE_MODEL: z.string().default("gemini-3.1-flash-live-preview"),
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
