import type {
  AssistantSettings,
  BlockedNumber,
  CallRecord,
  LiveSession,
  NotificationItem,
  Profile,
} from "@/lib/types";

export type ToastTone = "success" | "risk" | "neutral";

export type AccountStatus = "loading" | "google";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** The value exposed by {@link useCallShield}. */
export interface CallShieldContextValue {
  hydrated: boolean;
  /** "loading" while the session resolves; "google" once signed in. */
  accountStatus: AccountStatus;
  /** The signed-in Google account, or null while loading. */
  account: Account | null;
  calls: CallRecord[];
  blocklist: BlockedNumber[];
  notifications: NotificationItem[];
  unreadCount: number;
  assistant: AssistantSettings;
  profile: Profile;
  session: LiveSession | null;
  toasts: Toast[];
  /** Held while call audio is playing so scripted lines stay in sync with the voices. */
  setSpeechHold: (hold: boolean) => void;
  startSimulation: (scenarioId: string) => boolean;
  answerWithAI: () => void;
  declineCall: () => void;
  takeOver: () => void;
  sendUserMessage: (text: string) => void;
  allowCaller: () => void;
  endCall: () => void;
  blockCaller: () => void;
  dismissSession: () => void;
  addBlockedNumber: (input: {
    number: string;
    label: string;
    reason: string;
    source?: "manual" | "call";
  }) => boolean;
  removeBlockedNumber: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateAssistant: (patch: Partial<AssistantSettings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  resetDemoData: () => void;
  seedHistory: () => void;
  clearHistory: () => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}
