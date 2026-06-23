import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { Attempt } from "@/lib/storage/types";

const attempts: Attempt[] = [
  { id: "1", skill: "reading", testId: "t", title: "Reading T", band: 6.5, raw: 33, total: 40, createdAt: 1 },
  { id: "2", skill: "listening", testId: "t", title: "Listening T", band: 7, createdAt: 2 },
];

describe("Dashboard", () => {
  it("shows per-skill bands and recent attempts", () => {
    render(<Dashboard attempts={attempts} />);
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
    expect(screen.getAllByText(/6\.5/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Listening/)).toBeInTheDocument();
    expect(screen.getAllByText(/7\.0/).length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no attempts", () => {
    render(<Dashboard attempts={[]} />);
    expect(screen.getByText(/no attempts yet/i)).toBeInTheDocument();
  });
});
