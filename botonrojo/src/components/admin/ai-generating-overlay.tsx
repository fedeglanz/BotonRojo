"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const DEFAULT_MESSAGES = [
  "Leyendo el brief…",
  "Pensando como Claude…",
  "Eligiendo las palabras…",
  "Afinando el tono…",
  "Casi listo…",
];

/**
 * Drop inside any <form> whose action is a slow AI generation call — it reads
 * the same pending state as the submit button (useFormStatus needs a <form>
 * ancestor) and takes over the whole screen instead of just spinning a button.
 */
export function AiGeneratingOverlay({ messages = DEFAULT_MESSAGES }: { messages?: string[] }) {
  const { pending } = useFormStatus();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!pending) {
      setMessageIndex(0);
      return;
    }
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 1800);
    return () => clearInterval(id);
  }, [pending, messages.length]);

  if (!pending) return null;

  return (
    <div className="ai-reactor-backdrop" role="status" aria-live="polite">
      <div className="ai-reactor">
        <div className="ai-reactor__ring ai-reactor__ring--outer" aria-hidden />
        <div className="ai-reactor__ring" aria-hidden />
        <div className="ai-reactor__pulse-ring" aria-hidden />
        <div className="ai-reactor__core" aria-hidden />
      </div>
      <div className="ai-reactor-status">{messages[messageIndex]}</div>
    </div>
  );
}
