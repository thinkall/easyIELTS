import "server-only";

export class CopilotError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CopilotError";
    this.status = status;
  }
}

export interface CopilotCredential {
  /** Short-lived bearer token for the Copilot API. */
  token: string;
  /** Base API endpoint returned by the exchange (proxy varies by plan). */
  endpoint: string;
}

export interface CopilotTokenDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const EXCHANGE_URL = "https://api.github.com/copilot_internal/v2/token";
/** Refresh this long before the stated expiry to avoid using a token mid-flight. */
const EXPIRY_BUFFER_MS = 60_000;

interface CachedCredential extends CopilotCredential {
  expiresAtMs: number;
}

const cache = new Map<string, CachedCredential>();

/** Test helper: clear the cached Copilot credentials. */
export function _resetCopilotTokenCache(): void {
  cache.clear();
}

/**
 * Exchange a GitHub OAuth token (from a Copilot-entitled client) for a short-lived
 * Copilot API token and its endpoint. Results are cached in-memory per OAuth token
 * until shortly before they expire.
 */
export async function getCopilotToken(
  oauthToken: string,
  deps: CopilotTokenDeps = {},
): Promise<CopilotCredential> {
  const now = deps.now ?? Date.now;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const cached = cache.get(oauthToken);
  if (cached && now() < cached.expiresAtMs - EXPIRY_BUFFER_MS) {
    return { token: cached.token, endpoint: cached.endpoint };
  }

  const res = await fetchImpl(EXCHANGE_URL, {
    headers: {
      Authorization: `token ${oauthToken}`,
      Accept: "application/json",
      "User-Agent": "easyIELTS",
      "Editor-Version": "vscode/1.99.0",
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new CopilotError(
      `Copilot token exchange failed (${res.status}): ${detail.slice(0, 160)}`,
      res.status,
    );
  }

  const data = (await res.json()) as {
    token?: string;
    expires_at?: number;
    endpoints?: { api?: string };
  };
  const token = data.token;
  const endpoint = data.endpoints?.api;
  if (!token || !endpoint) {
    throw new CopilotError("Copilot token exchange returned no usable token.", 502);
  }

  const expiresAtSec =
    typeof data.expires_at === "number" ? data.expires_at : Math.floor(now() / 1000) + 1500;
  cache.set(oauthToken, { token, endpoint, expiresAtMs: expiresAtSec * 1000 });
  return { token, endpoint };
}
