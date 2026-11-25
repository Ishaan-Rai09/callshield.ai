// Provider-free browser smoke test used by CI.
//
//   node scripts/smoke-check.mjs
//
// Requires a running server and AUTH_SECRET (set in the environment or
// .env.local). No MongoDB, Google, or Gnani credentials are needed: the signed
// session is a locally encoded test token and the app is expected to fall back
// to empty data when the database is absent.
import assert from "node:assert/strict";
import { launchBrowser } from "./browser.mjs";
import { addSessionCookie, createSessionToken, loadEnv } from "./test-session.mjs";

loadEnv();
const BASE = process.env.CALLSHIELD_URL || "http://localhost:3000";
const step = (name) => console.log(`\n✓ ${name}`);

const browser = await launchBrowser();
try {
  /* ------------------------------ public site ----------------------------- */
  const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await guest.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const home = await page.goto(BASE, { waitUntil: "networkidle" });
  assert.ok(home, "homepage did not load");
  assert.equal(home.status(), 200);
  await page.getByRole("heading", { name: /Not every call deserves/ }).waitFor();
  step("Landing page renders");

  const headers = home.headers();
  assert.match(headers["content-security-policy"] ?? "", /frame-ancestors 'none'/);
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-powered-by"], undefined);
  step("Security headers present on the homepage");

  await page.goto(`${BASE}/legal`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  step("Legal page renders");

  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Continue with Google/ }).waitFor();
  step("Sign-in page renders");

  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForURL("**/signin", { timeout: 20_000 });
  step("Signed-out /app redirects to /signin");

  await guest.close();

  /* --------------------------- authenticated shell ------------------------ */
  const uid = `smoke-${Date.now().toString(36)}`;
  const authed = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await addSessionCookie(authed, await createSessionToken({ uid, email: "smoke@example.invalid" }));
  const app = await authed.newPage();
  app.on("pageerror", (error) => errors.push(error.message));

  await app.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await app.getByRole("heading", { name: "Your line, under control." }).waitFor();
  step("Authenticated dashboard renders");

  await app.goto(`${BASE}/app/live`, { waitUntil: "networkidle" });
  await app.getByRole("heading", { level: 1 }).first().waitFor();
  step("Live screening route renders");

  await app.goto(`${BASE}/app/history`, { waitUntil: "networkidle" });
  await app.getByRole("heading", { name: /Every screened call/ }).waitFor();
  step("History route renders");

  await app.goto(`${BASE}/app/settings`, { waitUntil: "networkidle" });
  await app.getByRole("heading", { name: /Your account, your data/ }).waitFor();
  step("Settings route renders");

  const mobile = await authed.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Open navigation menu" }).click();
  await mobile.getByRole("link", { name: "AI Assistant" }).last().waitFor();
  step("Mobile drawer navigation works");

  const manifest = await app.evaluate(async () => {
    const response = await fetch("/manifest.webmanifest");
    return response.json();
  });
  assert.ok(manifest.name.includes("CallShield"));
  step("PWA manifest is served");

  if (errors.length) {
    console.log("\nBrowser errors:");
    for (const error of errors) console.log(` - ${error}`);
    throw new Error(`${errors.length} browser error(s) captured`);
  }

  console.log("\nAll smoke checks passed.");
} finally {
  await browser.close();
}
