import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { upsertEnvVar, removeEnvVar, _envFilePathFor } from "@/server/env-file";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-env-"));
  delete process.env.FOO_KEY;
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.FOO_KEY;
});

describe("env-file", () => {
  it("updates an existing key in place, preserving other lines and comments", () => {
    const file = join(dir, ".env");
    writeFileSync(file, "# comment\nFOO_KEY=old\nBAR=keep\n");
    upsertEnvVar("FOO_KEY", "new", dir);
    expect(readFileSync(file, "utf8")).toBe("# comment\nFOO_KEY=new\nBAR=keep\n");
  });

  it("appends a new key when absent and mirrors it into process.env", () => {
    const file = join(dir, ".env");
    writeFileSync(file, "BAR=keep\n");
    upsertEnvVar("FOO_KEY", "abc", dir);
    const out = readFileSync(file, "utf8");
    expect(out).toContain("BAR=keep");
    expect(out).toContain("FOO_KEY=abc");
    expect(process.env.FOO_KEY).toBe("abc");
  });

  it("creates .env when neither .env.local nor .env exists", () => {
    upsertEnvVar("FOO_KEY", "v", dir);
    expect(existsSync(join(dir, ".env"))).toBe(true);
    expect(readFileSync(join(dir, ".env"), "utf8")).toContain("FOO_KEY=v");
  });

  it("prefers .env.local when it exists", () => {
    writeFileSync(join(dir, ".env"), "FOO_KEY=fromenv\n");
    writeFileSync(join(dir, ".env.local"), "FOO_KEY=fromlocal\n");
    expect(_envFilePathFor(dir)).toBe(join(dir, ".env.local"));
    upsertEnvVar("FOO_KEY", "updated", dir);
    expect(readFileSync(join(dir, ".env.local"), "utf8")).toBe("FOO_KEY=updated\n");
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe("FOO_KEY=fromenv\n");
  });

  it("removes a key and clears it from process.env", () => {
    const file = join(dir, ".env");
    writeFileSync(file, "FOO_KEY=secret\nBAR=keep\n");
    process.env.FOO_KEY = "secret";
    removeEnvVar("FOO_KEY", dir);
    expect(readFileSync(file, "utf8")).toBe("BAR=keep\n");
    expect(process.env.FOO_KEY).toBeUndefined();
  });

  it("removeEnvVar is a no-op when the key is absent", () => {
    const file = join(dir, ".env");
    writeFileSync(file, "BAR=keep\n");
    removeEnvVar("FOO_KEY", dir);
    expect(readFileSync(file, "utf8")).toBe("BAR=keep\n");
  });
});
