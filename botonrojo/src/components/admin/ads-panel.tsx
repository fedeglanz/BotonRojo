"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";
import { AD_HARD_LIMITS, AD_SOFT_LIMITS, findHardLimitIssues, type AdsBody } from "./ads-types";

type Tab = "meta" | "google" | "statics" | "video";

const TABS: { key: Tab; label: string }[] = [
  { key: "meta", label: "Meta" },
  { key: "google", label: "Google Search" },
  { key: "statics", label: "Estáticos" },
  { key: "video", label: "Vídeo" },
];

/**
 * Character counter that distinguishes the two kinds of limit: `hard` means
 * the platform rejects the ad (red), `soft` means it just gets truncated in
 * the feed (amber). Conflating them would either cry wolf or hide a rejection.
 */
function CopyField({
  label,
  value,
  limit,
  kind = "hard",
}: {
  label: string;
  value?: string;
  limit?: number;
  kind?: "hard" | "soft";
}) {
  if (!value) return null;
  const over = limit !== undefined && value.length > limit;
  const tone = !over ? "text-zinc-600" : kind === "hard" ? "text-red-400" : "text-amber-400";
  const textTone = !over ? "text-zinc-200" : kind === "hard" ? "text-red-300" : "text-amber-200";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
        {limit !== undefined && (
          <span
            className={`font-[family-name:var(--font-mono)] text-[10px] ${tone}`}
            title={kind === "hard" ? "Límite duro: por encima, la plataforma rechaza el anuncio" : "Recomendado: por encima, se corta en el feed"}
          >
            {value.length}/{limit}
            {over && (kind === "hard" ? " ⚠" : " ·")}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-sm ${textTone}`}>{value}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-white/20 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-widest text-zinc-200 transition hover:border-white/40 hover:bg-white/10"
    >
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function Card({ title, copyText, children }: { title: string; copyText?: string; children: React.ReactNode }) {
  return (
    <div className="glass space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">{title}</div>
        {copyText && <CopyButton text={copyText} />}
      </div>
      {children}
    </div>
  );
}

type PanelProps = {
  body: AdsBody | null;
  launchId: string;
  fixLengthsAction: (launchId: string) => Promise<void>;
};

export function AdsPanel({ body, launchId, fixLengthsAction }: PanelProps) {
  const [tab, setTab] = useState<Tab>("meta");

  if (!body) {
    return <p className="text-sm text-zinc-500">Aún no se han generado anuncios.</p>;
  }

  const hardIssues = findHardLimitIssues(body);

  return (
    <div className="space-y-4">
      {hardIssues.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <div className="text-sm text-red-200">
            {hardIssues.length} {hardIssues.length === 1 ? "campo supera" : "campos superan"} el límite duro de la
            plataforma — se rechazarían al subirlos.
          </div>
          <form action={fixLengthsAction.bind(null, launchId)}>
            <SubmitButton variant="ghost" pendingLabel="Acortando…">
              Acortar con Claude
            </SubmitButton>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/40 p-1 text-xs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md border px-2.5 py-1 transition ${
              tab === t.key
                ? "border-white/25 bg-white/20 text-white"
                : "border-transparent bg-white/[0.05] text-zinc-300 hover:border-white/15 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "meta" && (
        <div className="grid gap-3 lg:grid-cols-3">
          {(body.metaCopy ?? []).map((c, i) => (
            <Card
              key={i}
              title={`Variante ${i + 1}`}
              copyText={[c.headline, c.primaryText, c.description].filter(Boolean).join("\n\n")}
            >
              <CopyField label="Titular" value={c.headline} limit={AD_HARD_LIMITS.metaHeadline} />
              <CopyField label="Primary text" value={c.primaryText} limit={AD_SOFT_LIMITS.metaPrimaryText} kind="soft" />
              <CopyField label="Descripción" value={c.description} />
            </Card>
          ))}
          {(body.metaCopy ?? []).length === 0 && <p className="text-sm text-zinc-500">Sin copy de Meta.</p>}
        </div>
      )}

      {tab === "google" && (
        <div className="grid gap-3 lg:grid-cols-3">
          {(body.googleCopy ?? []).map((c, i) => (
            <Card
              key={i}
              title={`Variante ${i + 1}`}
              copyText={[c.headline1, c.headline2, c.headline3, c.description1, c.description2]
                .filter(Boolean)
                .join("\n")}
            >
              <CopyField label="Titular 1" value={c.headline1} limit={AD_HARD_LIMITS.googleHeadline} />
              <CopyField label="Titular 2" value={c.headline2} limit={AD_HARD_LIMITS.googleHeadline} />
              <CopyField label="Titular 3" value={c.headline3} limit={AD_HARD_LIMITS.googleHeadline} />
              <CopyField label="Descripción 1" value={c.description1} limit={AD_HARD_LIMITS.googleDescription} />
              <CopyField label="Descripción 2" value={c.description2} limit={AD_HARD_LIMITS.googleDescription} />
            </Card>
          ))}
          {(body.googleCopy ?? []).length === 0 && <p className="text-sm text-zinc-500">Sin copy de Google.</p>}
        </div>
      )}

      {tab === "statics" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {(body.statics ?? []).map((s, i) => (
            <Card key={i} title={s.concept ?? `Concepto ${i + 1}`}>
              <CopyField label="Titular" value={s.headline} limit={AD_SOFT_LIMITS.staticHeadline} kind="soft" />
              <CopyField label="Apoyo" value={s.subheadline} limit={AD_SOFT_LIMITS.staticSubheadline} kind="soft" />
              <CopyField label="CTA" value={s.ctaLabel} limit={AD_SOFT_LIMITS.staticCta} kind="soft" />
              {s.template && (
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Plantilla: {s.template}</div>
              )}
            </Card>
          ))}
          {(body.statics ?? []).length === 0 && (
            <p className="text-sm text-zinc-500">
              Sin conceptos de estático. Regenera los anuncios para obtenerlos.
            </p>
          )}
        </div>
      )}

      {tab === "video" && (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-zinc-400">UGC</div>
            <div className="grid gap-3 lg:grid-cols-3">
              {(body.ugc ?? []).map((u, i) => (
                <Card key={i} title={`UGC ${i + 1}`} copyText={u.script}>
                  <CopyField label="Gancho" value={u.hook} />
                  <CopyField label="Guion" value={u.script} />
                  {u.broll && u.broll.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-zinc-400">
                      {u.broll.map((b, j) => (
                        <li key={j}>· {b}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-zinc-400">Voz en off</div>
            <div className="grid gap-3 lg:grid-cols-3">
              {(body.voiceOver ?? []).map((v, i) => (
                <Card key={i} title={`Voz en off ${i + 1}`} copyText={v.script}>
                  <CopyField label="Gancho" value={v.hook} />
                  <CopyField label="Guion" value={v.script} />
                  {v.visuals && v.visuals.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-zinc-400">
                      {v.visuals.map((b, j) => (
                        <li key={j}>· {b}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {(body.youtubeClipCta ?? []).length > 0 && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-zinc-400">Clip de YouTube + CTA</div>
              <div className="grid gap-3 lg:grid-cols-3">
                {(body.youtubeClipCta ?? []).map((y, i) => (
                  <Card key={i} title={`Clip ${i + 1}`}>
                    <CopyField label="Fuente" value={y.sourceHint} />
                    <CopyField label="Marca de tiempo" value={y.timestampHint} />
                    <CopyField label="Overlay" value={y.overlay} />
                    <CopyField label="CTA" value={y.cta} />
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
