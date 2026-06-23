import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdminPanel } from "@/components/admin/AdminPanel";

function mockStatus(data: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/api/admin/status")) return { ok: true, json: async () => data };
    if (url.includes("/api/admin/models")) return { ok: true, json: async () => ({ connected: true, models: [] }) };
    return { ok: true, json: async () => ({}) };
  }));
}

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.unstubAllGlobals());

describe("AdminPanel", () => {
  it("shows a password prompt when not authenticated", async () => {
    mockStatus({ adminConfigured: true, authenticated: false });
    render(<AdminPanel />);
    await waitFor(() => expect(screen.getByLabelText(/admin password/i)).toBeInTheDocument());
  });

  it("shows a not-configured message when ADMIN_PASSWORD is unset", async () => {
    mockStatus({ adminConfigured: false, authenticated: false });
    render(<AdminPanel />);
    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());
  });

  it("shows shared-credential controls when authenticated", async () => {
    mockStatus({ adminConfigured: true, authenticated: true, copilot: { connected: false }, gemini: { set: false, hint: "" } });
    render(<AdminPanel />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /shared github copilot/i })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /shared gemini key/i })).toBeInTheDocument();
  });

  it("shows the shared model picker when Copilot is connected", async () => {
    mockStatus({ adminConfigured: true, authenticated: true, copilot: { connected: true }, gemini: { set: false, hint: "" }, model: "gpt-5.5" });
    render(<AdminPanel />);
    await waitFor(() => expect(screen.getByLabelText(/shared model/i)).toBeInTheDocument());
  });
});
