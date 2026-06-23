import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readVisitCount, incrementVisitCount, _visitsFilePath } from "@/server/visit-counter";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-visits-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("visit-counter", () => {
  it("reads 0 when no file exists yet", () => {
    expect(readVisitCount(dir)).toBe(0);
  });

  it("increments and persists across reads (survives a 'restart')", () => {
    expect(incrementVisitCount(dir)).toBe(1);
    expect(incrementVisitCount(dir)).toBe(2);
    // A fresh read (as if the process restarted) sees the persisted value.
    expect(readVisitCount(dir)).toBe(2);
  });

  it("writes the count to data/visits.json", () => {
    incrementVisitCount(dir);
    const raw = readFileSync(_visitsFilePath(dir), "utf8");
    expect(JSON.parse(raw).count).toBe(1);
  });

  it("treats a corrupt file as 0 and recovers on next increment", () => {
    mkdirSync(join(dir, "data"), { recursive: true });
    writeFileSync(_visitsFilePath(dir), "not json", "utf8");
    expect(readVisitCount(dir)).toBe(0);
    expect(incrementVisitCount(dir)).toBe(1);
  });
});
