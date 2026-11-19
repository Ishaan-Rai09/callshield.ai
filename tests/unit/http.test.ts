import assert from "node:assert/strict";
import { test } from "node:test";
import { isSameOrigin } from "../../src/lib/server/http";

function request(origin?: string, host = "app.example"): Request {
  const headers: Record<string, string> = { host };
  if (origin) headers.origin = origin;
  return new Request("https://app.example/api/user/calls", { method: "POST", headers });
}

test("accepts a same-origin browser request", () => {
  assert.equal(isSameOrigin(request("https://app.example")), true);
});

test("rejects a cross-origin request", () => {
  assert.equal(isSameOrigin(request("https://evil.example")), false);
});

test("rejects a null origin", () => {
  assert.equal(isSameOrigin(request("null")), false);
});

test("allows non-browser clients without an Origin header", () => {
  assert.equal(isSameOrigin(request()), true);
});

test("rejects an Origin that is not a URL", () => {
  assert.equal(isSameOrigin(request("not a url")), false);
});

test("honours the forwarded host behind a trusted proxy", () => {
  const forwarded = new Request("https://app.example/api", {
    method: "POST",
    headers: { host: "internal:3000", "x-forwarded-host": "app.example", origin: "https://app.example" },
  });
  assert.equal(isSameOrigin(forwarded), true);
});
