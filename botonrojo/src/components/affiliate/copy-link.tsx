"use client";

import { useState } from "react";

export function CopyLink({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs text-zinc-300 transition hover:border-[var(--color-red)] hover:text-white"
    >
      <span className="max-w-[28rem] truncate">{label ?? url}</span>
      <span className={copied ? "text-emerald-400" : "text-zinc-500"}>
        {copied ? "✓ copiado" : "Copiar"}
      </span>
    </button>
  );
}
