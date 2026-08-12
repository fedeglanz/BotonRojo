# Conector MCP: diseñar y publicar páginas desde Claude

Este documento explica cómo funciona el conector, qué decide el plan de la cuenta y
por qué una página diseñada fuera sigue midiendo, cobrando y pagando comisiones.

## Qué resuelve

El generador de Botón Rojo compone páginas a partir del copy y de un sistema de
diseño cerrado. Es rápido y consistente, pero el techo lo pone el propio sistema:
si un cliente quiere una página con una idea visual que no está en el vocabulario,
no hay forma de expresarla.

Claude Design sí puede diseñarla. Lo que no puede es saber a qué endpoint manda el
formulario, cómo se abre el carrito de Stripe, ni cómo se atribuye una venta a un
afiliado. El conector reparte esas dos mitades: **el diseño lo hace Claude, el
comportamiento lo pone la plataforma al publicar.**

## Dos tipos de cuenta

| | Plan `free` / `starter` | Plan `pro` / `enterprise` |
|---|---|---|
| Consultar lanzamientos, contexto y métricas | Sí | Sí |
| `generar_pagina` (sistema de Botón Rojo) | Sí | Sí |
| `publicar_pagina` (HTML propio de Claude Design) | No | Sí |

El gating es por el plan de la organización en Botón Rojo, no por la suscripción de
Claude: no podemos —ni debemos— inspeccionar la cuenta de Claude de nadie. En la
práctica coinciden, porque Claude Design solo está en las cuentas Pro/Max: quien no
la tiene no puede diseñar, y para esa persona el conector expone el generador de la
plataforma, que usa nuestra propia clave de Anthropic y funciona igual.

Un intento de publicar sin plan no falla en silencio: la herramienta devuelve un
mensaje que dice qué plan hace falta y ofrece `generar_pagina` como alternativa.

## Conectar

Un token por persona, creado en **Panel → Conectar Claude**. Se muestra una sola
vez: se guarda solo su SHA-256, así que no hay ninguna pantalla que pueda volver a
mostrarlo. Si se pierde, se crea otro y se revoca el anterior.

```bash
claude mcp add boton-rojo https://TU_DOMINIO/api/mcp \
  --transport http \
  --header "Authorization: Bearer br_mcp_…"
```

En claude.ai, como conector propio, la misma URL. Si el formulario no admite
cabeceras, existe `https://TU_DOMINIO/api/mcp/br_mcp_…`, con el token en la ruta.
Funciona igual y es peor: la URL queda en historiales, registros de proxy y
capturas de pantalla. Está ahí porque sin ella algunos clientes no pueden
conectarse, no porque sea recomendable.

Cada token está atado a una organización. Todas las herramientas releen el
lanzamiento filtrando por esa organización, así que un token no llega a los
lanzamientos de otro cliente ni acertando su id.

## Herramientas

| Herramienta | Para qué |
|---|---|
| `listar_lanzamientos` | Los lanzamientos de la cuenta, su estado y sus páginas |
| `contexto_lanzamiento` | Marca, promesa, avatar, dolores, beneficios, productos con precios, fechas y estado de cada página |
| `contrato_pagina` | Las reglas que tiene que cumplir el HTML (ver abajo) |
| `publicar_pagina` | Publica un HTML propio en una página. Solo pro |
| `ver_pagina` | El HTML publicado ahora mismo, para retocarlo en vez de rehacerlo |
| `retirar_pagina` | Quita el HTML y devuelve la página generada, que seguía debajo |
| `generar_pagina` | Genera la página con el sistema de Botón Rojo desde un brief |
| `metricas_lanzamiento` | Visitas, leads, ventas, ingresos y reparto por afiliado |
| `trabajo_pendiente` | La cola que el panel ha dejado apuntada, en orden |
| `guardar_identidad` | Guarda paleta, tipografías y estilo, y los deja aprobados |

## Crear un lanzamiento entero desde el panel

Al crear un lanzamiento se elige quién diseña. Con **Claude Design**, Botón Rojo no
propone su propia identidad visual —que iba a sustituirse— sino que escribe una
**cola de trabajo**: la identidad visual primero y después cada página no legal.

Esto existe por un límite del protocolo, no por gusto. MCP va en una sola
dirección: Claude llama al servidor, nunca al contrario. La plataforma no puede
poner a trabajar a nadie, así que lo más cerca que se puede estar de "créalo en
Claude" es dejar el trabajo definido y dar un botón que abre Claude Design
diciéndole que lo recorra.

El circuito completo:

1. En el formulario, "Quién diseña este lanzamiento" → Claude Design.
2. Se escriben las tareas en `launch_tasks` y el lanzamiento queda con
   `designMode: "claude"`.
3. El panel muestra la cola y un botón que abre `claude.ai/design` con la
   instrucción de recorrerla.
4. Claude llama a `trabajo_pendiente`, propone la identidad, la guarda con
   `guardar_identidad`, y luego diseña y publica cada página.
5. Cada tarea **se cierra sola**: al guardar la identidad y al publicar cada
   página. Pedir una llamada aparte para decir "ya está" sería una llamada que se
   puede olvidar, y entonces el panel mentiría sobre lo que falta.

En ese modo el panel no ofrece su generador de identidad visual, que sustituiría lo
que Claude acabe de decidir.

El estilo que llega en `guardar_identidad` pasa por el mismo normalizador que el
panel (`normalizeBrandDesign`), así que un valor que no esté en el vocabulario se
ajusta al más cercano en vez de llegar a la página. Los colores, en cambio, se
rechazan si no son hexadecimales: ahí no hay valor cercano que adivinar.

## El contrato

La versión que lee Claude está en [`src/mcp/contract.ts`](../src/mcp/contract.ts) y
se sirve por `contrato_pagina`. En resumen, dos mecanismos deliberadamente
distintos:

**Tokens `{{...}}`**, sustituidos en el servidor al servir la página. Son valores
que el diseñador no puede saber: `{{precio}}`, `{{cierre_carrito}}`,
`{{url_registro}}`… Es sustitución de texto y nada más.

**Atributos `data-br`**, cableados en el navegador por `public/br-runtime.js`. El
comportamiento no se puede sustituir en un texto: un formulario tiene que enviarse
a algún sitio.

| Marca | Qué hace |
|---|---|
| `data-br="lead"` en el `<form>` | Manda el email a `/api/lead` con el afiliado y las UTMs, y sincroniza con ActiveCampaign |
| `data-br="comprar"` | Abre el checkout de Stripe con el afiliado pegado |
| `data-br="cuenta-atras"` | Se rellena desde la fecha de cierre del carrito o del registro |
| `data-br="precio"` | Se rellena con el precio formateado |
| `data-br="ninguno"` | Deja el elemento fuera de todo esto |

La división importa por lo que pasa cuando el diseñador se olvida de algo. Un token
que falta deja una página visiblemente mal. Un `data-br` que falta dejaría un
formulario que no captura nada, y eso no se ve. Por eso el runtime trata como
captación **cualquier formulario con un campo de email** que no esté marcado con
`data-br="ninguno"`: una suposición es mejor que un agujero negro.

## Afiliados

El diseñador no tiene que hacer nada, y esto es lo que lo sostiene:

1. `track.js` guarda `?ref=` en una cookie de 30 días, igual que en las páginas
   generadas.
2. `br-runtime.js` reescribe los enlaces internos para que arrastren el `ref`, de
   modo que pasar de captación a venta no pierde al afiliado — que es justo donde
   se decide la comisión.
3. El `ref` viaja en el lead y en el checkout, y el webhook de Stripe lo convierte
   en la comisión.

El `ref` de la URL manda sobre el de la cookie: un clic recién hecho de un afiliado
no debe perder contra la atribución de una visita anterior.

Único caso que lo rompe: construir enlaces internos por JavaScript después de
cargar la página. Si un diseño lo hace, tiene que llamar a
`window.BotonRojoRuntime.wire()` al terminar.

## Cómo se guarda una página publicada

Como un asset más (`kind: "landing"`, el `pageKey` de la página), con el cuerpo
`{ format: "html", html, files }`. Dos consecuencias buscadas:

- **La página generada no se pierde.** Publicar inserta una versión nueva; la
  anterior sigue debajo, y `retirar_pagina` borra solo las versiones de diseño
  propio para que la generada vuelva a ser la más reciente.
- **El panel sigue funcionando** — el listado, el "Ver", el histórico — porque no es
  un tipo nuevo de asset, solo un cuerpo con otro formato.

Los archivos (`css`, `js`, imágenes, fuentes, vídeo) van a object storage bajo un
prefijo nuevo en cada publicación, y las rutas relativas del HTML se reescriben al
servir. Un prefijo nuevo cada vez evita que republicar se sirva desde una copia
cacheada del archivo anterior con el mismo nombre.

No se admite SVG entre los archivos: se serviría desde nuestro propio origen y un
SVG puede llevar script, así que sería XSS del mismo origen. Un SVG en línea dentro
del HTML sí, que es como lo usa un diseño de todas formas.

Si el HTML referencia un archivo que no llega, **publicar falla** con la lista de lo
que falta. Es más incómodo y mucho mejor que publicar una página con imágenes rotas,
que nadie nota hasta que lo nota el cliente.

## Renderizado

Una página publicada se sirve dentro del cascarón de la app, no como documento
suelto. El documento se despieza (`src/lib/custom-page.ts`) y se vuelve a emitir:

- lo de dentro de `<body>` como markup,
- las clases y el `style` del `<body>` en el contenedor,
- los `<style>` y los `<link rel=stylesheet>` como elementos,
- los `<script>` **como elementos de verdad**.

Eso último no es un detalle: el markup inyectado con `dangerouslySetInnerHTML`
nunca ejecuta sus scripts. Sin volver a emitirlos, una página diseñada con
cualquier interactividad se vería bien y no haría nada.

El despiece usa un parser (`node-html-parser`), no expresiones regulares. La entrada
es una página entera con SVG en línea, plantillas dentro de los scripts y CSS que
contiene `</`; toda versión con regex de esto acaba comiéndose media página.

## Límites de esta versión

- Solo páginas que ya existen en el lanzamiento. Crear páginas nuevas implica tocar
  `pageConfig` y todavía no se hace desde el conector.
- Las páginas legales no se pueden sustituir: su texto lo mantiene la plataforma.
- El editor en la propia página (`?editar=1`) no actúa sobre una página de diseño
  propio: ahí se edita rediseñando y volviendo a publicar, o retirándola.
