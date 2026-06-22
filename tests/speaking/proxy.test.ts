import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { EventEmitter } from "node:events";

const fakeBrowsers: FakeSocket[] = [];
const fakeGeminis: FakeSocket[] = [];
let geminiConnections = 0;
const IDLE_TIMEOUT_MS = 90 * 1000;
const SESSION_WINDOW_MS = 60 * 60 * 1000;

class FakeSocket extends EventEmitter {
  static OPEN = 1;
  readyState = FakeSocket.OPEN;
  sent: string[] = [];
  url?: string;

  constructor(url?: string) {
    super();
    this.url = url;
    if (url?.startsWith("wss://")) {
      geminiConnections += 1;
      fakeGeminis.push(this);
    }
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 3;
  }
}

class FakeWebSocketServer {
  handleUpgrade(_req: IncomingMessage, _socket: Duplex, _head: Buffer, cb: (ws: FakeSocket) => void) {
    const browser = new FakeSocket();
    fakeBrowsers.push(browser);
    cb(browser);
  }
}

vi.mock("ws", () => ({
  WebSocket: FakeSocket,
  WebSocketServer: FakeWebSocketServer,
}));

function makeServer() {
  const server = new EventEmitter() as EventEmitter & Pick<Server, "on" | "listenerCount">;
  return server;
}

function emitUpgrade(
  server: EventEmitter,
  url: string,
  socket: Partial<Duplex> = {},
  headers: Record<string, string> = {},
) {
  server.emit("upgrade", { url, socket: { remoteAddress: "127.0.0.1" }, headers }, socket, Buffer.alloc(0));
}

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fakeBrowsers.length = 0;
  fakeGeminis.length = 0;
  geminiConnections = 0;
  const { _resetSpeakingProxyLimitStore } = await import("@/server/speaking-proxy");
  _resetSpeakingProxyLimitStore();
});

describe("attachSpeakingProxy", () => {
  it("rate-limits owner-key Gemini Live sessions before opening Gemini sockets", async () => {
    vi.stubEnv("GEMINI_API_KEY", "key");
    const { attachSpeakingProxy } = await import("@/server/speaking-proxy");
    const server = makeServer();
    attachSpeakingProxy(server as Server);

    for (let i = 0; i < 11; i += 1) emitUpgrade(server, "/ws/speaking?part=1");

    expect(geminiConnections).toBe(10);
    expect(JSON.parse(fakeBrowsers[10].sent[0])).toEqual({ type: "error", error: "rate_limited" });
  });

  it("destroys unsupported upgrade sockets when no other upgrade handler is present", async () => {
    const { attachSpeakingProxy } = await import("@/server/speaking-proxy");
    const server = makeServer();
    const socket = { destroy: vi.fn() };
    attachSpeakingProxy(server as Server);

    emitUpgrade(server, "/ws/other", socket as Partial<Duplex>);

    expect(socket.destroy).toHaveBeenCalledOnce();
  });

  it("closes idle browser sessions when the browser sends nothing", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GEMINI_API_KEY", "key");
    const { attachSpeakingProxy } = await import("@/server/speaking-proxy");
    const server = makeServer();
    attachSpeakingProxy(server as Server);

    emitUpgrade(server, "/ws/speaking?part=1");
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    expect(JSON.parse(fakeBrowsers[0].sent[0])).toEqual({ type: "session_end", reason: "idle_timeout" });
    expect(fakeBrowsers[0].readyState).toBe(3);
  });

  it("resets the idle timeout on any browser message", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GEMINI_API_KEY", "key");
    const { attachSpeakingProxy } = await import("@/server/speaking-proxy");
    const server = makeServer();
    attachSpeakingProxy(server as Server);

    emitUpgrade(server, "/ws/speaking?part=1");
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
    fakeBrowsers[0].emit("message", Buffer.from("not-json"));
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);

    expect(fakeBrowsers[0].sent).toEqual([]);

    vi.advanceTimersByTime(1);

    expect(JSON.parse(fakeBrowsers[0].sent[0])).toEqual({ type: "session_end", reason: "idle_timeout" });
  });

  it("ignores browser null and non-object frames without closing the session", async () => {
    vi.stubEnv("GEMINI_API_KEY", "key");
    const { attachSpeakingProxy } = await import("@/server/speaking-proxy");
    const server = makeServer();
    attachSpeakingProxy(server as Server);

    emitUpgrade(server, "/ws/speaking?part=1");

    expect(() => fakeBrowsers[0].emit("message", Buffer.from("null"))).not.toThrow();
    expect(() => fakeBrowsers[0].emit("message", Buffer.from("42"))).not.toThrow();
    expect(fakeBrowsers[0].readyState).toBe(FakeSocket.OPEN);
    expect(fakeBrowsers[0].sent).toEqual([]);
  });

  it("ignores Gemini null and non-object frames without closing the session", async () => {
    vi.stubEnv("GEMINI_API_KEY", "key");
    const { attachSpeakingProxy } = await import("@/server/speaking-proxy");
    const server = makeServer();
    attachSpeakingProxy(server as Server);

    emitUpgrade(server, "/ws/speaking?part=1");

    expect(() => fakeGeminis[0].emit("message", Buffer.from("null"))).not.toThrow();
    expect(() => fakeGeminis[0].emit("message", Buffer.from("42"))).not.toThrow();
    expect(fakeBrowsers[0].readyState).toBe(FakeSocket.OPEN);
    expect(fakeBrowsers[0].sent).toEqual([]);
  });

  it("evicts expired session windows when opening a new window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T00:00:00.000Z"));
    vi.stubEnv("GEMINI_API_KEY", "key");
    const { attachSpeakingProxy, _speakingProxyLimitSize } = await import("@/server/speaking-proxy");
    const server = makeServer();
    attachSpeakingProxy(server as Server);

    for (let i = 0; i < 10; i += 1) {
      emitUpgrade(server, "/ws/speaking?part=1", {}, { "x-forwarded-for": `203.0.113.${i}` });
    }
    expect(_speakingProxyLimitSize()).toBe(10);

    vi.advanceTimersByTime(SESSION_WINDOW_MS + 1);
    emitUpgrade(server, "/ws/speaking?part=1", {}, { "x-forwarded-for": "203.0.113.250" });

    expect(_speakingProxyLimitSize()).toBe(1);
  });
});
