// PDC Checkout API client.
// Docs: pdc-checkout/doc/api-externa-lanzamientos.html
// Auth: header `X-API-Key`. Base URL is the campus WordPress site.
// Three namespaces: lanzamientos/v1, productos/v1, precios/v1

import { getDecryptedCredential } from "@/server/integrations";
import type { PdcCheckoutCredentials } from "@/server/integrations";

export class PdcCheckoutError extends Error {
  constructor(public status: number, public body: string) {
    super(`PDC Checkout ${status}: ${body}`);
  }
}

export async function getPdcCheckoutCredentials(
  organizationId: string,
): Promise<PdcCheckoutCredentials | null> {
  return getDecryptedCredential<PdcCheckoutCredentials>(organizationId, "pdc_checkout");
}

export async function isPdcCheckoutConfigured(organizationId: string): Promise<boolean> {
  return Boolean(await getPdcCheckoutCredentials(organizationId));
}

// ---- Types ----

export type PdcLaunch = {
  id: string;
  nombre: string;
  imagen: string | null;
  descripcion: string | null;
  fecha: string | null;
  activo: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
};

export type PdcProduct = {
  id: number;
  nombre: string;
  nombre_venta: string | null;
  lanzamiento_id: number | null;
  stripe_product_id: string | null;
  whop_product_id: string | null;
  stripe_account_id: number | null;
  whop_account_id: number | null;
  cuenta_facturacion: string | null;
  tax_mode: string;
  enlace: string | null;
  gracias: string | null;
  condiciones: string | null;
  imagen: string | null;
  permite_cantidad: number;
  permite_cupones: number;
  activo: number;
};

export type PdcPrice = {
  id: number;
  producto_id: number;
  tipo_pago: "unico" | "cuotas" | "recurrente";
  precio: number;
  moneda: string;
  num_cuotas: number | null;
  frecuencia: string | null;
  impuesto_incluido: number;
  gracias: string | null;
  condiciones: string | null;
  checkout_padre_id: number | null;
  activo: number;
  stripe_price_id: string | null;
  checkout_url_stripe: string | null;
  whop_plan_id: string | null;
  checkout_url_whop: string | null;
  whop_activo: number | null;
};

export type PdcStripeAccount = {
  id: number;
  nombre: string;
  es_principal: number;
  tax_enabled: number;
  bloqueada: number;
  activo: number;
};

export type PdcWhopAccount = {
  id: number;
  nombre: string;
  company_name: string;
  es_principal: number;
  activo: number;
};

export type PdcBillingAccount = {
  value: string;
  label: string;
};

export type PdcSyncResult = {
  stripe: { ok: boolean; error: string | null };
  whop: { ok: boolean; error: string | null };
};

export type PdcProductWithSync = PdcProduct & { sync: PdcSyncResult };

export type PdcCheckoutClient = ReturnType<typeof createPdcCheckoutClient>;

export function createPdcCheckoutClient(creds: PdcCheckoutCredentials) {
  const siteUrl = creds.siteUrl.replace(/\/$/, "");

  async function pdc<T>(namespace: string, path: string, init: RequestInit = {}): Promise<T> {
    const url = `${siteUrl}/wp-json/${namespace}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "X-API-Key": creds.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PdcCheckoutError(res.status, body);
    }
    return (await res.json()) as T;
  }

  // ---- Launches ----

  async function listLaunches(): Promise<PdcLaunch[]> {
    return pdc<PdcLaunch[]>("lanzamientos/v1", "/lanzamientos");
  }

  async function getLaunch(id: number): Promise<PdcLaunch> {
    return pdc<PdcLaunch>("lanzamientos/v1", `/lanzamientos/${id}`);
  }

  async function createLaunch(input: {
    nombre: string;
    descripcion?: string;
    fecha?: string;
    imagen?: string;
  }): Promise<PdcLaunch> {
    return pdc<PdcLaunch>("lanzamientos/v1", "/lanzamientos", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async function updateLaunch(
    id: number,
    input: Partial<{ nombre: string; descripcion: string; fecha: string; imagen: string; activo: number }>,
  ): Promise<PdcLaunch> {
    return pdc<PdcLaunch>("lanzamientos/v1", `/lanzamientos/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  // ---- Products ----

  async function listProducts(launchId?: number): Promise<PdcProduct[]> {
    const qs = launchId ? `?lanzamiento_id=${launchId}` : "";
    return pdc<PdcProduct[]>("productos/v1", `/productos${qs}`);
  }

  async function getProduct(id: number): Promise<PdcProduct> {
    return pdc<PdcProduct>("productos/v1", `/productos/${id}`);
  }

  async function createProduct(input: {
    nombre: string;
    nombre_venta?: string;
    lanzamiento_id?: number;
    stripe_account_id?: number;
    whop_account_id?: number;
    cuenta_facturacion?: string;
    tax_mode?: string;
    enlace?: string;
    gracias?: string;
    condiciones?: string;
    imagen?: string;
    permite_cantidad?: number;
    permite_cupones?: number;
  }): Promise<PdcProductWithSync> {
    return pdc<PdcProductWithSync>("productos/v1", "/productos", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async function syncProduct(id: number): Promise<PdcSyncResult> {
    return pdc<PdcSyncResult>("productos/v1", `/productos/${id}/sincronizar`, {
      method: "POST",
    });
  }

  // ---- Prices ----

  async function listPrices(productId: number): Promise<PdcPrice[]> {
    return pdc<PdcPrice[]>("precios/v1", `/productos/${productId}/precios`);
  }

  async function createPrice(
    productId: number,
    input: {
      tipo_pago: "unico" | "cuotas" | "recurrente";
      precio: number;
      num_cuotas?: number;
      frecuencia?: string;
      gracias?: string;
      condiciones?: string;
      impuesto_incluido?: number;
    },
  ): Promise<PdcPrice> {
    return pdc<PdcPrice>("precios/v1", `/productos/${productId}/precios`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // ---- Connected accounts ----

  async function listStripeAccounts(): Promise<PdcStripeAccount[]> {
    return pdc<PdcStripeAccount[]>("productos/v1", "/cuentas-stripe");
  }

  async function listWhopAccounts(): Promise<PdcWhopAccount[]> {
    return pdc<PdcWhopAccount[]>("productos/v1", "/cuentas-whop");
  }

  async function listBillingAccounts(): Promise<PdcBillingAccount[]> {
    return pdc<PdcBillingAccount[]>("productos/v1", "/cuentas-facturacion");
  }

  // ---- Test connection ----

  async function testConnection(): Promise<boolean> {
    try {
      await listLaunches();
      return true;
    } catch {
      return false;
    }
  }

  return {
    listLaunches,
    getLaunch,
    createLaunch,
    updateLaunch,
    listProducts,
    getProduct,
    createProduct,
    syncProduct,
    listPrices,
    createPrice,
    listStripeAccounts,
    listWhopAccounts,
    listBillingAccounts,
    testConnection,
  };
}

/** Convenience: resolve an org's client, or null if PDC Checkout isn't connected. */
export async function getPdcCheckoutClientForOrg(organizationId: string): Promise<PdcCheckoutClient | null> {
  const creds = await getPdcCheckoutCredentials(organizationId);
  if (!creds) return null;
  return createPdcCheckoutClient(creds);
}
