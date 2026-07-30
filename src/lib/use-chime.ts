"use client";

import { useCallback, useRef } from "react";

// Two-tone KDS chime. WebAudio needs a user gesture before it can start;
// Chrome may also hand back a suspended context, so resume() every play —
// otherwise the first pre-click chime silences the session forever.
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback((freqs: number[] = [880, 1174.66]) => {
    try {
      ctxRef.current ??= new AudioContext();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const t = ctx.currentTime;
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + i * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.15, t + i * 0.13 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.13 + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t + i * 0.13);
        osc.stop(t + i * 0.13 + 0.45);
      });
    } catch {
      // no gesture yet or audio unavailable — stay silent
    }
  }, []);
}
