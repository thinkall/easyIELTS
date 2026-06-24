import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listAudios, listAudioFolders, resolveAudioPath } from "@/server/audios";
import { GET } from "@/app/api/audios/file/route";

let dir: string;

function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-audios-"));
  process.env.EASYIELTS_AUDIOS_DIR = dir;
});
afterEach(() => {
  delete process.env.EASYIELTS_AUDIOS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

function req(name: string, range?: string) {
  return new Request(`http://x/api/audios/file?name=${encodeURIComponent(name)}`, {
    headers: range ? { range } : {},
  });
}

describe("audios loader", () => {
  it("lists audio files recursively, ignoring non-audio files", () => {
    write("book4/01.Test1.Section1.mp3", "AAAA");
    write("book4/02.Test1.Section2.mp3", "BBBB");
    write("book5/01.section1.m4a", "CCCC");
    write("readme.txt", "ignore");
    const tracks = listAudios();
    expect(tracks.map((t) => t.path)).toEqual([
      "book4/01.Test1.Section1.mp3",
      "book4/02.Test1.Section2.mp3",
      "book5/01.section1.m4a",
    ]);
    expect(tracks[0].folder).toBe("book4");
    expect(tracks[0].name).toBe("01.Test1.Section1.mp3");
  });

  it("groups tracks by folder", () => {
    write("book4/a.mp3", "A");
    write("book5/b.m4a", "B");
    const folders = listAudioFolders();
    expect(folders.map((f) => f.folder)).toEqual(["book4", "book5"]);
    expect(folders[0].tracks).toHaveLength(1);
  });

  it("returns empty when the directory does not exist", () => {
    process.env.EASYIELTS_AUDIOS_DIR = join(dir, "nope");
    expect(listAudios()).toEqual([]);
  });

  it("resolves a valid nested path and blocks traversal / non-audio", () => {
    write("book4/a.mp3", "A");
    expect(resolveAudioPath("book4/a.mp3")).toBe(join(dir, "book4", "a.mp3"));
    expect(resolveAudioPath("../a.mp3")).toBeNull();
    expect(resolveAudioPath("book4/../../etc.mp3")).toBeNull();
    expect(resolveAudioPath("book4/a.txt")).toBeNull();
    expect(resolveAudioPath("book4/missing.mp3")).toBeNull();
  });
});

describe("GET /api/audios/file", () => {
  it("serves an audio file with the right type and Accept-Ranges", async () => {
    write("book4/a.mp3", "AUDIODATA");
    const res = await GET(req("book4/a.mp3"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(await res.text()).toBe("AUDIODATA");
  });

  it("supports Range requests with 206 partial content", async () => {
    write("book4/a.mp3", "0123456789");
    const res = await GET(req("book4/a.mp3", "bytes=2-5"));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(res.headers.get("content-length")).toBe("4");
    expect(await res.text()).toBe("2345");
  });

  it("404s for traversal or a missing file", async () => {
    write("book4/a.mp3", "A");
    expect((await GET(req("../a.mp3"))).status).toBe(404);
    expect((await GET(req("book4/missing.mp3"))).status).toBe(404);
  });
});
