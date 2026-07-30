import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUnsplashConfigured, searchUnsplashPhotos } from "@/integrations/unsplash";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isUnsplashConfigured()) {
    return NextResponse.json({ error: "unsplash_not_configured" }, { status: 503 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const results = await searchUnsplashPhotos(q);
  return NextResponse.json({ results });
}
