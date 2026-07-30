import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
export const MODEL = env.ANTHROPIC_MODEL;

export type CachedSystem = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

export async function complete(opts: {
  system: string | CachedSystem[];
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    system: typeof opts.system === "string"
      ? opts.system
      : opts.system.map((b) => ({ ...b, cache_control: b.cache_control ?? { type: "ephemeral" } })),
    messages: [{ role: "user", content: opts.prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, usage: res.usage };
}

export async function completeWithImages(opts: {
  system: string;
  prompt: string;
  images: Array<{ mediaType: "image/png" | "image/jpeg"; base64: string }>;
  maxTokens?: number;
  temperature?: number;
}) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.2,
    system: opts.system,
    messages: [
      {
        role: "user",
        content: [
          ...opts.images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
          })),
          { type: "text" as const, text: opts.prompt },
        ],
      },
    ],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, usage: res.usage };
}
