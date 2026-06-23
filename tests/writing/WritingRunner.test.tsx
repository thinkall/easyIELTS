import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WritingRunner } from "@/components/writing/WritingRunner";
import { getWritingTest } from "@/lib/content/writing";
import { getStorage } from "@/lib/storage/adapter";
import { saveSettings } from "@/lib/settings/settings";

const test = getWritingTest("gt-writing-001")!;
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const taskEval = (n: 1 | 2) => ({
  taskNumber: n,
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7 },
  taskBand: 7,
  wordCount: 3,
  feedback: { strengths: [], improvements: ["expand ideas"], correctedExamples: [] },
  modelAnswer: "model",
});

describe("WritingRunner", () => {
  it("submits each task and shows the overall band and feedback", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => taskEval((++call) as 1 | 2) })),
    );
    render(<WritingRunner test={test} />);
    await userEvent.click(screen.getByRole("button", { name: /submit for evaluation/i }));
    expect(await screen.findByText(/Overall Writing band/)).toBeInTheDocument();
    expect(screen.getByText(/Band 7\.0/)).toBeInTheDocument();
    expect(screen.getAllByText(/expand ideas/).length).toBeGreaterThan(0);
  });

  it("keeps the first task evaluation visible when the second task fails", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) return { ok: true, status: 200, json: async () => taskEval(1) };
        return { ok: false, status: 500, json: async () => ({ error: "Task 2 failed" }) };
      }),
    );
    render(<WritingRunner test={test} />);
    await userEvent.click(screen.getByRole("button", { name: /submit for evaluation/i }));
    expect(await screen.findByText(/Task 2 failed/)).toBeInTheDocument();
    expect(screen.getByText(/Task 1 band: 7\.0/)).toBeInTheDocument();
    expect(screen.getByText(/expand ideas/)).toBeInTheDocument();
  });

  it("includes the selected model from settings in the evaluation request", async () => {
    saveSettings({ model: "claude-opus-4.8" });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => taskEval(1) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WritingRunner test={test} />);
    await userEvent.click(screen.getByRole("button", { name: /submit for evaluation/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("claude-opus-4.8");
  });

  it("records a writing attempt only once when submitted twice", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      const taskNumber = call % 2 === 1 ? 1 : 2;
      return { ok: true, status: 200, json: async () => taskEval(taskNumber) };
    });
    vi.stubGlobal(
      "fetch",
      fetchMock,
    );
    render(<WritingRunner test={test} />);

    await userEvent.click(screen.getByRole("button", { name: /submit for evaluation/i }));
    expect(await screen.findByText(/Overall Writing band/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /submit for evaluation/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    expect(getStorage().listAttempts().filter((attempt) => attempt.skill === "writing")).toHaveLength(1);
  });
});
