import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPlayer } from "@/components/listening/AudioPlayer";

describe("AudioPlayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays a pre-generated audioUrl directly without calling the generator", async () => {
    const loadAudio = vi.fn(async () => null);
    const playUrl = vi.fn(() => () => {});
    const speak = vi.fn();
    render(<AudioPlayer script="Receptionist: Hello." audioUrl="/audio/listening/x.wav" loadAudio={loadAudio} playUrl={playUrl} speak={speak} />);

    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));

    await waitFor(() => expect(playUrl).toHaveBeenCalledWith("/audio/listening/x.wav", expect.any(Function)));
    expect(loadAudio).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it("plays generated audio when available (not the browser TTS fallback)", async () => {
    const loadAudio = vi.fn(async () => "blob:fake-audio");
    const playUrl = vi.fn(() => () => {});
    const speak = vi.fn();
    render(<AudioPlayer script="Receptionist: Hello. Caller: Hi." loadAudio={loadAudio} playUrl={playUrl} speak={speak} />);

    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));

    await waitFor(() => expect(playUrl).toHaveBeenCalledWith("blob:fake-audio", expect.any(Function)));
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
  });

  it("falls back to label-stripped browser TTS when generation fails", async () => {
    const loadAudio = vi.fn(async () => null);
    const speak = vi.fn((_t: string, onEnd: () => void) => onEnd());
    render(<AudioPlayer script="Receptionist: Hello there. Caller: Hi." loadAudio={loadAudio} speak={speak} />);

    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));

    // The labels are stripped from what is spoken.
    await waitFor(() => expect(speak).toHaveBeenCalledWith("Hello there. Hi.", expect.any(Function)));
  });

  it("does not start a second playback (plays once)", async () => {
    const loadAudio = vi.fn(async () => null);
    const speak = vi.fn(() => {}); // never ends
    render(<AudioPlayer script="x" loadAudio={loadAudio} speak={speak} />);
    const button = screen.getByRole("button", { name: /play audio/i });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(loadAudio).toHaveBeenCalledTimes(1);
  });

  it("cancels browser speech when unmounted", async () => {
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel, speak: vi.fn() });
    const loadAudio = vi.fn(async () => null);
    const speak = vi.fn();

    const { unmount } = render(<AudioPlayer script="hello world" loadAudio={loadAudio} speak={speak} />);
    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));
    cancel.mockClear();
    unmount();

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
