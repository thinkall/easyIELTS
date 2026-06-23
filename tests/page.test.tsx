import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("shows the product name and an intro", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /easyIELTS/i })).toBeInTheDocument();
    expect(screen.getAllByText(/all four skills/i).length).toBeGreaterThan(0);
  });
});