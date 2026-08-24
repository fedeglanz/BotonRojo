import type { Launch, PageSeo } from "@/db/schema/launches";
import { publicPageUrl, type PageDef } from "@/lib/launch-pages";

/**
 * El SEO de cada página de un lanzamiento.
 *
 * Hasta ahora todas las páginas publicadas salían con el título del layout —"Botón
 * Rojo · Lanzamientos"— y sin descripción. Eso es lo que se ve en Google, en el
 * WhatsApp donde alguien pega el enlace y en la pestaña del navegador: la página
 * podía estar perfecta y presentarse con el nombre de la herramienta con la que se
 * hizo.
 *
 * Se guarda por `pageKey` y no dentro del contenido de la página a propósito: el
 * contenido se regenera y se sustituye —desde el panel, desde Claude— y el SEO no
 * tiene por qué irse con él. Sobrevive a un rediseño.
 */
export type LaunchSeo = Record<string, PageSeo>;

export function seoFor(launch: Launch, pageKey: string): PageSeo {
  const all = (launch.seo ?? {}) as LaunchSeo;
  return all[pageKey] ?? {};
}

/** Los tipos de página que no tienen ningún sentido en un buscador. */
const NUNCA_SE_INDEXA = new Set(["gracias", "baja"]);

/**
 * Si esta página debe indexarse, con el valor guardado por encima del criterio.
 *
 * Las de gracias y de baja salen fuera por defecto: una página de "ya estás dentro"
 * en los resultados de Google es una entrada sin sentido —se llega a ella tras
 * registrarse, no antes— y encima diluye la que sí quieres que salga. Quien quiera
 * lo contrario lo puede marcar; lo que no puede pasar es que ocurra por descuido.
 */
export function shouldIndex(launch: Launch, page: PageDef): boolean {
  const seo = seoFor(launch, page.pageKey);
  if (typeof seo.index === "boolean") return seo.index;
  if (NUNCA_SE_INDEXA.has(page.kind)) return false;
  return true;
}

/**
 * Lo que se le pasa a Next para la cabecera de la página.
 *
 * Con respaldo en lo que el lanzamiento ya sabe de sí mismo: el nombre y la
 * promesa. Un título heredado del layout es peor que un título imperfecto.
 */
export function pageMetadataFor(input: {
  launch: Launch;
  page: PageDef;
  /** El dominio propio activo, si lo tiene. */
  hostname: string | null;
  appUrl: string;
}) {
  const { launch, page, hostname, appUrl } = input;
  const seo = seoFor(launch, page.pageKey);
  const url = publicPageUrl({ appUrl, hostname, slug: launch.slug, page });

  const title =
    seo.title?.trim() ||
    (page.isEntry ? launch.name : `${page.label} · ${launch.name}`);
  const description = seo.description?.trim() || launch.promise || undefined;
  const image = seo.imageUrl?.trim() || launch.brandMoodImageUrl || undefined;
  const indexar = shouldIndex(launch, page);

  return {
    title,
    description,
    alternates: { canonical: seo.canonicalUrl?.trim() || url },
    robots: indexar
      ? { index: true, follow: true }
      : // `nocache` y los de Google además del noindex: un noindex a secas deja el
        // enlace en la caché y en el snippet de otras búsquedas.
        {
          index: false,
          follow: false,
          nocache: true,
          googleBot: { index: false, follow: false },
        },
    openGraph: {
      type: "website" as const,
      title,
      description,
      url,
      siteName: launch.name,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? ("summary_large_image" as const) : ("summary" as const),
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
