import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "@/app/api/past-exams/audio/route";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-pe-audio-"));
  process.env.EASYIELTS_PAST_EXAMS_DIR = dir;
  mkdirSync(join(dir, "exam1"), { recursive: true });
  writeFileSync(join(dir, "exam1", "s1.mp3"), "FAKEAUDIO");
});
afterEach(() => {
  delete process.env.EASYIELTS_PAST_EXAMS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

function req(exam: string, file: string) {
  return new Request(`http://x/api/past-exams/audio?exam=${encodeURIComponent(exam)}&file=${encodeURIComponent(file)}`);
}

describe("GET /api/past-exams/audio", () => {
  it("serves an existing audio file with an audio content type", async () => {
    const res = await GET(req("exam1", "s1.mp3"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(await res.text()).toBe("FAKEAUDIO");
  });

  it("404s for a missing file", async () => {
    expect((await GET(req("exam1", "missing.mp3"))).status).toBe(404);
  });

  it("404s for path traversal", async () => {
    expect((await GET(req("exam1", "../exam1/s1.mp3"))).status).toBe(404);
    expect((await GET(req("../etc", "passwd"))).status).toBe(404);
  });
});
