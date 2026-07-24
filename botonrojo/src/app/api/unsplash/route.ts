import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!env.UNSPLASH_ACCESS_KEY) {
    return NextResponse.json({ error: "unsplash_not_configured" }, { status: 503 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("client_id", env.UNSPLASH_ACCESS_KEY);

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) {
    return NextResponse.json({ error: "unsplash_error" }, { status: 502 });
  }

  const data = (await res.json()) as {
    results: Array<{
      id: string;
      urls: { small: string; regular: string };
      alt_description: string | null;
      user: { name: string };
    }>;
  };

  return NextResponse.json({
    results: data.results.map((p) => ({
      id: p.id,
      smallUrl: p.urls.small,
      regularUrl: p.urls.regular,
      alt: p.alt_description ?? "",
      author: p.user.name,
    })),
  });
}
