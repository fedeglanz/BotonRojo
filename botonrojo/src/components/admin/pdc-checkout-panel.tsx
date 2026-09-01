"use client";

import { useState, useTransition, useEffect } from "react";
import { SubmitButton } from "./submit-button";
import { Button } from "@/components/ui/button";

type PdcLaunch = {
  id: string;
  nombre: string;
  fecha: string | null;
  activo: string;
};

type PdcProduct = {
  id: number;
  nombre: string;
  stripe_product_id: string | null;
  whop_product_id: string | null;
  activo: number;
};

type PdcPrice = {
  id: number;
  tipo_pago: string;
  precio: number;
  moneda: string;
  num_cuotas: number | null;
  activo: number;
  stripe_price_id: string | null;
  checkout_url_stripe: string | null;
  checkout_url_whop: string | null;
};

type SyncedPrice = {
  id: number;
  tipo_pago: string;
  precio: number;
  num_cuotas: number | null;
  activo: number;
  checkout_url_stripe: string | null;
  checkout_url_whop: string | null;
};

type Props = {
  launchId: string;
  configured: boolean;
  pdcLaunchId: number | null;
  pdcProductId: number | null;
  pdcPriceIds: number[];
  /** Páginas de venta disponibles para asignar precios (pageKey → label) */
  ventaPages: Array<{ pageKey: string; label: string }>;
  /** pageKeys asignados a cada precio en el cache */
  pricePageKeys: Record<number, string[]>;
  listLaunchesAction: (launchId: string) => Promise<PdcLaunch[]>;
  connectLaunchAction: (launchId: string, pdcLaunchId: number) => Promise<void>;
  createLaunchAction: (launchId: string) => Promise<PdcLaunch>;
  disconnectLaunchAction: (launchId: string) => Promise<void>;
  createProductAction: (launchId: string, formData: FormData) => Promise<unknown>;
  createPriceAction: (launchId: string, formData: FormData) => Promise<unknown>;
  fetchProductAction: (launchId: string) => Promise<{
    product: PdcProduct | null;
    prices: PdcPrice[];
  }>;
  syncCheckoutUrlsAction: (launchId: string) => Promise<{ product: unknown; prices: SyncedPrice[] }>;
  assignPriceToPageAction: (launchId: string, priceId: number, pageKeys: string[], checkoutUrlStripe?: string | null) => Promise<{ updated: boolean; buttonsUpdated?: string }>;
  fetchAccountsAction: (launchId: string) => Promise<{
    stripeAccounts: Array<{ id: number; nombre: string; es_principal: number }>;
    billingAccounts: Array<{ value: string; label: string }>;
  }>;
  updateButtonUrlsAction: (launchId: string) => Promise<{ result: "ok" | "no_price" | "no_page" | "no_buttons"; message: string }>;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 rounded border border-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-zinc-400 transition hover:border-white/30 hover:text-white"
    >
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function priceLabel(p: PdcPrice): string {
  if (p.tipo_pago === "cuotas" && p.num_cuotas) {
    return `${p.precio}€ x ${p.num_cuotas} cuotas (${p.precio * p.num_cuotas}€ total)`;
  }
  if (p.tipo_pago === "recurrente") {
    return `${p.precio}€/mes (recurrente)`;
  }
  return `${p.precio}€ pago unico`;
}

export function PdcCheckoutPanel({
  launchId,
  configured,
  pdcLaunchId,
  pdcProductId,
  pdcPriceIds,
  ventaPages,
  pricePageKeys: initialPricePageKeys,
  listLaunchesAction,
  connectLaunchAction,
  createLaunchAction,
  disconnectLaunchAction,
  createProductAction,
  createPriceAction,
  fetchProductAction,
  syncCheckoutUrlsAction,
  assignPriceToPageAction,
  fetchAccountsAction,
  updateButtonUrlsAction,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [injectResult, setInjectResult] = useState<string | null>(null);
  const [pricePageKeys, setPricePageKeys] = useState<Record<number, string[]>>(initialPricePageKeys);
  const [campusLaunches, setCampusLaunches] = useState<PdcLaunch[] | null>(null);
  const [loadingLaunches, setLoadingLaunches] = useState(false);
  const [pdcProduct, setPdcProduct] = useState<PdcProduct | null>(null);
  const [pdcPrices, setPdcPrices] = useState<PdcPrice[]>([]);
  const [productLoaded, setProductLoaded] = useState(false);
  const [accounts, setAccounts] = useState<{
    stripeAccounts: Array<{ id: number; nombre: string; es_principal: number }>;
    billingAccounts: Array<{ value: string; label: string }>;
  } | null>(null);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreatePrice, setShowCreatePrice] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!productLoaded && pdcProductId) {
      loadProductData();
    }
  }, [pdcProductId]);

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        PDC Checkout no esta configurado. Conectalo desde Ajustes &gt; Integraciones.
      </div>
    );
  }

  async function loadCampusLaunches() {
    setLoadingLaunches(true);
    setError(null);
    try {
      const result = await listLaunchesAction(launchId);
      setCampusLaunches(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingLaunches(false);
    }
  }

  async function loadProductData() {
    setError(null);
    try {
      const { product, prices } = await fetchProductAction(launchId);
      setPdcProduct(product);
      setPdcPrices(prices);
      setProductLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadAccounts() {
    if (accounts) return;
    try {
      const result = await fetchAccountsAction(launchId);
      setAccounts(result);
    } catch {
      // silently fail
    }
  }

  // ---- Not linked yet ----
  if (!pdcLaunchId) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={loadCampusLaunches}
            disabled={loadingLaunches}
          >
            {loadingLaunches ? "Cargando…" : "Ver lanzamientos del campus"}
          </Button>
          <form
            action={() => {
              startTransition(async () => {
                setError(null);
                try {
                  await createLaunchAction(launchId);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              });
            }}
          >
            <SubmitButton pendingLabel="Creando…">
              Crear lanzamiento nuevo en campus
            </SubmitButton>
          </form>
        </div>

        {campusLaunches && (
          <div className="space-y-2">
            {campusLaunches.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No hay lanzamientos en el campus. Crea uno nuevo.
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-500">
                  Selecciona un lanzamiento existente para conectar:
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {campusLaunches.map((cl) => (
                    <button
                      key={cl.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          setError(null);
                          try {
                            await connectLaunchAction(launchId, Number(cl.id));
                            setCampusLaunches(null);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : String(err));
                          }
                        });
                      }}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3 text-left transition hover:border-white/30"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{cl.nombre}</div>
                        <div className="text-[10px] text-zinc-500">
                          ID: {cl.id} {cl.fecha ? `· ${cl.fecha}` : ""}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                          cl.activo === "1"
                            ? "border-emerald-500/40 text-emerald-300"
                            : "border-white/10 text-zinc-500"
                        }`}
                      >
                        {cl.activo === "1" ? "Activo" : "Inactivo"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  async function syncFromCampus() {
    setError(null);
    try {
      const { prices } = await syncCheckoutUrlsAction(launchId);
      setPdcPrices(
        prices.map((p) => ({
          id: p.id,
          tipo_pago: p.tipo_pago,
          precio: p.precio,
          moneda: "EUR",
          num_cuotas: p.num_cuotas,
          activo: p.activo,
          stripe_price_id: null,
          checkout_url_stripe: p.checkout_url_stripe,
          checkout_url_whop: p.checkout_url_whop,
        })),
      );
      // Preserve pageKeys assignments after sync (server now preserves them in DB too)
      setPricePageKeys(
        Object.fromEntries(prices.map((p) => [p.id, (p as { pageKeys?: string[] }).pageKeys ?? []])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // ---- Linked ----
  const activePrices = pdcPrices.filter(
    (p) => p.activo === 1 && !p.checkout_url_stripe?.includes("checkout_padre"),
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Linked launch info */}
      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 p-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            Lanzamiento en campus
          </div>
          <div className="mt-1 font-[family-name:var(--font-mono)] text-sm text-white">
            ID: {pdcLaunchId}
          </div>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              setError(null);
              try {
                await disconnectLaunchAction(launchId);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            });
          }}
          className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs uppercase tracking-widest text-red-300 hover:border-red-500/60 hover:text-red-200"
        >
          Desconectar
        </button>
      </div>

      {/* Product section */}
      {!pdcProductId ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateProduct(true);
                loadAccounts();
              }}
              disabled={showCreateProduct}
            >
              Crear producto en campus
            </Button>
          </div>

          {showCreateProduct && (
            <form
              action={(formData) => {
                startTransition(async () => {
                  setError(null);
                  try {
                    await createProductAction(launchId, formData);
                    setShowCreateProduct(false);
                    await loadProductData();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                });
              }}
              className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4"
            >
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                  Nombre del producto
                </span>
                <input
                  name="nombre"
                  type="text"
                  required
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-white/30"
                />
              </label>

              {accounts && accounts.billingAccounts.length > 0 && (
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                    Cuenta de facturacion
                  </span>
                  <select
                    name="cuenta_facturacion"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                  >
                    {accounts.billingAccounts.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {accounts && accounts.stripeAccounts.length > 1 && (
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                    Cuenta Stripe
                  </span>
                  <select
                    name="stripe_account_id"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                  >
                    {accounts.stripeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} {a.es_principal ? "(principal)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex gap-2">
                <SubmitButton pendingLabel="Creando…">Crear producto</SubmitButton>
                <button
                  type="button"
                  onClick={() => setShowCreateProduct(false)}
                  className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Product info */}
          <div className="rounded-lg border border-white/5 bg-black/30 p-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              Producto
            </div>
            <div className="mt-1 text-sm text-white">
              {pdcProduct ? pdcProduct.nombre : `ID: ${pdcProductId}`}
            </div>
            {pdcProduct && (
              <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
                <span
                  className={`rounded-full border px-2 py-0.5 uppercase tracking-widest ${
                    pdcProduct.stripe_product_id
                      ? "border-emerald-500/40 text-emerald-300"
                      : "border-amber-500/40 text-amber-300"
                  }`}
                >
                  Stripe {pdcProduct.stripe_product_id ? "OK" : "pendiente"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 uppercase tracking-widest ${
                    pdcProduct.whop_product_id
                      ? "border-emerald-500/40 text-emerald-300"
                      : "border-zinc-500/40 text-zinc-500"
                  }`}
                >
                  Whop {pdcProduct.whop_product_id ? "OK" : "sin"}
                </span>
              </div>
            )}
          </div>

          {/* All prices */}
          {pdcPrices.filter((p) => !p.checkout_url_stripe?.includes("checkout_padre")).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                  Precios
                </div>
                <div className="text-[10px] text-zinc-600">
                  {activePrices.length} activo{activePrices.length !== 1 ? "s" : ""} de{" "}
                  {pdcPrices.filter((p) => !p.checkout_url_stripe?.includes("checkout_padre")).length}
                </div>
              </div>
              {pdcPrices
                .filter((p) => !p.checkout_url_stripe?.includes("checkout_padre"))
                .map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-lg border p-4 space-y-3 ${
                      p.activo === 1
                        ? "border-white/5 bg-black/30"
                        : "border-white/[0.03] bg-black/10 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${p.activo === 1 ? "text-white" : "text-zinc-500"}`}>
                        {priceLabel(p)}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                            p.activo === 1
                              ? "border-emerald-500/40 text-emerald-300"
                              : "border-red-500/30 text-red-400"
                          }`}
                        >
                          {p.activo === 1 ? "Activo" : "Inactivo"}
                        </span>
                        {p.stripe_price_id && (
                          <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
                            Stripe OK
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Page assignment: show when 2+ prices (choose which goes where) OR 2+ venta pages (A/B) */}
                    {p.activo === 1 && (ventaPages.length > 1 || activePrices.length > 1) && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                          Páginas de venta
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ventaPages.map((vp) => {
                            const assigned = (pricePageKeys[p.id] ?? []).includes(vp.pageKey);
                            return (
                              <button
                                key={vp.pageKey}
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                  const current = pricePageKeys[p.id] ?? [];
                                  const next = assigned
                                    ? current.filter((k) => k !== vp.pageKey)
                                    : [...current, vp.pageKey];
                                  setPricePageKeys((prev) => ({ ...prev, [p.id]: next }));
                                  startTransition(async () => {
                                    try {
                                      const res = await assignPriceToPageAction(
                                        launchId, p.id, next, p.checkout_url_stripe ?? null,
                                      );
                                      if (res.buttonsUpdated) setInjectResult(res.buttonsUpdated);
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : String(err));
                                      setPricePageKeys((prev) => ({ ...prev, [p.id]: current }));
                                    }
                                  });
                                }}
                                className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest transition ${
                                  assigned
                                    ? "border-sky-500/60 bg-sky-500/15 text-sky-300"
                                    : "border-zinc-600 bg-zinc-800/60 text-zinc-300 hover:border-zinc-400 hover:text-white"
                                }`}
                              >
                                {assigned ? "✓ " : ""}{vp.label}
                              </button>
                            );
                          })}
                          {ventaPages.length > 0 && (pricePageKeys[p.id] ?? []).length === 0 && (
                            <span className="text-[10px] text-zinc-600 self-center">
                              Sin asignar — aparece en todas las páginas
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {p.activo === 1 && p.checkout_url_stripe && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                          URL de checkout
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] text-sky-300">
                            {p.checkout_url_stripe}
                          </code>
                          <CopyButton text={p.checkout_url_stripe} />
                        </div>
                      </div>
                    )}

                    {p.activo === 1 && p.checkout_url_whop && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                          URL Whop
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] text-purple-300">
                            {p.checkout_url_whop}
                          </code>
                          <CopyButton text={p.checkout_url_whop} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Add price + sync */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCreatePrice(true)}
              disabled={showCreatePrice}
            >
              Agregar precio
            </Button>
            <Button
              variant="outline"
              onClick={() => startTransition(syncFromCampus)}
              disabled={isPending}
            >
              {isPending ? "Sincronizando…" : "Sincronizar desde campus"}
            </Button>
          </div>

          {showCreatePrice && (
            <form
              action={(formData) => {
                startTransition(async () => {
                  setError(null);
                  try {
                    await createPriceAction(launchId, formData);
                    setShowCreatePrice(false);
                    await loadProductData();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                });
              }}
              className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                    Tipo de pago
                  </span>
                  <select
                    name="tipo_pago"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                  >
                    <option value="unico">Pago unico</option>
                    <option value="cuotas">Cuotas</option>
                    <option value="recurrente">Recurrente</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                    Precio (EUR)
                  </span>
                  <input
                    name="precio"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-white/30"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                    Num cuotas (si aplica)
                  </span>
                  <input
                    name="num_cuotas"
                    type="number"
                    min="2"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-white/30"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <SubmitButton pendingLabel="Creando…">Crear precio</SubmitButton>
                <button
                  type="button"
                  onClick={() => setShowCreatePrice(false)}
                  className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[10px] text-zinc-600">
                Se crea el precio en la base de datos del campus y automaticamente en Stripe y Whop.
              </p>
            </form>
          )}
        </div>
      )}

      {/* How it connects to the landing */}
      {pdcProductId && activePrices.length > 0 && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Pagina de venta
          </div>
          <div className="space-y-3 text-[11px] text-zinc-500">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const res = await updateButtonUrlsAction(launchId);
                      setInjectResult(res.message);
                    } catch (err) {
                      setInjectResult(err instanceof Error ? err.message : "Error al actualizar los botones.");
                    }
                  });
                }}
                disabled={isPending}
                className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
              >
                {isPending ? "Procesando…" : "Actualizar hrefs en página de venta"}
              </button>
              {(() => {
                const assigned = Object.entries(pricePageKeys).find(([, keys]) => keys.includes("venta"));
                return assigned ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span>✓</span>
                    <span>Precio #{assigned[0]} asignado a venta</span>
                  </div>
                ) : null;
              })()}
            </div>
            {injectResult && (
              <p className="text-xs text-zinc-400">{injectResult}</p>
            )}
            <details className="text-zinc-600">
              <summary className="cursor-pointer hover:text-zinc-400">Ver URLs de checkout</summary>
              <div className="mt-2 space-y-2">
                {activePrices.filter((p) => p.checkout_url_stripe).map((p) => (
                  <div key={p.id} className="rounded bg-black/60 p-3 font-[family-name:var(--font-mono)] text-[10px]">
                    <span className="text-zinc-500">&lt;a</span>{" "}
                    <span className="text-amber-300">href</span>
                    <span className="text-zinc-500">=&quot;</span>
                    <span className="text-sky-300">{p.checkout_url_stripe}</span>
                    <span className="text-zinc-500">&quot;</span>{" "}
                    <span className="text-amber-300">data-br</span>
                    <span className="text-zinc-500">=&quot;</span>
                    <span className="text-emerald-300">comprar-externo</span>
                    <span className="text-zinc-500">&quot;&gt;</span>
                    <span className="text-white">{priceLabel(p)}</span>
                    <span className="text-zinc-500">&lt;/a&gt;</span>
                  </div>
                ))}
                <p>El runtime propagara automaticamente el codigo de afiliado (?ref=) a estas URLs.</p>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
