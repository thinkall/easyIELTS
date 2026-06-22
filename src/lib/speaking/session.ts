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
  let recorderNode: AudioWorkletNode | null = null;
  let playerNode: AudioWorkletNode | null = null;

  async function start() {
    cb.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws/speaking?part=${encodeURIComponent(part)}`);
    ws.onopen = () => cb.onStatus("live");
    ws.onclose = () => cb.onStatus("ended");
    ws.onerror = () => cb.onStatus("error");
    ws.onmessage = (e) => {
      let event: SpeakingEvent;
      try { event = JSON.parse(e.data); } catch { return; }
      if (event.type === "audio") playAudio(event.data);
      cb.onEvent(event);
    };

    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    await audioCtx.audioWorklet.addModule("/worklets/recorder-processor.js");
    const source = audioCtx.createMediaStreamSource(micStream);
    recorderNode = new AudioWorkletNode(audioCtx, "recorder-processor");
    recorderNode.port.onmessage = (ev) => {
      const frame = ev.data as Float32Array;
      const reduced = downsample(frame, audioCtx!.sampleRate, TARGET_INPUT_RATE);
      const base64 = int16ToBase64(floatTo16BitPCM(reduced));
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "audio", data: base64 }));
    };
    source.connect(recorderNode).connect(audioCtx.destination);

    playerCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
    await playerCtx.audioWorklet.addModule("/worklets/player-processor.js");
    playerNode = new AudioWorkletNode(playerCtx, "player-processor");
    playerNode.connect(playerCtx.destination);
  }

  function playAudio(base64: string) {
    if (!playerNode) return;
    const int16 = base64ToInt16(base64);
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 0x8000;
    playerNode.port.postMessage(float);
  }

  function sendText(text: string) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "text", text }));
  }

  function end() {
    try { ws?.send(JSON.stringify({ type: "end" })); } catch { /* ignore */ }
    try { ws?.close(); } catch { /* ignore */ }
    micStream?.getTracks().forEach((t) => t.stop());
    void audioCtx?.close();
    void playerCtx?.close();
    cb.onStatus("ended");
  }

  return { start, sendText, end };
}