"use client";

import { createContext, useContext } from "react";
import type { CallShieldContextValue } from "./types";

export const CallShieldContext = createContext<CallShieldContextValue | null>(null);

/** Access the signed-in account, call history, and live-call controls. */
export function useCallShield(): CallShieldContextValue {
  const context = useContext(CallShieldContext);
  if (!context) throw new Error("useCallShield must be used inside CallShieldProvider");
  return context;
}
