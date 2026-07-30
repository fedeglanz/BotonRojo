import { env } from "@/lib/env";

export function isDesignReviewConfigured() {
  return Boolean(env.SCREENSHOT_SERVICE_URL && env.ANTHROPIC_API_KEY);
}

async function requestScreenshot(
  url: string,
  opts: { width: number; height: number; fullPage?: boolean; quality?: number },
): Promise<{ mediaType: "image/jpeg"; base64: string }> {
  const res = await fetch(`${env.SCREENSHOT_SERVICE_URL}/screenshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.SCREENSHOT_SERVICE_TOKEN ? { "x-screenshot-token": env.SCREENSHOT_SERVICE_TOKEN } : {}),
    },
    body: JSON.stringify({
      url,
      width: opts.width,
      height: opts.height,
      fullPage: opts.fullPage ?? false,
      type: "jpeg",
      quality: opts.quality ?? 75,
    }),
  });

  if (!res.ok) throw new Error(`screenshot_service_error: ${res.status} ${await res.text()}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  return { mediaType: "image/jpeg", base64: buffer.toString("base64") };
}

/** Screenshots a path of this same app via the screenshot-service sidecar. */
export async function captureScreenshot(
  path: string,
  opts: { width: number; height: number; fullPage?: boolean },
): Promise<{ mediaType: "image/jpeg"; base64: string }> {
  return requestScreenshot(`${env.SCREENSHOT_APP_URL}${path}`, opts);
}

/** Screenshots an arbitrary external URL — used for reference-site analysis. */
export async function captureExternalScreenshot(
  url: string,
  opts: { width: number; height: number; fullPage?: boolean },
): Promise<{ mediaType: "image/jpeg"; base64: string }> {
  return requestScreenshot(url, { ...opts, quality: 70 });
}
