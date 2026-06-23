import type { SpeakingEvent } from "./types";
import { floatTo16BitPCM, int16ToBase64, base64ToInt16, downsample } from "./pcm";
import { buildSetupMessage, parseServerMessage, encodeAudioChunk, encodeTextTurn } from "./gemini-live";
import { buildExaminerSystemInstruction } from "./examiner";
import { buildWavBase64 } from "./wav";
import { prepareEvalAudio } from "./silence";
import type { SpeakingPart } from "./types";

export type SessionStatus = "connecting" | "live" | "ended" | "error";

export interface SpeakingSession {
  start(): Promise<void>;
  sendText(text: string): void;
  end(): void;
  /** The candidate's captured microphone audio as a base64 WAV, or null if none. */
  getRecording(): { base64: string; mimeType: string; sampleRate: number } | null;
}

export interface SessionCallbacks {
  onEvent: (event: SpeakingEvent) => void;
  onStatus: (status: SessionStatus) => void;
}

const TARGET_INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const DIRECT_GEMINI_MODEL = "gemini-3.1-flash-live-preview";
const GEMINI_WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

// Gemini Live stays silent until it receives a turn, so once setup completes we
// send a short opening turn to make the examiner greet and ask the first question.
const KICKOFF_TURN = "Hello. I'm ready to begin the test.";

/** Build a function that returns the SpeakingEvent(s) for a raw socket message. */
export interface SpeakingSessionOptions {
  /** If set, connect the browser directly to Gemini (user's own key) instead of the proxy. */
  geminiApiKey?: string;
  /** Optional custom examiner topic/cue card (for AI-generated speaking tests). */
  topic?: string;
}

/** Create a live speaking session backed by the proxy WebSocket + Web Audio. */
export function createSpeakingSession(
  part: string,
  cb: SessionCallbacks,
  options: SpeakingSessionOptions = {},
): SpeakingSession {
  const direct = Boolean(options.geminiApiKey);
  let ws: WebSocket | null = null;
  let audioCtx: AudioContext | null = null;
  let playerCtx: AudioContext | null = null;
  let micStream: MediaStream | null = null;
  let playerNode: AudioWorkletNode | null = null;
  let closed = false;
  let ready = false;
  let started = false;
  let kicked = false;
  // Accumulated candidate microphone audio (16kHz PCM16) for end-of-test evaluation.
  const recordedChunks: Int16Array[] = [];
  let recordedSamples = 0;
  const MAX_RECORDED_SAMPLES = TARGET_INPUT_RATE * 60 * 7; // safety cap (~7 min)

  // Kick off the examiner in DIRECT mode (own-key) once BOTH the upstream setup
  // is complete (`ready`) and the local audio graph is up (`started`) — the latter
  // so the greeting audio isn't dropped before the player node exists. In proxy
  // mode the server sends the kickoff (so it works regardless of client state).
  function maybeKickoff(): void {
    if (kicked || closed || !direct || !ready || !started) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    kicked = true;
    ws.send(JSON.stringify(encodeTextTurn(KICKOFF_TURN)));
  }

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

  function emit(event: SpeakingEvent) {
    if (event.type === "audio") playAudio(event.data);
    else if (event.type === "interrupted") playerNode?.port.postMessage("flush");
    else if (event.type === "ready") { ready = true; maybeKickoff(); }
    cb.onEvent(event);
  }

  async function start(): Promise<void> {
    cb.onStatus("connecting");
    try {
      if (direct) {
        ws = new WebSocket(`${GEMINI_WS}?key=${options.geminiApiKey}`);
        ws.onopen = () => {
          if (closed) return;
          ws!.send(JSON.stringify(buildSetupMessage(DIRECT_GEMINI_MODEL, buildExaminerSystemInstruction(part as SpeakingPart, options.topic))));
          cb.onStatus("live");
        };
        ws.onmessage = (e) => {
          let raw: unknown;
          try { raw = JSON.parse(e.data); } catch { return; }
          if (typeof raw !== "object" || raw === null) return;
          for (const event of parseServerMessage(raw as never)) emit(event);
        };
      } else {
        const proto = location.protocol === "https:" ? "wss" : "ws";
        const topicParam = options.topic ? `&topic=${encodeURIComponent(options.topic)}` : "";
        ws = new WebSocket(`${proto}://${location.host}/ws/speaking?part=${encodeURIComponent(part)}${topicParam}`);
        ws.onopen = () => { if (!closed) cb.onStatus("live"); };
        ws.onmessage = (e) => {
          let event: SpeakingEvent;
          try { event = JSON.parse(e.data); } catch { return; }
          emit(event);
        };
      }
      ws.onclose = () => { teardown(); cb.onStatus("ended"); };
      ws.onerror = () => { teardown(); cb.onStatus("error"); };

      // Build the PLAYBACK graph first and resume it: the examiner's greeting can
      // arrive before the mic is granted, and real browsers suspend an AudioContext
      // created after an await (the Start-click gesture is "spent"), which would
      // silently drop all output. resume() re-arms it for output and input.
      playerCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
      await playerCtx.audioWorklet.addModule("/worklets/player-processor.js");
      if (closed) { releaseResources(); return; }
      await playerCtx.resume().catch(() => {});
      playerNode = new AudioWorkletNode(playerCtx, "player-processor");
      playerNode.connect(playerCtx.destination);

      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (closed) { releaseResources(); return; }

      audioCtx = new AudioContext();
      await audioCtx.audioWorklet.addModule("/worklets/recorder-processor.js");
      if (closed) { releaseResources(); return; }
      await audioCtx.resume().catch(() => {});

      const source = audioCtx.createMediaStreamSource(micStream);
      const recorderNode = new AudioWorkletNode(audioCtx, "recorder-processor");
      recorderNode.port.onmessage = (ev) => {
        if (closed || !audioCtx) return;
        const frame = ev.data as Float32Array;
        const reduced = downsample(frame, audioCtx.sampleRate, TARGET_INPUT_RATE);
        const pcm = floatTo16BitPCM(reduced);
        if (recordedSamples < MAX_RECORDED_SAMPLES) {
          recordedChunks.push(pcm);
          recordedSamples += pcm.length;
        }
        const base64 = int16ToBase64(pcm);
        const payload = direct ? encodeAudioChunk(base64) : { type: "audio", data: base64 };
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      };
      source.connect(recorderNode).connect(audioCtx.destination);

      started = true;
      maybeKickoff();
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
    if (closed || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(direct ? encodeTextTurn(text) : { type: "text", text }));
  }

  function end(): void {
    const wasClosed = closed;
    teardown();
    if (!wasClosed) cb.onStatus("ended");
  }

  function getRecording(): { base64: string; mimeType: string; sampleRate: number } | null {
    if (recordedSamples === 0) return null;
    const merged = new Int16Array(recordedSamples);
    let offset = 0;
    for (const chunk of recordedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    // Trim dead air (examiner turns, thinking pauses) and cap the duration so the
    // payload stays small and evaluation is fast; a speech sample is enough to
    // assess pronunciation and fluency. The full transcript covers content.
    const audio = prepareEvalAudio(merged, TARGET_INPUT_RATE);
    return { base64: buildWavBase64(audio, TARGET_INPUT_RATE), mimeType: "audio/wav", sampleRate: TARGET_INPUT_RATE };
  }

  return { start, sendText, end, getRecording };
}
