import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("shows the product name and the Band 7 goal", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /easyIELTS/i })).toBeInTheDocument();
    expect(screen.getByText(/Band 7/i)).toBeInTheDocument();
  });
});