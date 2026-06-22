import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionView } from "@/components/reading/QuestionView";
import type { ReadingQuestion } from "@/lib/content/types";

const tfng: ReadingQuestion = {
  id: "q1", number: 1, type: "true_false_notgiven",
  prompt: "The sky is green.", accepted: ["false"],
};
const text: ReadingQuestion = {
  id: "q5", number: 5, type: "sentence_completion", wordLimit: 2,
  prompt: "Members pay an annual ______.", accepted: ["fee"],
};

describe("QuestionView", () => {
  it("renders True/False/Not Given options for a TFNG question and reports changes", async () => {
    const onChange = vi.fn();
    render(<QuestionView question={tfng} value="" onChange={onChange} />);
    expect(screen.getByText(/The sky is green/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /^False$/i }));
    expect(onChange).toHaveBeenCalledWith("false");
  });

  it("renders a text input for completion questions", async () => {
    const onChange = vi.fn();
    render(<QuestionView question={text} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "fee");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the correct answer in review mode when incorrect", () => {
    render(
      <QuestionView question={tfng} value="true" onChange={() => {}} disabled
        result={{ correct: false, accepted: ["false"] }} />,
    );
    expect(screen.getByText(/correct answer: false/i)).toBeInTheDocument();
  });
});
