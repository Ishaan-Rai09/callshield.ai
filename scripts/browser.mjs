import { existsSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Portable browser launcher.
 *
 * Priority:
 *   1. CHROME_EXECUTABLE_PATH (preferred) or legacy CHROME_PATH.
 *   2. An installed Chrome on local Windows (keeps the existing workflow).
 *   3. Playwright-managed Chromium — installed with `npx playwright install chromium`.
 *
 * CI uses (3); no browser binaries are ever committed.
 */

const WINDOWS_CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}/Google/Chrome/Application/chrome.exe`,
];

export function browserExecutable() {
  const override = process.env.CHROME_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (override) return override;
  if (process.platform === "win32") {
    return WINDOWS_CHROME_PATHS.find((candidate) => candidate && existsSync(candidate));
  }
  return undefined;
}

export async function launchBrowser() {
  const executablePath = browserExecutable();
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}
