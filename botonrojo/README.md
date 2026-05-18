# Botón Rojo · Lanzamientos

Sistema de lanzamientos digitales para Escuela Nómada Digital. Reemplaza el
plugin de WordPress `endtrack` y añade generación de copy, landings, emails,
anuncios y carritos. Self-hosted en tu Contabo VPS vía Docker.

## Stack

- **Next.js 15** (App Router, TypeScript, standalone) — sirve UI + API.
- **PostgreSQL 16** + **Drizzle ORM**.
- **Redis 7** + **BullMQ** para colas (emails, generación IA, anuncios).
- **MinIO** (S3 compatible) para storage de assets, lead magnets y vídeos.
- **Caddy** como reverse proxy con HTTPS automático (Let's Encrypt).
- **Auth.js v5** (credenciales + roles `admin` / `affiliate` / `customer`).
- **Stripe** Checkout + webhooks.
- **Anthropic SDK** (Claude Sonnet 4.6) para todos los generadores.
- **Resend** + React Email para envío transaccional.
- **Framer Motion** + Tailwind v4 para UI futurista.

## Arranque local

```bash
cd botonrojo
cp .env.example .env
# pon NEXTAUTH_SECRET con openssl rand -base64 32

# Postgres + Redis + MinIO en local
docker compose up -d postgres redis minio

# Dependencias y migraciones
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Servidor de desarrollo
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Despliegue en Contabo

1. **Apunta tu dominio** (A record) a la IP del VPS.
2. Clona el repo en el VPS: `git clone ... && cd botonrojo`.
3. Copia tu `.env` (con secretos de producción) y edita
   `deploy/Caddyfile` cambiando `example.com` por tu dominio y `admin@example.com`
   por tu email.
4. Arranca todo:

   ```bash
   docker compose up -d --build
   docker compose exec app node -e "require('./src/db/migrate.ts')"
   ```

   Caddy levantará HTTPS automáticamente (Let's Encrypt).

5. **Webhook Stripe**: en el dashboard de Stripe apunta a
   `https://tu-dominio.com/api/stripe/webhook` y copia el secret a
   `STRIPE_WEBHOOK_SECRET`.

## Tracking en landings externas

Si tienes landings fuera de Next.js (otra web, embed, etc.):

```html
<script
  src="https://tu-dominio.com/track.js"
  data-launch="ejemplo-venta-directa"
  defer
></script>
```

API JS:

```js
window.BotonRojo.track('lead', { email: 'x@y.com', name: 'Juan' });
window.BotonRojo.track('sale', { email: 'x@y.com', amountCents: 9700, product: 'Curso X' });
```

## Estructura

```
src/
├─ app/                    Pages + API routes (App Router)
│  ├─ api/track/           Tracking endpoint (sustituye ENDtrack)
│  ├─ api/stripe/          Checkout + webhook
│  └─ (admin)/admin/       Panel privado
├─ components/             UI: futurístico, admin, public
├─ db/schema/              Drizzle: users, launches, events, products, assets, affiliates
├─ lib/                    auth, stripe, tracking, env, bots, geoip, utils
├─ ai/prompts/             Prompts Claude (marco copy, landing, ads, emails)
├─ email/templates/        React Email
└─ integrations/           Redis, MinIO, Resend, Telegram
```

## ActiveCampaign

El sistema usa ActiveCampaign como infraestructura de email principal. Por cada
lanzamiento, el wizard puede:

1. **Crear la lista** `Lanz: <nombre>` en tu cuenta de AC.
2. **Crear los tags** `<slug>-registro`, `<slug>-comprador`, `<slug>-evento`, `<slug>-carrito-abandono`.
3. **Subir los emails generados** por Claude como **plantillas** (Templates) en AC para que tú las uses dentro de tus automations.
4. **Sincronizar contactos automáticamente**: cuando alguien deja email en una landing (tracking → `lead`) o compra (Stripe webhook → `sale`), se crea/actualiza el contacto en AC, se suscribe a la lista del lanzamiento y se aplica el tag correspondiente.

Configura en `.env`:

```
ACTIVECAMPAIGN_API_URL=https://TUCUENTA.api-us1.com
ACTIVECAMPAIGN_API_KEY=tu_key
ACTIVECAMPAIGN_FROM_NAME=Escuela Nómada Digital
ACTIVECAMPAIGN_FROM_EMAIL=hola@escuelanomadadigital.com
```

(API URL y key los encuentras en AC → Settings → Developer.)

## Wizard de lanzamiento

Flujo en `/admin/lanzamientos/nuevo`:

1. Brief → crea borrador.
2. Generar **Marco** (avatar, promesa, dolores, beneficios) con Claude.
3. Generar **Landing** desde el Marco.
4. Generar **Secuencia de emails** específica por tipo de lanzamiento.
5. Generar **Anuncios** Meta + Google (UGC, voz en off, clips YouTube + CTA).
6. Crear **Producto en Stripe** (product + price).
7. **Provisionar ActiveCampaign** (lista + tags) y subir plantillas de emails.

Cada paso vive en `src/server/launches.ts` como server action y se puede regenerar de forma independiente.

## Próximas fases (roadmap)

- **Fase 1** ✅: tracking + afiliados + checkout Stripe + panel base.
- **Fase 2** ✅: wizard Marco → Landing → Emails → Anuncios → Stripe → AC.
- **Fase 3** (siguiente): panel de afiliados (registro, generación de códigos, dashboard de stats por lanzamiento, pagos).
- **Fase 4**: lead magnets + pop-ups + banners RRSS + Telegram bot.
- **Fase 5**: biblioteca de lanzamientos anteriores (importación de etiquetas AC, automatizaciones, copy histórico).

## Notas

- El plugin WordPress original queda intacto en `../home/end/...` como referencia, no se modifica.
- Resend es el único componente no self-hosted (la entregabilidad de email auto-hosteado es un dolor). Si necesitas full self-host, podemos cambiar a [Postal](https://docs.postalserver.io/) más adelante.
- El detector de bots y la lógica de `?ref=`/UTM están portados del plugin original (ver `src/lib/bots.ts` y `src/lib/tracking.ts`).
