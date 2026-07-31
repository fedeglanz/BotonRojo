import { BrandStyle } from "@/components/public/brand-style";
import { PublicFooter } from "@/components/public/public-footer";
import type { Launch } from "@/db/schema/launches";
import type { LegalPageBody } from "@/components/public/page-bodies";

/** Splits the generated text into blocks, treating short ALL-CAPS-ish or
 * numbered lines as headings so it doesn't read as one endless wall. */
function parseBlocks(content: string) {
  return content
    .split(/\n{2,}/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((text) => {
      const isHeading = text.length < 90 && /^(\d+\.|[A-ZÁÉÍÓÚÑ\d\s.,:¿?—-]+)$/.test(text);
      return { text, isHeading };
    });
}

export function LegalPage({ launch, body }: { launch: Launch; body: LegalPageBody | null }) {
  const blocks = parseBlocks(body?.content ?? "");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="border-b border-[--color-border] pb-8">
          <div className="text-xs uppercase tracking-widest text-[--color-muted-3]">{launch.name}</div>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-4xl">
            {body?.title ?? "Documento legal"}
          </h1>
        </header>

        <article className="mt-10 space-y-5">
          {blocks.map((b, i) =>
            b.isHeading ? (
              <h2
                key={i}
                className="pt-6 font-[family-name:var(--font-display)] text-lg font-bold text-[--color-accent]"
              >
                {b.text}
              </h2>
            ) : (
              <p key={i} className="whitespace-pre-line leading-relaxed text-[--color-muted-1]">
                {b.text}
              </p>
            ),
          )}
        </article>
      </div>

      <PublicFooter launch={launch} />
    </main>
  );
}
