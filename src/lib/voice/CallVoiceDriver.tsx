"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCallShield } from "@/lib/store";
import { useVoice } from "@/lib/voice/VoiceProvider";
import { callerVoiceFor, defaultAssistantVoice } from "@/lib/voice/catalog";

/**
 * Drives call audio from the live session transcript.
 *
 * While a line is being spoken the store holds back new script steps, so the
 * conversation is paced by the voices instead of racing ahead of the audio.
 * If Gnani is not configured (or playback fails) the driver releases the hold
 * and the call continues in captions-only mode.
 */
export function CallVoiceDriver() {
  const { session, assistant, setSpeechHold } = useCallShield();
  const voice = useVoice();
  const stopVoice = voice.stop;
  const speak = voice.speak;
  const spokenRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<string | null>(null);
  const holdRef = useRef(false);

  const setHold = useCallback(
    (next: boolean) => {
      if (holdRef.current === next) return;
      holdRef.current = next;
      setSpeechHold(next);
    },
    [setSpeechHold],
  );

  const voiceActive =
    voice.configured && voice.available && voice.enabled && assistant.voiceEnabled;

  const voiceName = defaultAssistantVoice(assistant);
  const transcript = session?.transcript;
  const phase = session?.phase;
  const scenarioId = session?.scenarioId;
  const sessionId = session?.id;

  // New session: reset spoken lines and silence any previous call.
  useEffect(() => {
    if (sessionId === sessionRef.current) return;
    sessionRef.current = sessionId ?? null;
    spokenRef.current = new Set();
    stopVoice();
    setHold(false);
  }, [sessionId, stopVoice, setHold]);

  // Taking over or ending the call stops the assistant mid-sentence.
  useEffect(() => {
    if (!sessionId) return;
    if (phase === "user" || phase === "ended" || phase === "ringing") {
      stopVoice();
      setHold(false);
    }
  }, [phase, sessionId, stopVoice, setHold]);

  // Speak each newly revealed caller / assistant line, one at a time.
  useEffect(() => {
    if (!transcript || (phase !== "screening" && phase !== "user")) {
      setHold(false);
      return;
    }
    if (!voiceActive) {
      setHold(false);
      return;
    }

    const entry = transcript.find(
      (line) =>
        (line.speaker === "ai" || line.speaker === "caller") && !spokenRef.current.has(line.id),
    );

    if (!entry) {
      setHold(false);
      return;
    }

    spokenRef.current.add(entry.id);
    setHold(true);

    const speaker = entry.speaker === "ai" ? voiceName : callerVoiceFor(scenarioId ?? "");
    void speak(entry.text, { voice: speaker, lineId: entry.id })
      .catch(() => {
        // Error state is surfaced by the voice provider; keep the call moving.
      })
      .finally(() => {
        setHold(false);
      });
  }, [transcript, phase, voiceActive, voiceName, scenarioId, speak, setHold]);

  useEffect(() => {
    return () => {
      holdRef.current = false;
    };
  }, []);

  return null;
}
