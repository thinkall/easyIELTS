import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageAdapter } from "@/lib/storage/local";

beforeEach(() => localStorage.clear());

describe("LocalStorageAdapter", () => {
  it("saves and lists attempts (newest first)", () => {
    const store = new LocalStorageAdapter();
    store.saveAttempt({ id: "a", skill: "reading", testId: "t", title: "T", band: 6.5, createdAt: 1 });
    store.saveAttempt({ id: "b", skill: "listening", testId: "t2", title: "T2", band: 7, createdAt: 2 });
    const all = store.listAttempts();
    expect(all.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("clears all attempts", () => {
    const store = new LocalStorageAdapter();
    store.saveAttempt({ id: "a", skill: "reading", testId: "t", title: "T", band: 6, createdAt: 1 });
    store.clear();
    expect(store.listAttempts()).toEqual([]);
  });

  it("tolerates corrupt storage by returning an empty list", () => {
    localStorage.setItem("easyielts.attempts", "{not json");
    expect(new LocalStorageAdapter().listAttempts()).toEqual([]);
  });
});
