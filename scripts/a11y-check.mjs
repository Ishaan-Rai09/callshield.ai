// axe-core accessibility audit across public and signed-in routes.
//
//   node scripts/a11y-check.mjs
//
// Requires a running server and AUTH_SECRET. Fails on serious or critical
// violations; prints every violation with the failing selectors.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchBrowser } from "./browser.mjs";
import { addSessionCookie, createSessionToken, loadEnv } from "./test-session.mjs";

loadEnv();
const BASE = process.env.CALLSHIELD_URL || "http://localhost:3000";
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const PUBLIC_PAGES = [
  ["/", "landing"],
  ["/legal", "legal"],
  ["/signin", "sign-in"],
];
const APP_PAGES = [
  ["/app", "dashboard"],
  ["/app/live", "live screening"],
  ["/app/history", "history"],
  ["/app/blocklist", "blocklist"],
  ["/app/assistant", "assistant settings"],
  ["/app/settings", "settings"],
];

const browser = await launchBrowser();
const failures = [];

async function audit(page, path, label) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_200);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
  });

  const serious = result.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  const label2 = `${label} (${path})`;
  if (result.violations.length === 0) {
    console.log(`✓ ${label2}: no WCAG A/AA violations`);
    return;
  }
  for (const violation of result.violations) {
    console.log(
      `\n${serious.includes(violation) ? "✗" : "!"} ${label2}: ${violation.id} [${violation.impact}] ${violation.help}`
    );
    for (const node of violation.nodes.slice(0, 5)) {
      const check = node.any?.[0];
      const detail = check?.data
        ? `fg ${check.data.fgColor} on ${check.data.bgColor} (${check.data.contrastRatio}:1)`
        : (node.failureSummary?.split("\n")[0] ?? "");
      console.log(`    ${node.target.join(" ")} — ${detail}`);
    }
  }
  if (serious.length) failures.push(label2);
}

try {
  const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await guest.newPage();
  for (const [path, label] of PUBLIC_PAGES) await audit(page, path, label);
  await guest.close();

  const authed = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await addSessionCookie(
    authed,
    await createSessionToken({ uid: "a11y-check-user", email: "a11y@example.invalid" })
  );
  const app = await authed.newPage();
  for (const [path, label] of APP_PAGES) await audit(app, path, label);
  await authed.close();

  assert.deepEqual(failures, [], `Serious accessibility violations: ${failures.join(", ")}`);
  console.log("\nAccessibility audit passed (no serious/critical violations).");
} finally {
  await browser.close();
}
