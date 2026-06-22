import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingRunner } from "@/components/reading/ReadingRunner";
import { getReadingTest } from "@/lib/content/reading";

const test = getReadingTest("gt-tool-libraries")!;

describe("ReadingRunner", () => {
  it("renders the passage and questions, then scores on submit", async () => {
    render(<ReadingRunner test={test} />);
    expect(screen.getByText(/Community Tool Libraries/)).toBeInTheDocument();
    // Answer question 1 correctly (False) then submit.
    await userEvent.click(screen.getAllByRole("radio", { name: /^False$/i })[0]);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    // Results appear with a band.
    expect(await screen.findByText(/Your result/)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 10 correct/)).toBeInTheDocument();
  });
});
