import "server-only";
import { execFile } from "node:child_process";
import { env } from "@/lib/env";

export type RunGhCli = () => Promise<string>;

const defaultRunGhCli: RunGhCli = () =>
  new Promise((resolve, reject) => {
    execFile("gh", ["auth", "token"], { timeout: 5000 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });

interface ResolveDeps {
  env?: { GITHUB_MODELS_TOKEN?: string; NODE_ENV?: string };
  runGhCli?: RunGhCli;
}

let cachedCliToken: string | undefined;
let cliAttempted = false;

/** Test helper: clear the gh CLI token cache. */
export function _resetTokenCache(): void {
  cachedCliToken = undefined;
  cliAttempted = false;
}

/**
 * Resolve the GitHub token used for shared (owner) GitHub Models calls:
 * the configured owner token, or — in development only — the local `gh` CLI
 * token (so the owner needs zero config). Returns undefined if none is available.
 */
export async function resolveServerToken(deps: ResolveDeps = {}): Promise<string | undefined> {
  const resolvedEnv = deps.env ?? { GITHUB_MODELS_TOKEN: env.GITHUB_MODELS_TOKEN, NODE_ENV: env.NODE_ENV };
  if (resolvedEnv.GITHUB_MODELS_TOKEN) return resolvedEnv.GITHUB_MODELS_TOKEN;
  // gh CLI fallback is for local development ONLY (never test or production),
  // so tests never shell out and deployments never depend on a local CLI.
  if (resolvedEnv.NODE_ENV !== "development") return undefined;

  if (cliAttempted) return cachedCliToken;
  cliAttempted = true;
  try {
    const token = await (deps.runGhCli ?? defaultRunGhCli)();
    cachedCliToken = token && token.length > 0 ? token : undefined;
  } catch {
    cachedCliToken = undefined;
  }
  return cachedCliToken;
}
