"use client";

import { useState } from "react";

type EmailItem = { subject: string; preheader?: string; body: string; ctaText?: string; ctaUrl?: string };
type SequenceBody = { emails: EmailItem[] };

export function EmailSequence({ body }: { body: SequenceBody | null }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!body || !body.emails?.length) {
    return (
      <p className="text-sm text-zinc-500">
        Aún no hay emails. Pulsa <em>Generar emails</em> para crear la secuencia según el tipo de lanzamiento.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {body.emails.map((e, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-black/30">
          <button
            type="button"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          >
            <div>
              <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                #{String(i + 1).padStart(2, "0")}
              </div>
              <div className="text-sm font-semibold text-white">{e.subject}</div>
              {e.preheader && <div className="text-xs text-zinc-500">{e.preheader}</div>}
            </div>
            <span className="text-zinc-500">{openIdx === i ? "−" : "+"}</span>
          </button>
          {openIdx === i && (
            <div className="border-t border-white/10 p-4 text-sm">
              <div
                className="prose prose-invert max-w-none text-zinc-300"
                dangerouslySetInnerHTML={{ __html: e.body }}
              />
              {e.ctaText && e.ctaUrl && (
                <a
                  href={e.ctaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-gradient-to-b from-[#ff3849] to-[#d4172a] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white"
                >
                  {e.ctaText}
                </a>
              )}
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(e.body)}
                className="ml-3 mt-3 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-400 transition hover:text-white"
              >
                Copiar HTML
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
