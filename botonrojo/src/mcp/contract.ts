/**
 * The contract a designed page has to honour.
 *
 * Handed to Claude as a tool result rather than kept in our docs, because the
 * model doing the designing is the one that has to follow it. Written as
 * instructions to a designer, not as reference: "put this attribute here", because
 * a page that forgets `data-br="comprar"` is a sales page with a dead button.
 */
export const PAGE_CONTRACT = `# Cómo diseñar una página para Botón Rojo

Diseñas un documento HTML completo. Puedes usar el CSS y el JS que quieras, en
línea o en archivos aparte. Lo que NO tienes que programar es el formulario, el
pago, la cuenta atrás ni la medición: eso lo cablea la plataforma cuando publica la
página, a partir de estos atributos.

## Comportamiento (atributos data-br)

| Marca | Dónde | Qué hace la plataforma |
|---|---|---|
| \`data-br="lead"\` | en el \`<form>\` de captación | Manda el email a la plataforma, guarda el lead con su afiliado y sus UTMs, y lo sincroniza con ActiveCampaign |
| \`data-br-next="/gracias"\` | en el mismo \`<form>\` | A dónde llevar después. Sin esto se queda en la página y muestra \`[data-br="lead-ok"]\` |
| \`data-br="lead-ok"\` | cualquier elemento, con \`hidden\` | Se muestra al enviar bien |
| \`data-br="estado"\` | dentro del \`<form>\` | Recibe los mensajes ("Enviando…", errores) |
| \`data-br="comprar"\` | en el \`<a>\` o \`<button>\` de compra | Abre el checkout de Stripe con el afiliado y las UTMs pegadas |
| \`data-br-producto="slug"\` | junto a \`data-br="comprar"\` | Qué producto. Si el lanzamiento tiene uno solo, se puede omitir |
| \`data-br="cuenta-atras"\` | contenedor | Se rellena y va bajando cada segundo |
| \`data-br-fecha="carrito"\` o \`"registro"\` | junto a la cuenta atrás | Qué fecha usa. Por defecto, el carrito |
| \`data-br-unidad="dias\\|horas\\|minutos\\|segundos"\` | dentro de la cuenta atrás | Huecos por unidad, para maquetarla como quieras. Sin ellos se escribe en una línea |
| \`data-br-fin="Cerrado"\` | junto a la cuenta atrás | Qué poner cuando llega a cero |
| \`data-br="precio"\` | cualquier elemento | Se rellena con el precio formateado |
| \`data-br="ninguno"\` | cualquier elemento | Déjalo fuera de todo esto |

El formulario necesita un \`input\` con \`name="email"\`. Si además pones
\`name="name"\` (o \`nombre\`) y \`name="phone"\` (o \`telefono\`), se guardan.

Si se te olvida \`data-br="lead"\`, la plataforma trata como captación cualquier
formulario que tenga un campo de email. Es una red de seguridad, no una excusa:
márcalo.

## Valores del lanzamiento ({{tokens}})

Se sustituyen al publicar. Escríbelos tal cual en el HTML:

- \`{{nombre}}\` — nombre del lanzamiento
- \`{{promesa}}\` — la promesa
- \`{{precio}}\` — precio formateado ("97 €")
- \`{{precio_sin_formato}}\` — el número ("97")
- \`{{moneda}}\` — "EUR"
- \`{{cierre_carrito}}\` / \`{{cierre_registro}}\` — fechas en ISO
- \`{{url_registro}}\` / \`{{url_venta}}\` / \`{{url_gracias}}\` — rutas internas
- \`{{slug}}\` — slug del lanzamiento

Un \`{{...}}\` que no esté en esta lista se queda como está: no inventes tokens.

## Afiliados

No hagas nada. La plataforma reescribe los enlaces internos para arrastrar el
\`?ref=\` del afiliado, y lo adjunta al lead y a la compra. Lo único que puede
romperlo es construir enlaces internos por JavaScript después de cargar la página:
si lo haces, llama a \`window.BotonRojoRuntime.wire()\` al terminar.

## Archivos

Si el diseño referencia \`estilos.css\`, \`fondo.webp\`, etc. con rutas relativas,
mándalos en \`archivos\` al publicar. La plataforma los aloja y reescribe las rutas.
No hace falta que los pongas en línea ni que sepas la URL final. Una referencia
relativa sin archivo hace que publicar falle: es mejor eso que una imagen rota.

## Páginas nuevas

Si el lanzamiento no tiene la página que hace falta, créala: \`crear_pagina\` con un
nombre y un tipo (\`registro\`, \`venta\`, \`contenido\`, \`afiliados\`). El nombre se
convierte en la URL: "Webinar de junio" → \`/slug/webinar-de-junio\`. El tipo decide
qué cablea la plataforma, así que elígelo por lo que la página tiene que conseguir,
no por su aspecto.

También puedes publicar directamente sobre una página que no existe pasando
\`crear\` con el tipo: se crea y se publica de una vez.

Una página creada así se lleva desde aquí a partir de ese momento. Para cambiarla,
pide su HTML con \`ver_pagina\`, retócalo y vuelve a publicar; el panel no la toca a
propósito, porque regenerarla la sustituiría por una página del sistema.

## Lo que no debes hacer

- No metas tu propia analítica ni pixels de terceros: la medición ya va dentro.
- No apuntes el formulario a un endpoint tuyo ni a un servicio externo.
- No uses \`<html>\`/\`<head>\`/\`<body>\` como sitio donde poner lógica: se conservan
  las clases y el estilo del \`<body>\`, los \`<style>\`, los \`<link>\` y los
  \`<script>\`, pero el documento se sirve dentro del cascarón de la plataforma.
- No pongas el precio a mano: usa \`{{precio}}\` o \`data-br="precio"\`, o dejará de
  cuadrar el día que cambie.`;
