import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { storage, BUCKET, ensureBucket, publicUrlFor } from "@/integrations/storage";
import { createId } from "@/lib/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Source photos for ad backgrounds — no SVG here (unlike /api/upload, which
// also serves logos): an SVG can carry script, and these get composited into
// a page that the screenshot service renders.
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  let organizationId: string;
  let userId: string;
  try {
    const auth = await requireOrgAdmin();
    if (!auth.organizationId) throw new Error("no_organization");
    organizationId = auth.organizationId;
    userId = auth.user.id;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const label = String(form.get("label") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type", type: file.type }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  await ensureBucket();

  const ext = file.type.split("/")[1] ?? "bin";
  const storageKey = `media/${organizationId}/${new Date().toISOString().slice(0, 10)}/${createId(12)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await storage.putObject(BUCKET, storageKey, buf, buf.length, {
    "Content-Type": file.type,
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  const [row] = await db
    .insert(mediaItems)
    .values({
      organizationId,
      url: publicUrlFor(storageKey),
      storageKey,
      filename: file.name || "imagen",
      mimeType: file.type,
      label,
      uploadedBy: userId,
    })
    .returning();

  return NextResponse.json({ item: row });
}
