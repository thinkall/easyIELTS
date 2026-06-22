import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingRunner } from "@/components/reading/ReadingRunner";
import { getReadingTest } from "@/lib/content/reading";

const test = getReadingTest("gt-tool-libraries")!;

describe("ReadingRunner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the passage and questions, then scores on submit", async () => {
    render(<ReadingRunner test={test} />);
    expect(screen.getByRole("heading", { name: "Community Tool Libraries" })).toBeInTheDocument();
    // Answer question 1 correctly (False) then submit.
    await userEvent.click(screen.getAllByRole("radio", { name: /^False$/i })[0]);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    // Results appear with a band.
    expect(await screen.findByText(/Your result/)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 10 correct/)).toBeInTheDocument();
  });

  it("counts down and is NOT reset by answering questions", () => {
    vi.useFakeTimers();
    try {
      render(<ReadingRunner test={test} />);
      expect(screen.getByText(/20:00/)).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(/19:59/)).toBeInTheDocument();
      // Changing an answer must NOT reset the countdown.
      fireEvent.click(screen.getAllByRole("radio", { name: /^True$/i })[0]);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(/19:58/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
