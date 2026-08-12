# Desplegar en el VPS

Todo va en Docker en un único servidor: la app, Postgres, Redis, MinIO, el servicio
de capturas y Caddy delante. Caddy es quien resuelve el HTTPS —incluido el de los
dominios propios de cada cliente— y por eso el conector de Claude puede conectarse:
claude.ai exige `https` y tiene que poder alcanzar el servidor desde internet.

## Lo que hace falta antes

1. Un servidor con Docker y `docker compose` (el VPS de Contabo).
2. Un dominio con un registro **A** apuntando a la IP del servidor. Si vas a usar
   subdominios de clientes, añade también `*.tudominio.com` al mismo sitio.
3. Los puertos **80** y **443** abiertos. El 80 no es opcional: es por donde
   Let's Encrypt valida el certificado.

## Primer despliegue

```bash
ssh usuario@IP
git clone <repo> botonrojo && cd botonrojo/botonrojo
cp .env.example .env
```

En `.env`, lo que **tiene** que cambiar respecto a desarrollo:

| Variable | Valor |
|---|---|
| `APP_URL` | `https://tudominio.com` |
| `NEXTAUTH_URL` | `https://tudominio.com` |
| `NEXTAUTH_SECRET` | uno nuevo: `openssl rand -base64 32` |
| `APP_ENCRYPTION_KEY` | uno nuevo: `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | una contraseña de verdad |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | credenciales nuevas de MinIO |
| `S3_PUBLIC_URL` | `https://tudominio.com/archivos` o el bucket público que uses |
| `SCREENSHOT_SERVICE_TOKEN` | uno nuevo |

`S3_PUBLIC_URL` es el que más se olvida: es la URL con la que el navegador del
visitante pide las imágenes y los `css` de las páginas publicadas. Si se queda
apuntando a `localhost:9000`, las páginas cargan sin estilos y nadie entiende por
qué.

En `deploy/Caddyfile`, sustituye `example.com` por el dominio real y
`admin@example.com` por un correo tuyo (ahí llegan los avisos de caducidad de los
certificados).

Y arranca:

```bash
docker compose up -d --build
docker compose logs -f app
```

El contenedor de la app aplica las migraciones y ejecuta el seed —que es
idempotente— antes de arrancar el servidor, así que no hay ningún paso manual de
base de datos. En los logs se ve:

```
[entrypoint] Running migrations...
[entrypoint] Running seed (idempotent)...
[entrypoint] Starting server...
```

## Comprobaciones

```bash
curl -I https://tudominio.com/login                    # 200
curl -s https://tudominio.com/api/mcp -X POST \
  -H "Authorization: Bearer br_mcp_…" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 200
```

Lo segundo tiene que devolver la lista de herramientas. Si devuelve
`{"error":"unauthorized"}`, el token no es de esa base de datos: los tokens se
crean en cada instalación desde **Panel → Conectar Claude**, y los de tu portátil
no valen en el servidor.

## Tokens del conector: no tocar los de nadie

Los tokens no caducan. El único sitio que los revoca es el botón del panel, filtrado
por id y por organización, así que un token deja de valer solo cuando alguien lo
revoca a propósito.

Si haces pruebas contra producción, **revoca los tuyos por id**:

```sql
update mcp_tokens set revoked_at = now() where id = 'tok_lo_que_sea';
```

Nunca por estado:

```sql
-- MAL: se lleva por delante los tokens que están en uso
update mcp_tokens set revoked_at = now() where revoked_at is null;
```

Esto pasó dos veces: el token de trabajo de JC apareció revocado al mismo segundo
que un token de prueba, y desde fuera parecía que el producto los caducaba solo.

## Actualizar

```bash
cd botonrojo/botonrojo
git pull
docker compose up -d --build app
```

Las migraciones nuevas se aplican solas al arrancar. Ojo con una cosa: Drizzle
decide qué migraciones faltan comparando la marca de tiempo del `_journal.json`,
no el contenido del archivo — así que editar una migración ya aplicada no hace
nada, hay que generar una nueva.

## Por qué `trustHost`

Auth.js en producción rechaza cualquier petición cuyo `Host` no esperaba, y aquí
todas llegan desde Caddy. El síntoma no parece de autenticación: la sesión se lee
como ausente y todas las páginas del panel rebotan a `/login` para siempre. Está
puesto en `src/lib/auth.ts` y es seguro porque la app solo escucha en localhost:
lo único que puede llamarla es Caddy, que fija `Host` y `X-Forwarded-*`.

## Dominios propios de los clientes

No hay que tocar el Caddyfile por cada uno. El bloque `:443` con `on_demand` pide
un certificado la primera vez que alguien entra por ese dominio, pero solo si
`/api/domains/ask` confirma que es un dominio verificado en la base de datos. Sin
esa comprobación, cualquiera apuntando un DNS a la IP conseguiría que emitiéramos
certificados a su nombre.
