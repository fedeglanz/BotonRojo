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
  approved?: boolean;
};

type SequenceBody = { emails: EmailItem[] };

type BrandKit = {
  logoUrl?: string | null;
  palette?: { primary: string; accent: string; background: string; foreground: string } | null;
  fonts?: { display: string; body: string } | null;
};

type Props = {
  launchId: string;
  body: SequenceBody | null;
  brand?: BrandKit | null;
  refineAction: (launchId: string, emailIndex: number, formData: FormData) => Promise<void>;
  updateAction: (launchId: string, emailIndex: number, formData: FormData) => Promise<void>;
  approveAction: (launchId: string, emailIndex: number, approved: boolean) => Promise<void>;
  approveAllAction: (launchId: string) => Promise<void>;
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

export function EmailEditor({
  launchId,
  body,
  brand,
  refineAction,
  updateAction,
  approveAction,
  approveAllAction,
}: Props) {
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

  const approvedCount = body.emails.filter((e) => e.approved).length;
  const allApproved = approvedCount === body.emails.length;
  const primary = brand?.palette?.primary ?? "#e63946";

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-2">
        <div className="text-xs text-zinc-400">
          {approvedCount}/{body.emails.length} aprobados
          {allApproved && (
            <span className="ml-2 text-emerald-400">— Listos para enviar a AC</span>
          )}
        </div>
        {!allApproved && (
          <form action={approveAllAction.bind(null, launchId)}>
            <SubmitButton variant="ghost" pendingLabel="Aprobando...">
              Aprobar todos
            </SubmitButton>
          </form>
        )}
      </div>

      {body.emails.map((email, i) => {
        const isApproved = email.approved === true;
        return (
          <div
            key={i}
            className={`rounded-lg border bg-black/30 ${
              isApproved ? "border-emerald-500/30" : "border-white/10"
            }`}
          >
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
                  {isApproved && (
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-400">
                      Aprobado
                    </span>
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
                {/* Tabs + approve button */}
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
                  <div className="flex gap-1">
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
                  <form action={approveAction.bind(null, launchId, i, !isApproved)}>
                    <SubmitButton
                      variant={isApproved ? "outline" : "primary"}
                      pendingLabel={isApproved ? "Desaprobando..." : "Aprobando..."}
                    >
                      {isApproved ? "Desaprobar" : "Aprobar"}
                    </SubmitButton>
                  </form>
                </div>

                {/* Preview tab — branded */}
                {getMode(i) === "preview" && (
                  <div className="p-4">
                    <div
                      className="mx-auto max-w-xl overflow-hidden rounded-lg border border-white/10"
                      style={{ backgroundColor: brand?.palette?.background ?? "#ffffff" }}
                    >
                      {/* Logo */}
                      {brand?.logoUrl && (
                        <div className="py-6 text-center">
                          <img
                            src={brand.logoUrl}
                            alt=""
                            className="mx-auto h-10 max-w-[180px] object-contain"
                          />
                        </div>
                      )}
                      {/* Subject bar */}
                      <div
                        className="border-b px-6 py-3"
                        style={{
                          borderColor: `${brand?.palette?.foreground ?? "#1a1a1a"}15`,
                          color: brand?.palette?.foreground ?? "#1a1a1a",
                        }}
                      >
                        <div className="text-xs opacity-50">Asunto:</div>
                        <div
                          className="text-sm font-semibold"
                          style={{ fontFamily: brand?.fonts?.display ?? "Arial, sans-serif" }}
                        >
                          {email.subject}
                        </div>
                        {email.preheader && (
                          <div className="mt-1 text-xs opacity-40">{email.preheader}</div>
                        )}
                      </div>
                      {/* Body */}
                      <div
                        className="px-6 py-5"
                        style={{
                          color: brand?.palette?.foreground ?? "#1a1a1a",
                          fontFamily: brand?.fonts?.body ?? "Arial, sans-serif",
                          fontSize: "15px",
                          lineHeight: "1.6",
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: email.body }} />
                      </div>
                      {/* CTA */}
                      {email.ctaText && (
                        <div className="px-6 pb-6 text-center">
                          <span
                            className="inline-block rounded-md px-7 py-3 text-xs font-bold uppercase tracking-widest text-white"
                            style={{
                              backgroundColor: primary,
                              fontFamily: brand?.fonts?.display ?? "Arial, sans-serif",
                            }}
                          >
                            {email.ctaText}
                          </span>
                        </div>
                      )}
                      {/* Footer */}
                      <div
                        className="border-t px-6 py-4 text-center text-[11px] opacity-40"
                        style={{ borderColor: `${brand?.palette?.foreground ?? "#1a1a1a"}10` }}
                      >
                        Cancelar suscripcion
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
                    <form action={refineAction.bind(null, launchId, i)} className="space-y-3">
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
                    <form action={updateAction.bind(null, launchId, i)} className="space-y-3">
                      <label className="block">
                        <span className="block text-xs uppercase tracking-widest text-zinc-400">Asunto</span>
                        <input
                          name="subject"
                          type="text"
                          defaultValue={email.subject}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs uppercase tracking-widest text-zinc-400">Preheader</span>
                        <input
                          name="preheader"
                          type="text"
                          defaultValue={email.preheader ?? ""}
                          maxLength={90}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs uppercase tracking-widest text-zinc-400">Body (HTML)</span>
                        <textarea
                          name="body"
                          rows={12}
                          defaultValue={email.body}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-[var(--color-red)]"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs uppercase tracking-widest text-zinc-400">Texto del CTA</span>
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
        );
      })}
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
        active ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
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
