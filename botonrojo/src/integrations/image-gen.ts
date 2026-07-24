import { env } from "@/lib/env";
import { storage, BUCKET, ensureBucket, publicUrlFor } from "./storage";
import { createId } from "@/lib/ids";

export function isImageGenConfigured() {
  return Boolean(env.REPLICATE_API_TOKEN);
}

type Prediction = {
  status: string;
  output?: string[];
  error?: string;
  urls: { get: string };
};

export async function generateImage(prompt: string): Promise<string> {
  if (!env.REPLICATE_API_TOKEN) throw new Error("replicate_not_configured");

  const createRes = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt,
          num_outputs: 1,
          output_format: "webp",
          width: 1280,
          height: 720,
        },
      }),
    },
  );

  if (!createRes.ok) {
    throw new Error(`replicate_api_error: ${await createRes.text()}`);
  }

  let prediction = (await createRes.json()) as Prediction;

  // With Prefer: wait=60, it may already be done; if not, poll
  if (prediction.status !== "succeeded") {
    const pollUrl = prediction.urls.get;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
      });
      prediction = (await pollRes.json()) as Prediction;
      if (prediction.status === "succeeded") break;
      if (prediction.status === "failed") {
        throw new Error(`generation_failed: ${prediction.error ?? "unknown"}`);
      }
    }
  }

  const imageUrl = prediction.output?.[0];
  if (!imageUrl) throw new Error("no_output");

  // Download temporary Replicate URL and re-host on MinIO
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
