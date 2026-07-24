import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateImage, isImageGenConfigured } from "@/integrations/image-gen";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isImageGenConfigured()) {
    return NextResponse.json({ error: "image_gen_not_configured" }, { status: 503 });
  }

  const body = (await req.json()) as { prompt?: string };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  }

  try {
    const url = await generateImage(prompt);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
