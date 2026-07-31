import Link from "next/link";
import { SectionEditor } from "./section-editor";
import {
  LANDING_SECTIONS,
  type LandingBody,
  type LandingSectionKey,
} from "@/components/public/landing-types";

type ImageSlot = {
  label: string;
  slotPath: string;
  currentUrl: string | null | undefined;
  imagePrompt?: string | null;
};

type VersionMeta = {
  id: string;
  createdAt: Date;
  generatedByAi: string | null;
  authorEmail: string | null;
  authorName: string | null;
};

type Props = {
  launchId: string;
  launchSlug: string;
  body: LandingBody | null;
  versions?: VersionMeta[];
  /** Already bound to the launch and the page by the caller. */
  refineAction: (section: LandingSectionKey, formData: FormData) => Promise<void>;
  rawUpdateAction: (section: LandingSectionKey, formData: FormData) => Promise<void>;
  imageSaveAction: (slotPath: string, formData: FormData) => Promise<void>;
  designAction: (section: LandingSectionKey, formData: FormData) => Promise<void>;
};

export function LandingEditor({
  launchId,
  launchSlug,
  body,
  versions = [],
  refineAction,
  rawUpdateAction,
  imageSaveAction,
  designAction,
}: Props) {
  if (!body) {
    return (
      <p className="text-sm text-zinc-500">
        Aún no hay landing generada. Pulsa <em>Generar landing</em> arriba para que Claude la cree.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-xs">
        <div className="text-zinc-400">
          Edita cada sección por separado. Cambios se ven al recargar la landing pública.
        </div>
        <Link
          href={`/${launchSlug}`}
          target="_blank"
          className="rounded-md border border-white/20 bg-white/[0.08] px-3 py-1.5 uppercase tracking-widest text-zinc-100 transition hover:border-[var(--color-red)] hover:bg-white/15"
        >
          Ver landing pública ↗
        </Link>
      </div>

      {versions.length > 0 && (
        <details className="rounded-lg border border-white/10 bg-black/30 text-xs">
          <summary className="cursor-pointer px-4 py-2.5 text-zinc-400 hover:text-zinc-200 [&::-webkit-details-marker]:hidden flex items-center gap-2">
            <span className="text-zinc-600">🕐</span>
            Historial · {versions.length} {versions.length === 1 ? "versión" : "versiones"}
          </summary>
          <ul className="divide-y divide-white/5 px-4 pb-3">
            {versions.map((v, i) => {
              const who = v.generatedByAi
                ? `Claude (${v.generatedByAi})`
                : v.authorName ?? v.authorEmail ?? "Sistema";
              const when = new Date(v.createdAt).toLocaleString("es", {
                dateStyle: "short",
                timeStyle: "short",
              });
              return (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-zinc-600">
                      v{versions.length - i}
                    </span>
                    <span className="text-zinc-300">{who}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-emerald-400">
                        actual
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-600">{when}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {LANDING_SECTIONS.map((section) => {
        const sectionJson = (body as Record<string, unknown>)[section];
        if (sectionJson === undefined || sectionJson === null) return null;

        const imageSlots = collectImageSlots(section, body);
        const preview = renderPreview(section, sectionJson, body);

        return (
          <SectionEditor
            key={section}
            launchId={launchId}
            section={section}
            currentJson={sectionJson}
            preview={preview}
            imageSlots={imageSlots}
            refineAction={refineAction}
            rawUpdateAction={rawUpdateAction}
            imageSaveAction={imageSaveAction}
            design={body.sectionDesign?.[section] ?? null}
            designAction={designAction}
          />
        );
      })}
    </div>
  );
}

function collectImageSlots(section: LandingSectionKey, body: LandingBody): ImageSlot[] {
  if (section === "hero") {
    return [
      {
        label: "Imagen del hero",
        slotPath: "hero.imageUrl",
        currentUrl: body.hero?.imageUrl,
        imagePrompt: body.hero?.imagePrompt,
      },
    ];
  }

  if (section === "about") {
    const about = body.about;
    if (typeof about === "string") {
      return [
        {
          label: "Foto del creador",
          slotPath: "about.creatorImageUrl",
          currentUrl: null,
          imagePrompt: null,
        },
      ];
    }
    return [
      {
        label: "Foto del creador",
        slotPath: "about.creatorImageUrl",
        currentUrl: about?.creatorImageUrl,
        imagePrompt: about?.creatorImagePrompt,
      },
    ];
  }

  if (section === "includes" && body.includes) {
    return body.includes.map((it, idx) => ({
      label: `Imagen módulo ${idx + 1}: ${it.title}`,
      slotPath: `includes.${idx}.imageUrl`,
      currentUrl: it.imageUrl,
      imagePrompt: it.imagePrompt,
    }));
  }

  if (section === "speakers" && body.speakers) {
    return body.speakers.map((s, idx) => ({
      label: `Foto ponente ${idx + 1}: ${s.name}`,
      slotPath: `speakers.${idx}.imageUrl`,
      currentUrl: s.imageUrl,
      imagePrompt: s.imagePrompt,
    }));
  }

  return [];
}

function renderPreview(section: LandingSectionKey, sectionJson: unknown, body: LandingBody): React.ReactNode {
  if (section === "hero") {
    const hero = sectionJson as LandingBody["hero"];
    return (
      <div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Hero</div>
        <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-white">
          {hero?.headline ?? "—"}
        </div>
        <p className="mt-2 text-zinc-300">{hero?.subheadline}</p>
        {hero?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.imageUrl} alt="" className="mt-3 max-h-40 rounded-md object-cover" />
        )}
        {hero?.cta && (
          <span className="mt-3 inline-flex rounded-full bg-gradient-to-b from-[#ff3849] to-[#d4172a] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            {hero.cta}
          </span>
        )}
      </div>
    );
  }

  if (section === "forWhom") {
    const fw = sectionJson as LandingBody["forWhom"];
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewList items={fw?.yes ?? []} label="Sí" tone="ok" />
        <PreviewList items={fw?.no ?? []} label="No" tone="ko" />
      </div>
    );
  }

  if (section === "amplifiedPromise") {
    return <p className="text-balance text-xl font-bold text-white">{String(sectionJson)}</p>;
  }

  if (section === "painBlocks") {
    const blocks = sectionJson as LandingBody["painBlocks"];
    return (
      <div className="grid gap-2 md:grid-cols-3">
        {blocks?.map((b, i) => (
          <div key={i} className="rounded-lg border border-white/5 bg-black/30 p-3 text-xs">
            <div className="text-zinc-400">{b.icon} {b.pain}</div>
            <div className="mt-1 text-[var(--color-red-bright)]">→ {b.solution}</div>
          </div>
        ))}
      </div>
    );
  }

  if (section === "includes") {
    const items = sectionJson as LandingBody["includes"];
    return (
      <ul className="space-y-2 text-sm">
        {items?.map((it, i) => (
          <li key={i} className="flex gap-3">
            {it.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
            )}
            <div>
              <strong className="text-white">{it.icon} {it.title}.</strong>{" "}
              <span className="text-zinc-400">{it.description}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (section === "about") {
    const about = body.about;
    if (typeof about === "string") return <p className="text-sm text-zinc-300">{about}</p>;
    return (
      <div className="flex gap-4">
        {about?.creatorImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={about.creatorImageUrl} alt={about.creatorName ?? ""} className="h-20 w-20 rounded-full object-cover" />
        )}
        <div>
          {about?.creatorName && <div className="font-bold text-white">{about.creatorName}</div>}
          {about?.creatorRole && <div className="text-xs text-zinc-500">{about.creatorRole}</div>}
          <p className="mt-2 text-sm text-zinc-300">{about?.text}</p>
        </div>
      </div>
    );
  }

  if (section === "testimonials") {
    const items = sectionJson as LandingBody["testimonials"];
    return (
      <div className="grid gap-2 md:grid-cols-3">
        {items?.map((t, i) => (
          <blockquote key={i} className="rounded-lg border border-white/5 bg-black/30 p-3 text-xs">
            <p className="italic text-zinc-200">"{t.quote}"</p>
            <footer className="mt-2 text-zinc-500">
              — {t.author}
              {t.role && <span className="text-zinc-600">, {t.role}</span>}
            </footer>
          </blockquote>
        ))}
      </div>
    );
  }

  if (section === "guarantee") return <p className="text-sm text-zinc-200">{String(sectionJson)}</p>;

  if (section === "faq") {
    const items = sectionJson as LandingBody["faq"];
    return (
      <ul className="space-y-1 text-sm">
        {items?.map((f, i) => (
          <li key={i}>
            <span className="text-white">{f.q}</span>{" "}
            <span className="text-zinc-500">— {f.a.slice(0, 80)}{f.a.length > 80 ? "…" : ""}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (section === "speakers") {
    const items = sectionJson as LandingBody["speakers"];
    return (
      <div className="grid gap-2 md:grid-cols-3">
        {items?.map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 p-2 text-xs">
            {s.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            )}
            <div>
              <div className="text-white">{s.name}</div>
              {s.role && <div className="text-zinc-500">{s.role}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section === "agenda") {
    const items = sectionJson as LandingBody["agenda"];
    return (
      <ul className="space-y-1 text-sm">
        {items?.map((a, i) => (
          <li key={i}>
            <span className="font-[family-name:var(--font-mono)] text-[var(--color-red-bright)]">{a.time}</span>{" "}
            <span className="text-zinc-300">— {a.topic}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (section === "pricingTiers") {
    const items = sectionJson as LandingBody["pricingTiers"];
    return (
      <div className="grid gap-2 md:grid-cols-3">
        {items?.map((t, i) => (
          <div key={i} className="rounded-lg border border-white/5 bg-black/30 p-3 text-xs">
            <div className="font-bold text-white">{t.productSlug}</div>
            {t.highlight && <div className="text-[var(--color-red-bright)]">{t.highlight}</div>}
            <ul className="mt-1 space-y-0.5 text-zinc-400">
              {t.bullets?.map((b, j) => <li key={j}>· {b}</li>)}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (section === "finalCta") {
    const cta = sectionJson as LandingBody["finalCta"];
    return (
      <div>
        <div className="font-[family-name:var(--font-display)] text-lg font-bold text-white">
          {cta?.headline}
        </div>
        {cta?.subheadline && <p className="mt-1 text-sm text-zinc-300">{cta.subheadline}</p>}
        <span className="mt-3 inline-flex rounded-full bg-gradient-to-b from-[#ff3849] to-[#d4172a] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
          {cta?.button}
        </span>
      </div>
    );
  }

  return null;
}

function PreviewList({ items, label, tone }: { items: string[]; label: string; tone: "ok" | "ko" }) {
  const dot = tone === "ok" ? "text-emerald-400" : "text-red-400";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <ul className="mt-2 space-y-1 text-xs text-zinc-300">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className={dot}>{tone === "ok" ? "✓" : "✗"}</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
