# El servidor de Estelarys, para el otro programador

Todo lo que hace falta para entrar, cambiar algo y dejarlo publicado. Está escrito
para alguien que no ha tocado este servidor nunca.

La plataforma vive en **https://botonrojo.estelarys.com**. El nombre antiguo,
`botonrojo.escuelanomadadigital.com`, redirige aquí conservando la ruta y **sigue
sirviendo `/api/`** — ahí apuntan el conector de Claude y los webhooks de Stripe y
Telegram, y ninguno reintenta un 301.

## Antes de nada: las claves

No están en el repositorio. JC tiene un `credenciales.txt` en la raíz de
`botonrojo/` (está en el `.gitignore`) con el acceso SSH, el usuario del panel y el
del superadmin. Pídeselo por un canal privado; en este documento no hay ninguna
contraseña a propósito — un `.md` acaba en un pull request, en una captura o en un
chat, y lo que hay dentro ya no se puede recoger.

## La forma del servidor

Un VPS de Contabo, **194.163.129.230**, Debian con **Hestia CP**, y no es solo
nuestro: ahí hay una docena de sitios más, un Grafana, un n8n y un Kimai. La regla
número uno es no tocar nada que no sea de Botón Rojo.

```
/opt/botonrojo/botonrojo        ← el código y el docker-compose
  .env                         ← configuración real (no está en git)
  deploy/data/                 ← Postgres, Redis y MinIO en disco. NO BORRAR.
  deploy/hestia/               ← copia de las plantillas de nginx que usa Hestia
```

En Docker corren cinco contenedores:

| Contenedor | Qué es | Puerto en el host |
|---|---|---|
| `botonrojo-app-1` | la app Next.js | 127.0.0.1:3020 |
| `botonrojo-postgres-1` | la base de datos | ninguno |
| `botonrojo-redis-1` | colas y estado efímero | ninguno |
| `botonrojo-minio-1` | los archivos (imágenes, css publicados) | 127.0.0.1:9000 |
| `botonrojo-screenshot-1` | Chromium para capturas y anuncios | ninguno |

Delante manda **nginx de Hestia**, no Caddy: el 80 y el 443 ya eran suyos y
quitárselos tumbaría los otros sitios. Hestia pone el HTTPS con su Let's Encrypt y
hace de proxy al 3020. El dominio de la plataforma está bajo el usuario de Hestia
`estelarys`; el dominio antiguo y los dominios de cliente, bajo `end`.

Y por encima de todo, **Cloudflare**: `estelarys.com` está en Cloudflare con la nube
naranja. Consecuencias prácticas: lo que sirvas con `Cache-Control` largo se queda
cacheado en el borde aunque lo borres del origen, y la IP que ves en los logs de la
app es la del visitante porque nginx pasa el `X-Forwarded-For` que trae Cloudflare.

## Entrar

```bash
ssh root@194.163.129.230
cd /opt/botonrojo/botonrojo
docker compose -f docker-compose.prod.yml ps
docker logs -f --tail 100 botonrojo-app-1
```

## Desplegar un cambio

El código llega por **rsync desde tu portátil**. El repositorio es privado y el
servidor no tiene credenciales de GitHub, así que un `git pull` allí falla.

```bash
# desde la raíz de botonrojo/ en tu máquina, con el cambio ya commiteado
pnpm build                        # compila aquí primero: un error de build en el
                                  # servidor deja la app parada varios minutos

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .env \
  --exclude deploy/data --exclude .git --exclude credenciales.txt \
  ./ root@194.163.129.230:/opt/botonrojo/botonrojo/

ssh root@194.163.129.230 'cd /opt/botonrojo/botonrojo && \
  docker compose -f docker-compose.prod.yml up -d --build app'
```

Tres cosas de esos comandos que no son adorno:

1. **Siempre `-f docker-compose.prod.yml`.** Los dos ficheros comparten el nombre de
   proyecto, así que un `docker compose up` a secas no arranca algo al lado: recrea
   *estos mismos* contenedores con la configuración de desarrollo, que publica Redis
   en un puerto que el sistema ya ocupa. Resultado: Redis no arranca, la app no
   arranca, y el sitio se queda en 502. Ya pasó, y costó cuatro minutos de caída.
2. **Los `--exclude` de `.env` y `deploy/data`.** Con `--delete` puesto y sin ellos,
   te llevas por delante la configuración y la base de datos.
3. **`--build app`** y no todo: reconstruir el resto no hace falta y tarda.

Las migraciones de Drizzle se aplican solas al arrancar el contenedor, y el seed es
idempotente. En los logs se ve `Running migrations… / Migrations applied.`

Ojo con una cosa de Drizzle: decide qué migraciones faltan por la marca de tiempo
del `_journal.json`, no por el contenido. Editar una migración ya aplicada no hace
nada — hay que generar otra con `pnpm db:generate`.

## Mirar la base de datos

```bash
docker exec -it botonrojo-postgres-1 psql -U botonrojo -d botonrojo
```

Antes de cualquier `update` o `delete` en producción, la copia:

```bash
docker exec botonrojo-postgres-1 pg_dump -U botonrojo -d botonrojo -t assets \
  > /root/assets-$(date +%F).sql
```

## Los logs

```bash
docker logs --tail 200 botonrojo-app-1                                  # la app
tail -f /var/log/apache2/domains/botonrojo.estelarys.com.log            # peticiones
tail -f /var/log/nginx/domains/botonrojo.escuelanomadadigital.com.log   # el antiguo
```

Sí, el del dominio nuevo está bajo `apache2/`: es donde Hestia manda los logs del
usuario que lo aloja. No hay Apache sirviendo nada.

## Conectar el dominio de un cliente

Dos partes y las dos hacen falta. El cliente apunta un registro `A` a
`194.163.129.230` (o un `CNAME` a `botonrojo.estelarys.com`), y aquí se da de alta:

```bash
/opt/botonrojo/botonrojo/deploy/conectar-dominio.sh paginas.cliente.com
```

El script comprueba primero el DNS —pedir el certificado antes gasta uno de los
cinco intentos semanales de Let's Encrypt—, crea el dominio en Hestia, le pone la
plantilla de proxy y saca el certificado. Si el dominio está detrás de Cloudflare,
avisa y sigue: el desafío pasa igual.

Después, en el panel del lanzamiento → Conexiones → añadir el dominio y Verificar.
Sin ese último paso el nombre resuelve y la app contesta 404, porque no sabe a qué
lanzamiento pertenece.

## Probar como si fueras un visitante

El contenedor de capturas tiene Playwright, así que sirve de navegador sin instalar
nada en tu máquina:

```bash
docker cp script.js botonrojo-screenshot-1:/app/
docker exec -w /app botonrojo-screenshot-1 node script.js
docker cp botonrojo-screenshot-1:/app/captura.png /tmp/
```

Un aviso que cuesta horas si no se sabe: desde ese contenedor, la app se alcanza
como `http://app:3000`, y a ese `Host` el middleware responde como si fuera un
dominio de cliente desconocido — 404. Usa siempre la URL pública.

## Cosas que hay que saber antes de tocar

- **Los tokens del conector de Claude se revocan por id, nunca por estado.** Un
  `update mcp_tokens set revoked_at = now() where revoked_at is null` se lleva por
  delante los que están en uso, y desde fuera parece que el producto los caduca
  solo. Pasó dos veces.
- **`trustHost: true` en Auth.js** es obligatorio aquí: la app está detrás de un
  proxy y sin eso todas las sesiones se leen como ausentes y el panel rebota a
  `/login` para siempre.
- **`S3_PUBLIC_URL`** es la URL con la que el navegador del visitante pide las
  imágenes de las páginas publicadas. Si algún día cambia el dominio, es el que más
  se olvida de los tres (`APP_URL`, `NEXTAUTH_URL` y este).
- **Cloudflare cachea.** Si has cambiado algo servido con `Cache-Control` largo y no
  lo ves, comprueba el origen directamente antes de buscar el fallo en el código:
  `docker exec botonrojo-app-1 wget -qO- http://127.0.0.1:3000/...`
- **La rama es `develop`.** Se trabaja ahí y se despliega desde ahí.

## Cuando algo se rompe

| Síntoma | Primero mira |
|---|---|
| 502 en todo el sitio | `docker compose -f docker-compose.prod.yml ps` — casi siempre es la app parada por un build fallido |
| El panel rebota a `/login` | `NEXTAUTH_URL` en `.env` y que el contenedor se haya recreado tras cambiarlo |
| Una página pública da 404 | ¿el dominio está verificado en el panel del lanzamiento? |
| Las imágenes de una página no cargan | `S3_PUBLIC_URL`, y que MinIO esté arriba |
| El conector de Claude falla | `curl -X POST https://botonrojo.estelarys.com/api/mcp -H "Authorization: Bearer …"` — si contesta `unauthorized`, es el token; si no contesta, es la app |

## Documentación relacionada

- `docs/despliegue.md` — el despliegue desde cero y cómo cambiar el dominio de la
  plataforma.
- `docs/mcp-claude-design.md` — el conector: herramientas, contrato de diseño y qué
  puede hacer Claude.
