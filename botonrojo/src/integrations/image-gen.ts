import { env } from "@/lib/env";
import { storage, BUCKET, ensureBucket, publicUrlFor } from "./storage";
import { createId } from "@/lib/ids";

// Magnific (formerly Freepik) — Mystic text-to-image. Platform-level: the
// platform pays for this, it isn't a per-client credential like Stripe/AC.
// Docs: https://docs.magnific.com/api-reference/mystic/post-mystic
const MAGNIFIC_BASE_URL = "https://api.magnific.com";

export function isImageGenConfigured() {
  return Boolean(env.MAGNIFIC_API_KEY);
}

type MysticTask = {
  task_id: string;
  status: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  generated: string[];
};

export async function generateImage(prompt: string): Promise<string> {
  if (!env.MAGNIFIC_API_KEY) throw new Error("magnific_not_configured");

  const headers = {
    "x-magnific-api-key": env.MAGNIFIC_API_KEY,
    "Content-Type": "application/json",
  };

  const createRes = await fetch(`${MAGNIFIC_BASE_URL}/v1/ai/mystic`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      resolution: "1k",
      aspect_ratio: "widescreen_16_9",
      model: "realism",
    }),
  });

  if (!createRes.ok) {
    throw new Error(`magnific_api_error: ${await createRes.text()}`);
  }

  let task = ((await createRes.json()) as { data: MysticTask }).data;

  if (task.status !== "COMPLETED") {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`${MAGNIFIC_BASE_URL}/v1/ai/mystic/${task.task_id}`, { headers });
      task = ((await pollRes.json()) as { data: MysticTask }).data;
      if (task.status === "COMPLETED") break;
      if (task.status === "FAILED") throw new Error("generation_failed");
    }
  }

  const imageUrl = task.generated?.[0];
  if (!imageUrl) throw new Error("no_output");

  // Download the Magnific-hosted image and re-host it on our own MinIO.
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("download_failed");

  const buf = Buffer.from(await imgRes.arrayBuffer());
  await ensureBucket();
  const key = `ai-gen/${new Date().toISOString().slice(0, 10)}/${createId(12)}.webp`;

  await storage.putObject(BUCKET, key, buf, buf.length, {
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  return publicUrlFor(key);
}
