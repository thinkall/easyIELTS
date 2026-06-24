import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listPastExams, getPastExam, resolvePastExamAudioPath } from "@/server/past-exams";

let dir: string;

function writeExam(id: string, manifest: unknown, files: Record<string, string> = {}) {
  const folder = join(dir, id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "manifest.json"), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(folder, name), content);
}

const minimal = {
  title: "Sample — Test 1",
  listening: {
    sections: [{ name: "S1", audio: "s1.mp3", questions: [{ type: "short_answer", prompt: "Q", accepted: ["a"] }] }],
  },
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-pe-"));
  process.env.EASYIELTS_PAST_EXAMS_DIR = dir;
});
afterEach(() => {
  delete process.env.EASYIELTS_PAST_EXAMS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("past-exams loader", () => {
  it("lists valid exams and skips invalid manifests", () => {
    writeExam("cam4-test1", minimal, { "s1.mp3": "AUDIO" });
    writeExam("broken", { title: "no skills" });
    const list = listPastExams();
    expect(list.map((e) => e.id)).toEqual(["cam4-test1"]);
    expect(list[0].skills).toEqual(["listening"]);
  });

  it("loads a single exam manifest by id", () => {
    writeExam("cam4-test1", minimal);
    expect(getPastExam("cam4-test1")?.manifest.title).toBe("Sample — Test 1");
    expect(getPastExam("missing")).toBeUndefined();
  });

  it("returns empty when the directory does not exist", () => {
    process.env.EASYIELTS_PAST_EXAMS_DIR = join(dir, "nope");
    expect(listPastExams()).toEqual([]);
  });

  it("resolves a valid audio path inside the exam folder", () => {
    writeExam("cam4-test1", minimal, { "s1.mp3": "AUDIO" });
    const p = resolvePastExamAudioPath("cam4-test1", "s1.mp3");
    expect(p).toBe(join(dir, "cam4-test1", "s1.mp3"));
  });

  it("blocks path traversal and unsafe ids", () => {
    writeExam("cam4-test1", minimal, { "s1.mp3": "AUDIO" });
    expect(resolvePastExamAudioPath("cam4-test1", "../broken/manifest.json")).toBeNull();
    expect(resolvePastExamAudioPath("cam4-test1", "..\\..\\secret")).toBeNull();
    expect(resolvePastExamAudioPath("../etc", "s1.mp3")).toBeNull();
    expect(resolvePastExamAudioPath("cam4-test1", "missing.mp3")).toBeNull();
  });
});
