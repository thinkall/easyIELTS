import { getCookie } from "@/server/cookies";
import { listCopilotModels } from "@/server/copilot-models";
import { CopilotError } from "@/server/copilot-token";

/**
 * List the connected user's available Copilot models for the model picker.
 * The OAuth token never leaves the server: it lives in the httpOnly cookie and
 * is exchanged server-side for a short-lived Copilot token.
 */
export async function GET(request: Request) {
  const token = getCookie(request, "eielts_gh");
  if (!token) return Response.json({ connected: false, models: [] });

  try {
    const models = await listCopilotModels(token);
    return Response.json({ connected: true, models });
  } catch (error) {
    const message = error instanceof CopilotError ? error.message : "Could not list models.";
    return Response.json({ connected: true, models: [], error: message });
  }
}
