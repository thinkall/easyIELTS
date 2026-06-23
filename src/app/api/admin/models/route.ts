import { isAdminRequest, adminUnauthorized } from "@/server/admin-guard";
import { listCopilotModels } from "@/server/copilot-models";
import { getSharedCopilotToken } from "@/server/shared-credentials";
import { CopilotError } from "@/server/copilot-token";

/**
 * List the models available on the connected SHARED Copilot account, for the
 * admin model picker. The shared OAuth token never leaves the server.
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const token = getSharedCopilotToken();
  if (!token) return Response.json({ connected: false, models: [] });
  try {
    const models = await listCopilotModels(token);
    return Response.json({ connected: true, models });
  } catch (error) {
    const message = error instanceof CopilotError ? error.message : "Could not list models.";
    return Response.json({ connected: true, models: [], error: message });
  }
}
