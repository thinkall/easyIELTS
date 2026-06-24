import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/layout/SiteFooter";

describe("SiteFooter", () => {
  it("links to the source code repository", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /source code|github repo|view source/i });
    expect(link).toHaveAttribute("href", "https://github.com/thinkall/easyIELTS");
  });
});
