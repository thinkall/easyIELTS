import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { buildSetupMessage, encodeAudioChunk, encodeTextTurn, parseServerMessage } from "@/lib/speaking/gemini-live";
import { buildExaminerSystemInstruction } from "@/lib/speaking/examiner";
import type { SpeakingPart } from "@/lib/speaking/types";

const GEMINI_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MAX_SESSION_MS = 6 * 60 * 1000; // hard cost cap
const IDLE_TIMEOUT_MS = 90 * 1000; // close if the browser is silent for 90s
const SESSION_LIMIT = 10;
const SESSION_WINDOW_MS = 60 * 60 * 1000;
// Gemini Live stays silent until it receives a turn, so once setup completes we
// send a short opening turn to make the examiner greet and ask the first question.
const KICKOFF_TURN = "Hello. I'm ready to begin the test.";

interface WindowState {
  count: number;
  resetAt: number;
}

const sessionWindows = new Map<string, WindowState>();

/** Attach the /ws/speaking proxy to the custom Node server. */
export function attachSpeakingProxy(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!req.url || !req.url.startsWith("/ws/speaking")) {
      if (server.listenerCount("upgrade") <= 1) socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (browser) => bridge(browser, req));
  });
}

export function _resetSpeakingProxyLimitStore(): void {
  sessionWindows.clear();
}

export function _speakingProxyLimitSize(): number {
  return sessionWindows.size;
}

function evictExpired(now: number): void {
  for (const [key, state] of sessionWindows) {
    if (now >= state.resetAt) sessionWindows.delete(key);
  }
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function clientKey(req: IncomingMessage): string {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.headers["x-real-ip"]?.toString() ||
    req.socket.remoteAddress ||
    "local"
  );
}

function allowSession(key: string, now = Date.now()): boolean {
  const existing = sessionWindows.get(key);
  if (!existing || now >= existing.resetAt) {
    evictExpired(now);
    sessionWindows.set(key, { count: 1, resetAt: now + SESSION_WINDOW_MS });
    return true;
  }
  if (existing.count >= SESSION_LIMIT) return false;
  existing.count += 1;
  return true;
}

function bridge(browser: WebSocket, req: IncomingMessage): void {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
  if (!apiKey) {
    send(browser, { type: "error", error: "speaking_unavailable" });
    browser.close();
    return;
  }
  if (!allowSession(clientKey(req))) {
    send(browser, { type: "error", error: "rate_limited" });
    browser.close();
    return;
  }

  const part = (new URL(req.url ?? "", "http://localhost").searchParams.get("part") ?? "1") as SpeakingPart;
  const topic = new URL(req.url ?? "", "http://localhost").searchParams.get("topic") || undefined;
  const gemini = new WebSocket(`${GEMINI_WS}?key=${apiKey}`);

  let closed = false;
  let kicked = false;
  let idle: ReturnType<typeof setTimeout>;
  const resetIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => cleanup("idle_timeout"), IDLE_TIMEOUT_MS);
  };
  const cleanup = (reason: string) => {
    if (closed) return;
    closed = true;
    clearTimeout(cap);
    clearTimeout(idle);
    send(browser, { type: "session_end", reason });
    try { browser.close(); } catch { /* ignore */ }
    try { gemini.close(); } catch { /* ignore */ }
  };
  const cap = setTimeout(() => cleanup("time_cap"), MAX_SESSION_MS);
  resetIdle();

  gemini.on("open", () => {
    gemini.send(JSON.stringify(buildSetupMessage(model, buildExaminerSystemInstruction(part, topic))));
  });
  gemini.on("message", (data: Buffer) => {
    try {
      const parsed: unknown = JSON.parse(data.toString());
      if (typeof parsed !== "object" || parsed === null) return;
      // Once Gemini confirms setup, kick off the examiner so it greets and asks
      // the first question instead of waiting silently for the candidate.
      if (!kicked && (parsed as { setupComplete?: unknown }).setupComplete !== undefined) {
        kicked = true;
        gemini.send(JSON.stringify(encodeTextTurn(KICKOFF_TURN)));
      }
      for (const event of parseServerMessage(parsed as never)) send(browser, event);
    } catch {
      // Ignore malformed upstream frames.
    }
  });
  gemini.on("close", () => cleanup("gemini_closed"));
  gemini.on("error", () => { send(browser, { type: "error", error: "gemini_error" }); cleanup("gemini_error"); });

  browser.on("message", (data: Buffer) => {
    resetIdle();
    let msg: unknown;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (typeof msg !== "object" || msg === null) return;
    const m = msg as { type?: string; data?: string; text?: string };
    if (gemini.readyState !== WebSocket.OPEN) return;
    if (m.type === "audio" && typeof m.data === "string") {
      gemini.send(JSON.stringify(encodeAudioChunk(m.data)));
    } else if (m.type === "text" && typeof m.text === "string") {
      gemini.send(JSON.stringify(encodeTextTurn(m.text)));
    } else if (m.type === "end") {
      cleanup("client_end");
    }
  });
  browser.on("close", () => cleanup("browser_closed"));
  browser.on("error", () => cleanup("browser_error"));
}
