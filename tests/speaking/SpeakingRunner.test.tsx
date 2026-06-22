import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";
import type { SpeakingSession, SessionCallbacks } from "@/lib/speaking/session";

afterEach(() => vi.unstubAllGlobals());

// A controllable fake session: capture callbacks so the test can emit events.
function fakeFactory() {
  let cbs: SessionCallbacks;
  const session: SpeakingSession = {
    start: vi.fn(async () => { cbs.onStatus("live"); }),
    sendText: vi.fn(),
    end: vi.fn(() => cbs.onStatus("ended")),
  };
  const create = (_part: string, cb: SessionCallbacks) => { cbs = cb; return session; };
  return { create, emit: (e: never) => cbs.onEvent(e), session };
}

describe("SpeakingRunner", () => {
  it("starts a session, shows transcript turns, and scores on finish", async () => {
    const f = fakeFactory();
    const evalResult = {
      criteria: { fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 7 },
      speakingBand: 7, pronunciationIsApproximate: true,
      feedback: { strengths: [], improvements: ["extend answers"], examples: [] },
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => evalResult })));

    render(<SpeakingRunner test={{ id: "x", skill: "speaking", title: "Part 1", part: "1" }} createSession={f.create} />);
    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getByLabelText(/elapsed time/i)).toBeInTheDocument();
    // Examiner speaks, candidate answers.
    act(() => f.emit({ type: "output_transcript", text: "What is your name?" } as never));
    act(() => f.emit({ type: "input_transcript", text: "My name is Sam." } as never));
    expect(await screen.findByText(/What is your name/)).toBeInTheDocument();
    expect(screen.getByText(/My name is Sam/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /finish/i }));
    expect(await screen.findByText(/Speaking band/i)).toBeInTheDocument();
    expect(screen.getByText(/Band 7\.0/)).toBeInTheDocument();
    expect(screen.getByText(/extend answers/)).toBeInTheDocument();
  });
});