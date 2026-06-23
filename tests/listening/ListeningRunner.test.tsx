import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListeningRunner } from "@/components/listening/ListeningRunner";
import { getListeningTest } from "@/lib/content/listening";

const test = getListeningTest("gt-community-hall")!;

// jsdom doesn't implement media playback; stub it so the AudioPlayer's default
// path doesn't emit "Not implemented" noise when the seed test has a real audio URL.
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

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
