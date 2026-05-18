import { z } from "zod";

// Schema for the public /api/track endpoint.
// Mirrors the wp_datos columns from the legacy plugin, but cleaned up.
export const trackPayloadSchema = z.object({
  type: z.enum(["visit", "lead", "sale", "seminar", "click", "email_open", "email_click"]),
  sessionId: z.string().optional(),
  cookie: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),

  // Attribution
  ref: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),

  // Context
  launchSlug: z.string().optional(),
  pageId: z.string().optional(),
  urlCurrent: z.string().optional(),
  urlPrevious: z.string().optional(),

  // Sale info
  amountCents: z.number().int().optional(),
  currency: z.string().optional(),
  product: z.string().optional(),
  stripeSessionId: z.string().optional(),

  // Free-form
  payload: z.record(z.unknown()).optional(),
});

export type TrackPayload = z.infer<typeof trackPayloadSchema>;

export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "";
}

// Source classification mirrors the legacy logic:
//   facebook | pb | fb | gads → "publicidad"
//   ActiveCampaign + no ref   → "organico"
//   ActiveCampaign + ref      → "afiliado"
export function classifySource(utmSource: string | undefined, ref: string | undefined): string {
  const s = (utmSource ?? "").toLowerCase();
  if (["facebook", "pb", "fb", "gads"].includes(s)) return "publicidad";
  if (s === "activecampaign") return ref ? "afiliado" : "organico";
  return utmSource ?? "directo";
}
