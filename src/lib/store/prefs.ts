import type { AssistantSettings, NotificationItem } from "@/lib/types";

/**
 * Device-local preferences (assistant settings, notifications, phone label)
 * are namespaced per account so one user's callers never appear for another.
 */
const ACCOUNT_PREFS_KEY = "callshield.v1.account";

/** Pre-authentication demo blob from older builds — removed on sign-in. */
const LEGACY_STORAGE_KEY = "callshield.v1";

export interface PersistedPrefs {
  assistant: AssistantSettings;
  notifications: NotificationItem[];
  phone: string;
}

function prefsKey(userId: string): string {
  return `${ACCOUNT_PREFS_KEY}.${userId}`;
}

/** Read a user's preferences, tolerating absent or malformed storage. */
export function loadPrefs(userId: string): Partial<PersistedPrefs> {
  try {
    const raw = window.localStorage.getItem(prefsKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedPrefs> | null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist preferences; private mode or a full quota leaves state in memory. */
export function savePrefs(userId: string, prefs: PersistedPrefs): void {
  try {
    window.localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
  } catch {
    // Storage is an enhancement, not a requirement, for the signed-in session.
  }
}

/** Drop the pre-auth blob left behind by older builds. */
export function clearLegacyPrefs(): void {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
