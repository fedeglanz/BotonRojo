"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";

type EmailItem = {
  subject: string;
  preheader?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  phase?: string;
  timing?: string;
  sendOffsetDays?: number;
};

type SequenceBody = { emails: EmailItem[] };

type Props = {
  launchId: string;
  body: SequenceBody | null;
  refineAction: (launchId: string, emailIndex: number, formData: FormData) => Promise<void>;
  updateAction: (launchId: string, emailIndex: number, formData: FormData) => Promise<void>;
};

const SUGGESTIONS = [
  "Hazlo mas urgente",
  "Mas emocional, conecta con el dolor",
  "Acorta el texto, que sea mas directo",
  "Agrega un PS al final",
  "Cambia el asunto para mayor apertura",
  "Hazlo mas personal, en primera persona",
  "Agrega prueba social o datos concretos",
];

export function EmailEditor({ launchId, body, refineAction, updateAction }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [mode, setMode] = useState<Record<number, "preview" | "ai" | "html">>({});

  if (!body || !body.emails?.length) {
    return (
      <p className="text-sm text-zinc-500">
        Aun no hay emails. Pulsa <em>Generar emails</em> para crear la secuencia segun el tipo de lanzamiento.
      </p>
    );
  }

  const getMode = (i: number) => mode[i] ?? "preview";
  const setModeFor = (i: number, m: "preview" | "ai" | "html") =>
    setMode((prev) => ({ ...prev, [i]: m }));

  return (
    <div className="space-y-2">
      {body.emails.map((email, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-black/30">
          {/* Header — always visible */}
          <button
            type="button"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                  #{String(i + 1).padStart(2, "0")}
                </span>
                {email.phase && (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                    {email.phase}
                  </span>
                )}
                {email.timing && (
                  <span className="text-[10px] text-zinc-600">{email.timing}</span>
                )}
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-white">
                {email.subject}
              </div>
              {email.preheader && (
                <div className="truncate text-xs text-zinc-500">{email.preheader}</div>
              )}
            </div>
            <span className="shrink-0 text-zinc-500">{openIdx === i ? "−" : "+"}</span>
          </button>

          {/* Expanded content */}
          {openIdx === i && (
            <div className="border-t border-white/10">
              {/* Tabs */}
              <div className="flex gap-1 border-b border-white/5 px-4 py-2">
                <TabButton active={getMode(i) === "preview"} onClick={() => setModeFor(i, "preview")}>
                  Preview
                </TabButton>
                <TabButton active={getMode(i) === "ai"} onClick={() => setModeFor(i, "ai")}>
                  ✨ IA
                </TabButton>
                <TabButton active={getMode(i) === "html"} onClick={() => setModeFor(i, "html")}>
                  Editar
                </TabButton>
              </div>

              {/* Preview tab */}
              {getMode(i) === "preview" && (
                <div className="p-4">
                  {/* Email preview card */}
                  <div className="mx-auto max-w-xl rounded-lg border border-white/10 bg-white/[0.02]">
                    <div className="border-b border-white/10 px-4 py-3">
                      <div className="text-xs text-zinc-500">Asunto:</div>
                      <div className="text-sm font-semibold text-white">{email.subject}</div>
                      {email.preheader && (
                        <div className="mt-1 text-xs text-zinc-500">{email.preheader}</div>
                      )}
                    </div>
                    <div className="px-4 py-4">
                      <div
                        className="prose prose-invert prose-sm max-w-none text-zinc-300"
                        dangerouslySetInnerHTML={{ __html: email.body }}
                      />
                      {email.ctaText && (
                        <div className="mt-4">
                          <span className="inline-flex rounded-full bg-gradient-to-b from-[#ff3849] to-[#d4172a] px-5 py-2 text-xs font-bold uppercase tracking-widest text-white">
                            {email.ctaText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(email.body)}
                      className="inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-400 transition hover:text-white"
                    >
                      Copiar HTML
                    </button>
                  </div>
                </div>
              )}

              {/* AI refine tab */}
              {getMode(i) === "ai" && (
                <div className="space-y-4 p-4">
                  <form
                    action={refineAction.bind(null, launchId, i)}
                    className="space-y-3"
                  >
                    <label className="block">
                      <span className="block text-xs uppercase tracking-widest text-zinc-400">
                        Decile a Claude que cambiar en este email
                      </span>
                      <textarea
                        name="instruction"
                        rows={3}
                        required
                        minLength={3}
                        placeholder="Ej: Hazlo mas urgente, agrega escasez"
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <SuggestionChip key={s} label={s} />
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <SubmitButton variant="ghost" pendingLabel="Refinando...">
                        Refinar con Claude
                      </SubmitButton>
                    </div>
                  </form>
                </div>
              )}

              {/* Manual edit tab */}
              {getMode(i) === "html" && (
                <div className="p-4">
                  <form
                    action={updateAction.bind(null, launchId, i)}
                    className="space-y-3"
                  >
                    <label className="block">
                      <span className="block text-xs uppercase tracking-widest text-zinc-400">
                        Asunto
                      </span>
                      <input
                        name="subject"
                        type="text"
                        defaultValue={email.subject}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-xs uppercase tracking-widest text-zinc-400">
                        Preheader
                      </span>
                      <input
                        name="preheader"
                        type="text"
                        defaultValue={email.preheader ?? ""}
                        maxLength={90}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-xs uppercase tracking-widest text-zinc-400">
                        Body (HTML)
                      </span>
                      <textarea
                        name="body"
                        rows={12}
                        defaultValue={email.body}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-[var(--color-red)]"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-xs uppercase tracking-widest text-zinc-400">
                        Texto del CTA
                      </span>
                      <input
                        name="ctaText"
                        type="text"
                        defaultValue={email.ctaText ?? ""}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
                      />
                    </label>

                    <div className="flex justify-end">
                      <SubmitButton variant="ghost" pendingLabel="Guardando...">
                        Guardar cambios
                      </SubmitButton>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs transition ${
        active
          ? "bg-white/10 text-white"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function SuggestionChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition hover:border-white/30 hover:text-white"
      onClick={(e) => {
        const form = e.currentTarget.closest("form");
        const textarea = form?.querySelector("textarea[name=instruction]") as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = label;
          textarea.focus();
        }
      }}
    >
      {label}
    </button>
  );
}
