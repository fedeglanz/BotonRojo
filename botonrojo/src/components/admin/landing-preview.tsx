type LandingBody = {
  hero?: { headline?: string; subheadline?: string; cta?: string };
  forWhom?: { yes?: string[]; no?: string[] };
  amplifiedPromise?: string;
  painBlocks?: Array<{ pain: string; solution: string }>;
  includes?: Array<{ title: string; description: string }>;
  about?: string;
  testimonialsPlaceholders?: string[];
  guarantee?: string;
  faq?: Array<{ q: string; a: string }>;
  finalCta?: { headline?: string; button?: string };
  style?: { palette?: string[]; fonts?: string[]; motion?: string };
};

export function LandingPreview({ body, slug }: { body: LandingBody | null; slug: string }) {
  if (!body) {
    return (
      <p className="text-sm text-zinc-500">
        Aún no hay landing generada. Pulsa <em>Generar landing</em> para que Claude la construya
        a partir del Marco.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-black/40 p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Hero</div>
        <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-white">
          {body.hero?.headline ?? "—"}
        </div>
        <p className="mt-2 text-zinc-300">{body.hero?.subheadline ?? ""}</p>
        {body.hero?.cta && (
          <div className="mt-4">
            <span className="inline-flex rounded-full bg-gradient-to-b from-[#ff3849] to-[#d4172a] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">
              {body.hero.cta}
            </span>
          </div>
        )}
      </div>

      {body.amplifiedPromise && (
        <Section title="Promesa amplificada">{body.amplifiedPromise}</Section>
      )}

      {body.painBlocks && body.painBlocks.length > 0 && (
        <Section title="Bloques dolor → solución">
          <div className="grid gap-3 md:grid-cols-3">
            {body.painBlocks.map((b, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-black/30 p-4 text-sm">
                <div className="text-zinc-400">{b.pain}</div>
                <div className="mt-2 text-[var(--color-red-bright)]">→ {b.solution}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {body.includes && body.includes.length > 0 && (
        <Section title="Qué incluye">
          <ul className="space-y-2 text-sm text-zinc-300">
            {body.includes.map((i, idx) => (
              <li key={idx}>
                <strong className="text-white">{i.title}.</strong> {i.description}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {body.guarantee && <Section title="Garantía">{body.guarantee}</Section>}

      {body.faq && body.faq.length > 0 && (
        <Section title="FAQ">
          <div className="space-y-3">
            {body.faq.map((q, i) => (
              <details key={i} className="rounded-lg border border-white/5 bg-black/20 p-3 text-sm">
                <summary className="cursor-pointer text-white">{q.q}</summary>
                <p className="mt-2 text-zinc-400">{q.a}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      {body.style && (
        <Section title="Sugerencia de estilo">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            {body.style.palette?.map((c) => (
              <span key={c} className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border border-white/10" style={{ background: c }} />
                <code>{c}</code>
              </span>
            ))}
            {body.style.fonts && <span>· Fuentes: {body.style.fonts.join(", ")}</span>}
          </div>
        </Section>
      )}

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-xs text-zinc-500">
        Vista pública: <code className="text-[var(--color-red-bright)]">/{slug}</code>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{title}</div>
      <div className="mt-2 text-sm text-zinc-200">{children}</div>
    </div>
  );
}
