import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingRunner } from "@/components/reading/ReadingRunner";
import { getReadingTest } from "@/lib/content/reading";
import { getStorage } from "@/lib/storage/adapter";

beforeEach(() => localStorage.clear());

describe("attempt recording", () => {
  it("records a reading attempt on submit", async () => {
    const test = getReadingTest("gt-tool-libraries")!;
    render(<ReadingRunner test={test} />);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText(/Your result/);
    const attempts = getStorage().listAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].skill).toBe("reading");
    expect(attempts[0].total).toBe(10);
  });
});
