import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storage, BUCKET, ensureBucket, publicUrlFor } from "@/integrations/storage";
import { createId } from "@/lib/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
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

  const extFromMime = file.type.split("/")[1]?.replace("svg+xml", "svg") ?? "bin";
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${createId(12)}.${extFromMime}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await storage.putObject(BUCKET, key, buf, buf.length, {
    "Content-Type": file.type,
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  return NextResponse.json({ url: publicUrlFor(key), key });
}
