"use server";

import { redirect } from "next/navigation";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { hashPassword, signIn } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { createSlug } from "@/lib/ids";

export async function getOrganizationBySlug(slug: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return org ?? null;
}

const signUpSchema = z.object({
  organizationName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signUpOrganizationAction(formData: FormData) {
  const parsed = signUpSchema.parse({
    organizationName: formData.get("organizationName"),
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: formData.get("password"),
  });

  const [existingUser] = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  if (existingUser) throw new Error("email_already_used");

  let slug = createSlug(parsed.organizationName);
  if (!slug) slug = `organizacion-${Date.now().toString(36)}`;
  const [slugTaken] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (slugTaken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const [org] = await db
    .insert(organizations)
    .values({ name: parsed.organizationName, slug })
    .returning();
  if (!org) throw new Error("organization_create_failed");

  const passwordHash = await hashPassword(parsed.password);
  await db.insert(users).values({
    organizationId: org.id,
    email: parsed.email,
    name: parsed.name,
    role: "admin",
    passwordHash,
  });

  await signIn("credentials", {
    email: parsed.email,
    password: parsed.password,
    redirectTo: "/admin",
  });
}

// ---------- Platform (superadmin) ----------

export async function listOrganizations() {
  await requireSuperAdmin();
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  const withCounts = await Promise.all(
    rows.map(async (org) => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.organizationId, org.id));
      return { ...org, userCount: row?.count ?? 0 };
    }),
  );

  return withCounts;
}
