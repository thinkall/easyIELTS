import { isAdminConfigured, isAdminRequest } from "@/server/admin-guard";
import { sharedCredentialStatus } from "@/server/shared-credentials";

export async function GET(request: Request) {
  const adminConfigured = isAdminConfigured();
  const authenticated = adminConfigured && isAdminRequest(request);
  if (!authenticated) {
    return Response.json({ adminConfigured, authenticated: false });
  }
  const s = sharedCredentialStatus();
  return Response.json({
    adminConfigured,
    authenticated: true,
    copilot: { connected: s.copilotConnected },
    gemini: { set: s.geminiSet, hint: s.geminiHint },
  });
}
