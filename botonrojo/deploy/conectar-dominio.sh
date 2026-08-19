#!/usr/bin/env bash
#
# Da de alta el dominio de un cliente en este servidor y le saca certificado.
#
# Hace falta porque aquí no manda Caddy sino nginx de Hestia, y nginx no sirve un
# nombre que no conoce: por muy bien apuntados que estén los DNS, hasta que el dominio
# no tiene su bloque y su certificado, la visita se come el sitio por defecto del
# servidor o un aviso de certificado. Caddy lo habría resuelto solo con su TLS a
# demanda; con Hestia es este comando.
#
# Lo que hace, y por qué en este orden:
#   1. Comprueba que el DNS ya apunta aquí. Pedir un certificado antes de eso gasta
#      uno de los cinco intentos por semana que da Let's Encrypt y no sirve de nada.
#   2. Crea el dominio web en Hestia bajo el usuario que aloja Botón Rojo.
#   3. Le asigna la plantilla de proxy, que es la que manda el tráfico a la app.
#   4. Pide el certificado.
#
# Uso:
#   ./conectar-dominio.sh paginas.cliente.com
#
set -euo pipefail

DOMINIO="${1:-}"
USUARIO_HESTIA="${HESTIA_USER:-end}"
PLANTILLA="${HESTIA_PROXY_TPL:-botonrojo_proxy}"
IP_SERVIDOR="${SERVER_IPV4:-194.163.129.230}"
V="/usr/local/hestia/bin"

if [[ -z "$DOMINIO" ]]; then
  echo "Uso: $0 dominio.del.cliente" >&2
  exit 1
fi

echo "→ Comprobando a dónde apunta $DOMINIO…"
RESUELVE="$(dig +short A "$DOMINIO" | tail -1 || true)"
if [[ -z "$RESUELVE" ]]; then
  # Puede venir por CNAME hacia nuestro dominio, que también vale.
  RESUELVE="$(dig +short "$DOMINIO" | tail -1 || true)"
fi

if [[ "$RESUELVE" != "$IP_SERVIDOR" ]]; then
  # Detrás de Cloudflare (la nube naranja) el nombre resuelve a una IP de ellos y
  # nunca a la nuestra. No es un error: el tráfico llega igual, y la validación de
  # Let's Encrypt por HTTP también, porque Cloudflare deja pasar el desafío hasta
  # el origen. Así se conectó botonrojo.estelarys.com, con la nube puesta.
  NS="$(dig +short NS "$(echo "$DOMINIO" | rev | cut -d. -f1,2 | rev)" | tr 'A-Z' 'a-z')"
  if [[ "$NS" == *cloudflare* ]]; then
    echo "   ⚠ Resuelve a ${RESUELVE:-nada}, que es de Cloudflare: el dominio está"
    echo "     proxeado. Se sigue adelante — el certificado se valida a través suyo."
    echo "     Si falla, pide que pongan la nube en gris (DNS only) y repite."
  else
    echo "   ✗ Resuelve a '${RESUELVE:-nada}' y esperábamos $IP_SERVIDOR." >&2
    echo "     Si los DNS se acaban de tocar, espera a que propaguen y repite." >&2
    echo "     Pedir el certificado ahora gastaría uno de los cinco intentos" >&2
    echo "     semanales que da Let's Encrypt para este nombre." >&2
    exit 1
  fi
else
  echo "   ✓ Apunta aquí."
fi

if $V/v-list-web-domain "$USUARIO_HESTIA" "$DOMINIO" >/dev/null 2>&1; then
  echo "→ El dominio ya existe en Hestia; no se vuelve a crear."
else
  echo "→ Creando el dominio en Hestia…"
  $V/v-add-web-domain "$USUARIO_HESTIA" "$DOMINIO" "$IP_SERVIDOR"
fi

echo "→ Asignando la plantilla de proxy ($PLANTILLA)…"
$V/v-change-web-domain-proxy-tpl "$USUARIO_HESTIA" "$DOMINIO" "$PLANTILLA"

echo "→ Pidiendo el certificado…"
if $V/v-add-letsencrypt-domain "$USUARIO_HESTIA" "$DOMINIO"; then
  echo "   ✓ Certificado emitido."
else
  echo "   ✗ No se ha podido emitir. Revisa que el puerto 80 esté abierto y" >&2
  echo "     que el nombre resuelva desde fuera, y repite." >&2
  exit 1
fi

# Forzar https: una landing servida por http acaba marcada como no segura en el
# navegador del visitante, que es justo el que hay que convencer.
$V/v-add-web-domain-ssl-force "$USUARIO_HESTIA" "$DOMINIO" >/dev/null 2>&1 || true

nginx -t && systemctl reload nginx
echo
echo "Listo: https://$DOMINIO"
echo "Ahora, en el panel del lanzamiento, dale a Verificar en ese dominio."
