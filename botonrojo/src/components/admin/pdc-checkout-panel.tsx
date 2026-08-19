"use client";

import { useState, useTransition } from "react";
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

type Props = {
  launchId: string;
  configured: boolean;
  pdcLaunchId: number | null;
  pdcProductId: number | null;
  pdcPriceIds: number[];
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
  fetchAccountsAction: (launchId: string) => Promise<{
    stripeAccounts: Array<{ id: number; nombre: string; es_principal: number }>;
    billingAccounts: Array<{ value: string; label: string }>;
  }>;
};

export function PdcCheckoutPanel({
  launchId,
  configured,
  pdcLaunchId,
  pdcProductId,
  pdcPriceIds,
  listLaunchesAction,
  connectLaunchAction,
  createLaunchAction,
  disconnectLaunchAction,
  createProductAction,
  createPriceAction,
  fetchProductAction,
  fetchAccountsAction,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  // ---- Linked ----
  // Load product data on first render when linked
  if (!productLoaded && pdcProductId) {
    loadProductData();
  }

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
        <div className="space-y-3">
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

          {/* Prices */}
          {pdcPrices.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                Precios
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {pdcPrices
                  .filter((p) => p.activo === 1 && !p.checkout_url_stripe?.includes("checkout_padre"))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-white/5 bg-black/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white">
                          {p.precio}€
                          {p.tipo_pago === "cuotas" && p.num_cuotas
                            ? ` x ${p.num_cuotas} cuotas`
                            : p.tipo_pago === "recurrente"
                              ? "/mes"
                              : " pago unico"}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                            p.stripe_price_id
                              ? "border-emerald-500/40 text-emerald-300"
                              : "border-amber-500/40 text-amber-300"
                          }`}
                        >
                          {p.stripe_price_id ? "Stripe OK" : "Pendiente"}
                        </span>
                      </div>
                      {p.checkout_url_stripe && (
                        <div className="mt-1 truncate font-[family-name:var(--font-mono)] text-[10px] text-zinc-500">
                          {p.checkout_url_stripe}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Add price */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCreatePrice(true)}
              disabled={showCreatePrice}
            >
              Agregar precio
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

      {/* Summary when fully set up */}
      {pdcProductId && pdcPrices.length > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
          El checkout del campus esta configurado. Los compradores pueden pagar directamente
          desde las URLs de checkout generadas arriba.
        </div>
      )}
    </div>
  );
}
