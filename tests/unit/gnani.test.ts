import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DEFAULT_TTS_MODEL, gnaniConfig } from "../../src/lib/server/gnani";

// NODE_ENV is typed as readonly by @types/node; tests need to toggle it.
const env = process.env as Record<string, string | undefined>;

const original = {
  key: process.env.GNANI_API_KEY,
  base: process.env.GNANI_BASE_URL,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  if (original.key === undefined) delete process.env.GNANI_API_KEY;
  else process.env.GNANI_API_KEY = original.key;
  if (original.base === undefined) delete process.env.GNANI_BASE_URL;
  else process.env.GNANI_BASE_URL = original.base;
  env.NODE_ENV = original.nodeEnv;
});

test("reports unconfigured without a key", () => {
  delete process.env.GNANI_API_KEY;
  const config = gnaniConfig();
  assert.equal(config.configured, false);
  assert.equal(config.ttsModel, DEFAULT_TTS_MODEL);
});

test("rejects a javascript: base URL", () => {
  process.env.GNANI_API_KEY = "test-key";
  process.env.GNANI_BASE_URL = "javascript:alert(1)";
  const config = gnaniConfig();
  assert.equal(config.baseUrlValid, false);
  assert.equal(config.configured, false);
});

test("rejects embedded credentials in the base URL", () => {
  process.env.GNANI_API_KEY = "test-key";
  process.env.GNANI_BASE_URL = "https://user:pass@api.example";
  assert.equal(gnaniConfig().configured, false);
});

test("rejects plain http in production", () => {
  env.NODE_ENV = "production";
  process.env.GNANI_API_KEY = "test-key";
  process.env.GNANI_BASE_URL = "http://api.example";
  assert.equal(gnaniConfig().configured, false);
});

test("accepts a clean https base URL and strips trailing slashes", () => {
  process.env.GNANI_API_KEY = "test-key";
  process.env.GNANI_BASE_URL = "https://api.example/";
  const config = gnaniConfig();
  assert.equal(config.configured, true);
  assert.equal(config.baseUrl, "https://api.example");
});
