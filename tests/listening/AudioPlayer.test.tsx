import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPlayer } from "@/components/listening/AudioPlayer";

describe("AudioPlayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays the script once and disables replay", async () => {
    const speak = vi.fn((_text: string, onEnd: () => void) => onEnd());
    render(<AudioPlayer script="hello world" speak={speak} />);
    const button = screen.getByRole("button", { name: /play audio/i });
    await userEvent.click(button);
    expect(speak).toHaveBeenCalledWith("hello world", expect.any(Function));
    // After playing once, the control is disabled (play-once).
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
  });

  it("does not start a second playback", async () => {
    const speak = vi.fn(() => {}); // never ends
    render(<AudioPlayer script="x" speak={speak} />);
    const button = screen.getByRole("button", { name: /play audio/i });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("cancels browser speech when unmounted", async () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel, speak });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );

    const { unmount } = render(<AudioPlayer script="hello world" />);
    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));
    cancel.mockClear();
    unmount();

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
