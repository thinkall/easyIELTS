import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Owner-configured keys — server-only, never sent to the client.
  GITHUB_MODELS_TOKEN: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  // Public base model ids (safe to expose).
  GITHUB_MODELS_MODEL: z.string().default("openai/gpt-4o"),
  GEMINI_LIVE_MODEL: z.string().default("gemini-3.1-flash-live-preview"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

// Server-only singleton. Importing this from a Client Component must be avoided.
export const env: Env = parseEnv();
