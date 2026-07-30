import { env } from "@/lib/env";

// Unsplash search — platform-level (shared key), used both for the admin's
// manual photo picker and as an automatic fallback/complement to Magnific
// when generating a landing.
export function isUnsplashConfigured() {
  return Boolean(env.UNSPLASH_ACCESS_KEY);
}

export type UnsplashPhoto = {
  id: string;
  smallUrl: string;
  regularUrl: string;
  alt: string;
  author: string;
};

export async function searchUnsplashPhotos(query: string, perPage = 12): Promise<UnsplashPhoto[]> {
  if (!env.UNSPLASH_ACCESS_KEY || !query.trim()) return [];

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("client_id", env.UNSPLASH_ACCESS_KEY);

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results: Array<{
      id: string;
      urls: { small: string; regular: string };
      alt_description: string | null;
      user: { name: string };
    }>;
  };

  return data.results.map((p) => ({
    id: p.id,
    smallUrl: p.urls.small,
    regularUrl: p.urls.regular,
    alt: p.alt_description ?? "",
    author: p.user.name,
  }));
}
