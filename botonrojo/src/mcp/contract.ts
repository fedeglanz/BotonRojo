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

## Los valores del lanzamiento: escribe el de verdad

Escribe en el diseño el valor real, el que te da \`contexto_lanzamiento\` en
\`valores_listos\` (precio, plazos, fechas de cierre, nombre, promesa y las rutas
internas, ya formateados). Así la vista previa se ve terminada y puedes juzgar el
diseño: un \`{{precio}}\` en medio de una página se lee como un error, porque lo es.

Y para lo que puede cambiar después, marca además el elemento:

| Marca | Qué hace la plataforma al servir la página |
|---|---|
| \`data-br="precio"\` | Sustituye el texto por el precio que haya en ese momento |
| \`data-br="plazos"\` | Igual con "3 pagos de 39,90 €" |
| \`data-br="cuenta-atras"\` | Recalcula el tiempo que queda |

Es decir: \`<span data-br="precio">97 €</span>\`. En la vista previa se ve "97 €" y
en la página en vivo se ve lo que valga el día que alguien entre. Lo mismo con la
cuenta atrás: pon números creíbles como relleno y déjala marcada.

Con la promesa, el nombre y las rutas internas no hace falta marcar nada: escríbelos
tal cual. Si el cliente cambia la promesa, la página se rediseña.

Los \`{{tokens}}\` de antes (\`{{precio}}\`, \`{{promesa}}\`, \`{{cierre_carrito}}\`…)
siguen funcionando por si te encuentras una página vieja que los usa, pero no los
escribas en un diseño nuevo: no se ven hasta que la página está publicada.

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

**Las imágenes van por \`url\`, nunca en base64. Se rechazan.** Para mandar una foto en
\`contenido\` tendrías que escribirla entera como texto: una imagen de 3 MB son más
de un millón de tokens, la llamada no termina y la publicación se queda colgada.
Pon la url y la descarga el servidor:

\`\`\`json
{ "nombre": "jc.jpg", "url": "https://donde-este/la-foto.jpg" }
\`\`\`

\`contenido\` es solo para css y js pequeños. Si la imagen no está en ninguna url —
por ejemplo, la acabas de generar tú—, súbela antes al lanzamiento desde el panel
(Marca → imágenes) y usa la url que te dé, o enlázala con su url absoluta en el
HTML y no la mandes en \`archivos\`: una url absoluta se deja tal cual.

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

## Dirección de arte: que no parezca una plantilla

Las páginas de este producto son la primera impresión de un lanzamiento, y una
página correcta pero plana —titular centrado, tres tarjetas iguales, un botón— hace
que el producto parezca barato aunque no lo sea. Trabájalas.

**Un gesto protagonista por página.** Una idea visual que se recuerde y que solo
podría ser de este lanzamiento: una forma que atraviesa la pantalla, un objeto que
se monta al entrar, un fondo que reacciona. Uno, no cinco: cinco gestos compiten
entre sí y no gana ninguno.

**Animación SVG de verdad, en línea y sin librerías.** No un fundido genérico:

- trazos que se dibujan solos — \`stroke-dasharray\` + \`stroke-dashoffset\`
  animados: subrayados, flechas, círculos que rodean una palabra, líneas que
  conectan pasos;
- formas que se transforman, con \`<animate>\` sobre la \`d\` de un \`path\` o
  interpolando \`clip-path\`;
- degradados en movimiento dentro del propio SVG (\`<linearGradient>\` con
  \`animateTransform\`, o animando \`--angulo\` con \`@property\`);
- máscaras que revelan al hacer scroll;
- ruido y grano con \`<feTurbulence>\` para que los degradados no se vean digitales.

**Movimiento al entrar en pantalla**, con \`animation-timeline: view()\` o un
\`IntersectionObserver\` de cuatro líneas. Regla dura: el estado FINAL es el visible.
Si la animación no llega a ejecutarse, la página tiene que estar entera igualmente —
un \`opacity: 0\` de partida sin red de seguridad es una página en blanco.

**Profundidad, no un fondo de color.** Capas con desenfoque, degradados de malla,
grano, luces que se salen del bloque, un poco de solape entre secciones. Que se note
que hay planos.

**Tipografía con contraste fuerte.** Titular de 4 a 6 veces el cuerpo, tracking
negativo en los display grandes, 60–70 caracteres por línea en el texto largo. El
contraste de tamaño es lo que hace que una página se lea de un vistazo.

**Micro-interacciones.** Botones y tarjetas que responden al ratón con
\`transform\` y sombra, 150–250 ms, \`ease-out\`. Y el botón principal, distinto de
todo lo demás de la página.

**Detalle hecho a mano.** Un subrayado dibujado, una marca sobre una palabra, iconos
propios en SVG. Nada de emojis como iconografía y nada de imágenes de relleno: si
falta una foto, resuélvelo con formas, degradados y tipografía.

Tres cosas que no son negociables:

1. **\`prefers-reduced-motion: reduce\`**: un bloque que deja todo quieto. No es
   decoración, es que hay gente a la que el movimiento le marea.
2. **Solo \`transform\` y \`opacity\`** en lo que se anima. Animar \`width\`,
   \`height\`, \`top\` o \`left\` recalcula el diseño en cada fotograma y en un móvil
   se ve a tirones.
3. **El texto que hay que leer no se mueve.** Que aparezca, sí; que flote mientras
   se lee, no.

Y lo que delata una plantilla, por si sirve de lista de "no": todo centrado, tres
tarjetas idénticas en fila, iconos de librería, un héroe con titular y botón y nada
más, secciones separadas por líneas grises, sombras iguales en todo.

## El logo y las fotos del cliente

Las imágenes reales del lanzamiento las tienes en \`listar_fotos\`: el logo de la
marca y la biblioteca de fotos, cada una con su url ya alojada. Enlázalas por su url
absoluta y no las mandes en \`archivos\`.

**El logo no se sustituye nunca.** Ni por una versión tipográfica, ni por un icono
parecido, ni por "algo que hace el mismo papel". Es la marca de otra persona y
cambiarla sin que lo pidan es lo más grave que puede hacer un rediseño: pasó de
verdad —un cliente se encontró el logo de su marca convertido en texto— y se
descubrió por un mensaje suyo, no por un aviso. Si no tienes el logo o no puedes
subirlo, **para y pregunta**.

Lo mismo con las fotos: si el diseño necesita una imagen que no existe, hay dos
caminos y ninguno es inventarse un sustituto:

- \`subir_foto\` con su url, si la tienes en algún sitio público;
- \`generar_foto\` con una descripción, y la hace Magnific con la paleta y el mood
  del lanzamiento.

Las dos devuelven la url definitiva. Y si lo que falta es la cara del cliente o su
producto, eso no se genera: se pide.

## Lo que no debes hacer

- No metas tu propia analítica ni pixels de terceros: la medición ya va dentro.
- No apuntes el formulario a un endpoint tuyo ni a un servicio externo.
- No uses \`<html>\`/\`<head>\`/\`<body>\` como sitio donde poner lógica: se conservan
  las clases y el estilo del \`<body>\`, los \`<style>\`, los \`<link>\` y los
  \`<script>\`, pero el documento se sirve dentro del cascarón de la plataforma.
- No pongas el precio a mano: usa \`{{precio}}\` o \`data-br="precio"\`, o dejará de
  cuadrar el día que cambie.`;
