import "server-only";

function liveValue(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

/** The admin-connected shared GitHub Copilot OAuth token, if any (live). */
export function getSharedCopilotToken(): string | undefined {
  return liveValue("EASYIELTS_SHARED_COPILOT_TOKEN");
}

/** The shared Gemini API key (admin- or owner-configured), if any (live). */
export function getSharedGeminiKey(): string | undefined {
  return liveValue("GEMINI_API_KEY");
}

/** The admin-selected default model for the shared Copilot account, if any (live). */
export function getSharedModel(): string | undefined {
  return liveValue("EASYIELTS_SHARED_MODEL");
}

/** Mask a secret, revealing only the last 4 characters. */
function maskHint(secret: string): string {
  const tail = secret.slice(-4);
  return `••••${tail}`;
}

export interface SharedCredentialStatus {
  copilotConnected: boolean;
  geminiSet: boolean;
  /** Masked hint for the Gemini key (never the full value); "" when unset. */
  geminiHint: string;
  /** Admin-selected shared Copilot model id, or "" when none is set. */
  model: string;
}

/** Non-secret status of the shared credentials, safe to return to the admin UI. */
export function sharedCredentialStatus(): SharedCredentialStatus {
  const gemini = getSharedGeminiKey();
  return {
    copilotConnected: getSharedCopilotToken() !== undefined,
    geminiSet: gemini !== undefined,
    geminiHint: gemini ? maskHint(gemini) : "",
    model: getSharedModel() ?? "",
  };
}
