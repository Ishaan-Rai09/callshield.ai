import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clearLegacyPrefs, loadPrefs, savePrefs } from "../../src/lib/store/prefs";
import { DEFAULT_ASSISTANT } from "../../src/lib/seed";

class MemoryStorage {
  private entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

const storage = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: storage };

beforeEach(() => storage.clear());

test("round-trips preferences per account", () => {
  savePrefs("user-a", {
    assistant: DEFAULT_ASSISTANT,
    notifications: [],
    phone: "+91 90000 00000",
  });
  const prefs = loadPrefs("user-a");
  assert.equal(prefs.phone, "+91 90000 00000");
  assert.deepEqual(prefs.assistant, DEFAULT_ASSISTANT);

  assert.deepEqual(loadPrefs("user-b"), {}, "accounts must not share preferences");
});

test("returns empty preferences when storage holds malformed JSON", () => {
  storage.setItem("callshield.v1.account.user-a", "{not json");
  assert.deepEqual(loadPrefs("user-a"), {});
});

test("ignores absent storage entries", () => {
  assert.deepEqual(loadPrefs("missing"), {});
});

test("removes the legacy pre-authentication blob", () => {
  storage.setItem("callshield.v1", "{}");
  clearLegacyPrefs();
  assert.equal(storage.getItem("callshield.v1"), null);
});
