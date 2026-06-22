import type { SpeakingEvent } from "./types";
import { floatTo16BitPCM, int16ToBase64, base64ToInt16, downsample } from "./pcm";

export type SessionStatus = "connecting" | "live" | "ended" | "error";

export interface SpeakingSession {
  start(): Promise<void>;
  sendText(text: string): void;
  end(): void;
}

export interface SessionCallbacks {
  onEvent: (event: SpeakingEvent) => void;
  onStatus: (status: SessionStatus) => void;
}

const TARGET_INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

/** Create a live speaking session backed by the proxy WebSocket + Web Audio. */
export function createSpeakingSession(part: string, cb: SessionCallbacks): SpeakingSession {
  let ws: WebSocket | null = null;
  let audioCtx: AudioContext | null = null;
  let playerCtx: AudioContext | null = null;
  let micStream: MediaStream | null = null;
  let playerNode: AudioWorkletNode | null = null;
  let closed = false;

  // Release every acquired resource. Safe to call repeatedly (all ops tolerate
  // being already-stopped/closed), so it also cleans up resources that were
  // acquired *after* teardown set `closed` (the connecting-window race).
  function releaseResources(): void {
    try { ws?.close(); } catch { /* ignore */ }
    micStream?.getTracks().forEach((t) => t.stop());
    audioCtx?.close().catch(() => {});
    playerCtx?.close().catch(() => {});
  }

  // Idempotent: marks the session closed (so start() bails after its awaits)
  // and releases whatever exists now.
  function teardown(): void {
    if (closed) return;
    closed = true;
    try { ws?.send(JSON.stringify({ type: "end" })); } catch { /* ignore */ }
    releaseResources();
  }

  async function start(): Promise<void> {
    cb.onStatus("connecting");
    try {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws/speaking?part=${encodeURIComponent(part)}`);
      ws.onopen = () => { if (!closed) cb.onStatus("live"); };
      ws.onclose = () => { teardown(); cb.onStatus("ended"); };
      ws.onerror = () => { teardown(); cb.onStatus("error"); };
      ws.onmessage = (e) => {
        let event: SpeakingEvent;
        try { event = JSON.parse(e.data); } catch { return; }
        if (event.type === "audio") playAudio(event.data);
        else if (event.type === "interrupted") playerNode?.port.postMessage("flush");
        cb.onEvent(event);
      };

      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (closed) { releaseResources(); return; }

      audioCtx = new AudioContext();
      await audioCtx.audioWorklet.addModule("/worklets/recorder-processor.js");
      if (closed) { releaseResources(); return; }

      const source = audioCtx.createMediaStreamSource(micStream);
      const recorderNode = new AudioWorkletNode(audioCtx, "recorder-processor");
      recorderNode.port.onmessage = (ev) => {
        if (closed || !audioCtx) return;
        const frame = ev.data as Float32Array;
        const reduced = downsample(frame, audioCtx.sampleRate, TARGET_INPUT_RATE);
        const base64 = int16ToBase64(floatTo16BitPCM(reduced));
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "audio", data: base64 }));
      };
      source.connect(recorderNode).connect(audioCtx.destination);

      playerCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
      await playerCtx.audioWorklet.addModule("/worklets/player-processor.js");
      if (closed) { releaseResources(); return; }

      playerNode = new AudioWorkletNode(playerCtx, "player-processor");
      playerNode.connect(playerCtx.destination);
    } catch (err) {
      teardown();
      throw err;
    }
  }

  function playAudio(base64: string): void {
    if (closed || !playerNode) return;
    const int16 = base64ToInt16(base64);
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 0x8000;
    playerNode.port.postMessage(float);
  }

  function sendText(text: string): void {
    if (!closed && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "text", text }));
  }

  function end(): void {
    const wasClosed = closed;
    teardown();
    if (!wasClosed) cb.onStatus("ended");
  }

  return { start, sendText, end };
}
