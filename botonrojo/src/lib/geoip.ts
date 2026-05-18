import { env } from "./env";

type GeoResult = { country: string; city: string };

export async function lookupGeoIp(ip: string): Promise<GeoResult> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return { country: "", city: "" };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${env.GEOIP_PROVIDER_URL}/${ip}`, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return { country: "", city: "" };
    const data = (await res.json()) as { location?: { country?: string; city?: string } };
    return {
      country: data.location?.country ?? "",
      city: data.location?.city ?? "",
    };
  } catch {
    return { country: "", city: "" };
  }
}
