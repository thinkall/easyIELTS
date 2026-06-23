import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/reading" }));

import { SiteHeader } from "@/components/layout/SiteHeader";

describe("SiteHeader", () => {
  it("renders navigation links to every module", () => {
    render(<SiteHeader />);
    for (const name of ["Listening", "Reading", "Writing", "Speaking", "Dashboard"]) {
      expect(screen.getAllByRole("link", { name }).length).toBeGreaterThan(0);
    }
  });

  it("links the brand to the home page", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /easyIELTS/i })).toHaveAttribute("href", "/");
  });

  it("marks the active section", () => {
    render(<SiteHeader />);
    const reading = screen.getAllByRole("link", { name: "Reading" })[0];
    expect(reading.className).toMatch(/indigo/);
  });
});
