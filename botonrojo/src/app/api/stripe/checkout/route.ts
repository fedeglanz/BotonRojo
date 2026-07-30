import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  productSlug: z.string(),
  email: z.string().email().optional(),
  ref: z.string().optional(),
  launchId: z.string().optional(),
  utm: z.record(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const [product] = await db.select().from(products).where(eq(products.slug, parsed.data.productSlug)).limit(1);
  if (!product || !product.stripePriceId || !product.organizationId) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const session = await createCheckoutSession(product.organizationId, {
    priceId: product.stripePriceId,
    successUrl: `${env.APP_URL}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${env.APP_URL}/${product.slug}`,
    customerEmail: parsed.data.email,
    affiliateRef: parsed.data.ref,
    launchId: parsed.data.launchId,
    utm: parsed.data.utm,
  });

  return NextResponse.json({ url: session.url });
}
