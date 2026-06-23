import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { VisitorCount } from "@/components/home/VisitorCount";

afterEach(() => vi.unstubAllGlobals());

describe("VisitorCount", () => {
  it("fetches and displays the visit count", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ count: 1234 }) })));
    render(<VisitorCount />);
    await waitFor(() => expect(screen.getByText(/1,234/)).toBeInTheDocument());
  });

  it("renders nothing when the count can't be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { container } = render(<VisitorCount />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});
