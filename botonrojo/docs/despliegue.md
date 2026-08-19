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
curl -I https://botonrojo.estelarys.com/login          # 200
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

## Conectar el dominio de un cliente

Dos partes, y las dos hacen falta: los DNS del cliente y el alta en este servidor.

**1. El cliente apunta su dominio aquí.** Vale cualquiera de las dos:

| Registro | Nombre | Valor |
|---|---|---|
| `A` | el subdominio (o `@` si es el dominio raíz) | `194.163.129.230` |
| `CNAME` | el subdominio | `botonrojo.estelarys.com` |

**2. Se da de alta en el servidor**, porque nginx no sirve un nombre que no conoce:

```bash
/opt/botonrojo/botonrojo/deploy/conectar-dominio.sh paginas.cliente.com
```

El script comprueba primero que el DNS ya apunta aquí —pedir el certificado antes
gastaría uno de los cinco intentos por semana que da Let's Encrypt—, crea el dominio en
Hestia, le pone la plantilla de proxy y saca el certificado.

**3. En el panel del lanzamiento**, añadir el dominio y darle a Verificar.

Sin el paso 2 el nombre resuelve pero no carga: el visitante se encuentra el sitio por
defecto del servidor o un aviso de certificado. Con Caddy esto se habría resuelto solo
—su TLS a demanda pide el certificado en la primera visita— pero aquí manda nginx, y
esa comodidad se cambió por no tumbar los otros doce sitios del servidor.

## Cambiar el dominio de la plataforma

Pasó una vez —de `botonrojo.escuelanomadadigital.com` a `botonrojo.estelarys.com`—
y son cuatro sitios, no uno:

1. **El vhost y el certificado**, igual que un dominio de cliente:
   `deploy/conectar-dominio.sh botonrojo.nuevodominio.com`. Si el nombre está ya
   dado de alta en Hestia bajo otro usuario, basta con cambiarle la plantilla de
   proxy y pedirle el certificado con `v-add-letsencrypt-domain <usuario> <dominio>`.
2. **El `.env`**: `APP_URL`, `NEXTAUTH_URL` y `S3_PUBLIC_URL`. Los tres, y el
   tercero es el que se olvida: es el que usan las páginas publicadas para pedir
   sus imágenes. Luego `docker compose -f docker-compose.prod.yml up -d
   --force-recreate app` — sin `--force-recreate` el contenedor sigue con el
   entorno viejo.
3. **El dominio antiguo, redirigido**: se le pone la plantilla
   `botonrojo_redirect` (en `deploy/hestia/`), que hace un 301 conservando la ruta.
   Sin eso, el nombre viejo llega a la app como un dominio de cliente que no
   conoce y contesta 404 — que no es "esto se ha movido". Y no se borra: está
   escrito en enlaces, en el conector de Claude y en páginas ya publicadas.
4. **Lo que ya estaba guardado**: las páginas y los correos publicados llevan URLs
   absolutas del dominio viejo dentro del cuerpo. El 301 las salva, pero conviene
   reescribirlas (con copia antes):

   ```sql
   update assets
      set body = replace(body::text, 'dominio.viejo', 'dominio.nuevo')::jsonb
    where body::text like '%dominio.viejo%';
   ```

Y avisar de una cosa que no se arregla desde el servidor: **el conector de Claude
apunta a la URL vieja**. Los tokens siguen valiendo —son filas de la base de
datos, no dependen del nombre— pero hay que editar la URL del conector en
claude.ai a `https://<dominio nuevo>/api/mcp`.

## Actualizar

```bash
cd /opt/botonrojo/botonrojo
docker compose -f docker-compose.prod.yml up -d --build app
```

**Siempre con `-f docker-compose.prod.yml`.** Los dos ficheros comparten el nombre de
proyecto (`botonrojo`), así que un `docker compose up` a secas no arranca otra cosa al
lado: recrea *estos mismos* contenedores con la configuración de desarrollo. Y esa
publica Redis en el 6379 del host, que aquí ya lo ocupa el Redis del sistema, con lo
que Redis no arranca, la app no arranca y el sitio se queda en 502 hasta que se vuelve
a levantar con el fichero bueno. Pasó el 18 de agosto y costó cuatro minutos de caída.

El código llega por `rsync` desde el portátil —el repo es privado y el servidor no
tiene credenciales de GitHub, así que `git pull` ahí falla:

```bash
rsync -az --delete --exclude node_modules --exclude .next --exclude .env \
  --exclude deploy/data --exclude .git \
  ./ root@194.163.129.230:/opt/botonrojo/botonrojo/
```

Los `--exclude` de `.env` y `deploy/data` no son optimización: con `--delete` puestos,
sin ellos se borran la configuración y la base de datos del servidor.

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
