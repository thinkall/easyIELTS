import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListeningRunner } from "@/components/listening/ListeningRunner";
import { getListeningTest } from "@/lib/content/listening";

const test = getListeningTest("gt-community-hall")!;

describe("ListeningRunner", () => {
  it("plays audio, scores on submit, and reveals the transcript in review", async () => {
    render(<ListeningRunner test={test} />);
    expect(screen.getByText(/Booking a Community Hall/)).toBeInTheDocument();
    // Transcript is hidden before submitting.
    expect(screen.queryByText(/Riverside Community Centre/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/Your result/)).toBeInTheDocument();
    // Transcript revealed after submit.
    expect(screen.getByText(/Riverside Community Centre/)).toBeInTheDocument();
  });
});
