"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { externalSalesSources, launches } from "@/db/schema";
import type { ExternalSalesSource } from "@/db/schema/external-sales";
import { requireOrgAdmin } from "@/lib/auth-helpers";

function safeIdent(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`identificador no válido: ${name}`);
  return name;
}

function safeFilterFragment(sql: string): string {
  if (sql.includes(";")) throw new Error("el filtro no puede contener ';'");
  return sql;
}

export async function listExternalSalesSources() {
  const { organizationId } = await requireOrgAdmin();
  return db
    .select({
      id: externalSalesSources.id,
      launchId: externalSalesSources.launchId,
      launchName: launches.name,
      label: externalSalesSources.label,
      kind: externalSalesSources.kind,
      host: externalSalesSources.host,
      port: externalSalesSources.port,
      database: externalSalesSources.database,
      salesTableHint: externalSalesSources.salesTableHint,
      amountColumn: externalSalesSources.amountColumn,
      dateColumn: externalSalesSources.dateColumn,
      amountDivisor: externalSalesSources.amountDivisor,
      extraFilterSql: externalSalesSources.extraFilterSql,
      lastCheckedAt: externalSalesSources.lastCheckedAt,
      lastCheckOk: externalSalesSources.lastCheckOk,
      lastCheckMessage: externalSalesSources.lastCheckMessage,
    })
    .from(externalSalesSources)
    .innerJoin(launches, eq(externalSalesSources.launchId, launches.id))
    .where(eq(externalSalesSources.organizationId, organizationId))
    .orderBy(externalSalesSources.createdAt);
}

const addSchema = z.object({
  launchId: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["mysql", "postgres"]),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  salesTableHint: z.string().optional(),
  amountColumn: z.string().optional(),
  dateColumn: z.string().optional(),
  amountDivisor: z.coerce.number().int().min(1).default(1),
  extraFilterSql: z.string().optional(),
});

export async function addExternalSalesSourceAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const parsed = addSchema.parse({
    launchId: formData.get("launchId"),
    label: formData.get("label"),
    kind: formData.get("kind"),
    host: formData.get("host"),
    port: formData.get("port"),
    database: formData.get("database"),
    username: formData.get("username"),
    password: formData.get("password"),
    salesTableHint: formData.get("salesTableHint") || undefined,
    amountColumn: formData.get("amountColumn") || undefined,
    dateColumn: formData.get("dateColumn") || undefined,
    amountDivisor: formData.get("amountDivisor") || undefined,
    extraFilterSql: formData.get("extraFilterSql") || undefined,
  });

  const [launch] = await db
    .select({ id: launches.id })
    .from(launches)
    .where(and(eq(launches.id, parsed.launchId), eq(launches.organizationId, organizationId)))
    .limit(1);
  if (!launch) throw new Error("launch_not_found");

  await db.insert(externalSalesSources).values({ ...parsed, organizationId });
  revalidatePath("/admin/ajustes");
}

const updateColumnsSchema = z.object({
  id: z.string().min(1),
  salesTableHint: z.string().optional(),
  amountColumn: z.string().optional(),
  dateColumn: z.string().optional(),
  amountDivisor: z.coerce.number().int().min(1).default(1),
  extraFilterSql: z.string().optional(),
});

export async function updateExternalSalesSourceColumnsAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const parsed = updateColumnsSchema.parse({
    id: formData.get("id"),
    salesTableHint: formData.get("salesTableHint") || undefined,
    amountColumn: formData.get("amountColumn") || undefined,
    dateColumn: formData.get("dateColumn") || undefined,
    amountDivisor: formData.get("amountDivisor") || undefined,
    extraFilterSql: formData.get("extraFilterSql") || undefined,
  });

  await db
    .update(externalSalesSources)
    .set({
      salesTableHint: parsed.salesTableHint ?? null,
      amountColumn: parsed.amountColumn ?? null,
      dateColumn: parsed.dateColumn ?? null,
      amountDivisor: parsed.amountDivisor,
      extraFilterSql: parsed.extraFilterSql ?? null,
    })
    .where(and(eq(externalSalesSources.id, parsed.id), eq(externalSalesSources.organizationId, organizationId)));

  revalidatePath("/admin/ajustes");
}

export async function removeExternalSalesSourceAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing_id");
  await db
    .delete(externalSalesSources)
    .where(and(eq(externalSalesSources.id, id), eq(externalSalesSources.organizationId, organizationId)));
  revalidatePath("/admin/ajustes");
}

export type ExternalSalesSummary = { count: number; revenueCents: number };

/**
 * Runs a COUNT + SUM against the client's own sales table using the column
 * names the admin configured — we don't control that schema, so there's no
 * way to know column names up front the way endtrack hardcoded its own.
 * Identifiers are whitelisted to [A-Za-z0-9_] before interpolation; values
 * are always passed as query parameters.
 */
export async function queryExternalSalesSummary(
  source: ExternalSalesSource,
  range?: { from: Date; to: Date },
): Promise<ExternalSalesSummary | null> {
  if (!source.salesTableHint || !source.amountColumn) return null;

  const table = safeIdent(source.salesTableHint);
  const amountCol = safeIdent(source.amountColumn);
  const dateCol = source.dateColumn ? safeIdent(source.dateColumn) : null;
  const extraFilter = source.extraFilterSql ? safeFilterFragment(source.extraFilterSql) : null;

  if (source.kind === "mysql") {
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
      host: source.host,
      port: source.port,
      database: source.database,
      user: source.username,
      password: source.password,
      connectTimeout: 5000,
    });
    try {
      let sql = `SELECT COUNT(*) AS n, COALESCE(SUM(\`${amountCol}\`), 0) AS total FROM \`${table}\``;
      const params: unknown[] = [];
      const clauses: string[] = [];
      if (dateCol && range) {
        clauses.push(`\`${dateCol}\` BETWEEN ? AND ?`);
        params.push(range.from, range.to);
      }
      if (extraFilter) clauses.push(`(${extraFilter})`);
      if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
      const [rows] = await conn.query(sql, params);
      const row = (rows as { n: number; total: string | number }[])[0];
      return {
        count: Number(row?.n ?? 0),
        revenueCents: Math.round((Number(row?.total ?? 0) * 100) / source.amountDivisor),
      };
    } finally {
      await conn.end();
    }
  }

  const postgres = (await import("postgres")).default;
  const sql = postgres({
    host: source.host,
    port: source.port,
    database: source.database,
    username: source.username,
    password: source.password,
    connect_timeout: 5,
    max: 1,
  });
  try {
    const clauses: string[] = [];
    const params: (Date | string)[] = [];
    if (dateCol && range) {
      clauses.push(`"${dateCol}" BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(range.from, range.to);
    }
    if (extraFilter) clauses.push(`(${extraFilter})`);
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = await sql.unsafe(
      `SELECT COUNT(*) AS n, COALESCE(SUM("${amountCol}"), 0) AS total FROM "${table}"${where}`,
      params,
    );
    const row = rows[0] as unknown as { n: string | number; total: string | number } | undefined;
    return {
      count: Number(row?.n ?? 0),
      revenueCents: Math.round((Number(row?.total ?? 0) * 100) / source.amountDivisor),
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function testExternalSalesSourceAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing_id");

  const [source] = await db
    .select()
    .from(externalSalesSources)
    .where(and(eq(externalSalesSources.id, id), eq(externalSalesSources.organizationId, organizationId)))
    .limit(1);
  if (!source) throw new Error("source_not_found");

  let ok = false;
  let message = "";

  try {
    const summary = await queryExternalSalesSummary(source);
    if (summary) {
      const euros = (summary.revenueCents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
      message = `Conectado. ${summary.count.toLocaleString("es-ES")} ventas, ${euros} en total (histórico).`;
    } else if (source.kind === "mysql") {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({
        host: source.host,
        port: source.port,
        database: source.database,
        user: source.username,
        password: source.password,
        connectTimeout: 5000,
      });
      try {
        if (source.salesTableHint) {
          const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${safeIdent(source.salesTableHint)}\``);
          const count = (rows as { n: number }[])[0]?.n ?? 0;
          message = `Conectado. ${count.toLocaleString("es-ES")} filas en ${source.salesTableHint}. Configura la columna de importe para ver ventas.`;
        } else {
          await conn.query("SELECT 1");
          message = "Conectado. Configura la tabla y columna de importe para ver ventas.";
        }
      } finally {
        await conn.end();
      }
    } else {
      const postgres = (await import("postgres")).default;
      const sql = postgres({
        host: source.host,
        port: source.port,
        database: source.database,
        username: source.username,
        password: source.password,
        connect_timeout: 5,
        max: 1,
      });
      try {
        if (source.salesTableHint) {
          const rows = await sql.unsafe(`SELECT COUNT(*) AS n FROM "${safeIdent(source.salesTableHint)}"`);
          const count = Number(rows[0]?.n ?? 0);
          message = `Conectado. ${count.toLocaleString("es-ES")} filas en ${source.salesTableHint}. Configura la columna de importe para ver ventas.`;
        } else {
          await sql`SELECT 1`;
          message = "Conectado. Configura la tabla y columna de importe para ver ventas.";
        }
      } finally {
        await sql.end({ timeout: 1 });
      }
    }
    ok = true;
  } catch (err) {
    message = err instanceof Error ? err.message : "Error de conexión desconocido.";
  }

  await db
    .update(externalSalesSources)
    .set({ lastCheckedAt: new Date(), lastCheckOk: ok, lastCheckMessage: message })
    .where(eq(externalSalesSources.id, id));

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/estadisticas");
}
