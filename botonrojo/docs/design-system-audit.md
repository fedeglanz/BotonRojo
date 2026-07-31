# Auditoría del sistema de diseño

Estado real de la biblioteca de diseño del generador, a 30 de julio de 2026.
No es una lista de deseos: cada punto dice qué existe hoy, dónde vive y qué falta.

Nada de lo que ya se usaba (`.glass`, `.hud-corners`, `.mesh-bg`…) se ha
eliminado ni cambiado de valor; la única excepción deliberada es
`.big-red-button`, rediseñado a petición del cliente.

## Dónde vive cada cosa

| Pieza | Archivo | Papel |
| --- | --- | --- |
| Primitivas y tokens semánticos (TS) | `src/lib/design/tokens.ts` | Única fuente de verdad para TypeScript |
| Modo de tema y colores derivados | `src/lib/design/theme.ts` | Deduce claro/oscuro de la paleta y resuelve los colores semánticos |
| Presets (estilo, CTA, fondo, separador) | `src/lib/design/presets.ts` | Combinaciones con nombre que se sabe que funcionan |
| Vocabulario por sección | `src/components/public/section-design.ts` | Normaliza, valida y resuelve el diseño de una sección |
| Variables CSS, base, efectos, keyframes | `src/app/globals.css` | Lo que el navegador pinta |
| Capa de decoración | `src/components/public/section-effects.tsx` | Órbita, aurora, retícula, geometría |
| Envoltorio | `src/components/public/section-shell.tsx` | Aplica el diseño sin tocar las 14 secciones |

## Los 12 puntos auditados

### 1. Separación primitivas / semántico — **cumplido**
`tokens.ts` distingue `ColorPrimitives` (lo que aprueba la marca: 4 hex) de
`SemanticColors` (17 entradas: `surface`, `border`, `textMuted`, `textOnAccent`…).
Los componentes solo deberían leer las semánticas; es esa indirección la que
permite que un lanzamiento sea claro y otro oscuro sin tocar un componente.

### 2. Modo de tema deducido de la paleta — **cumplido y en uso**
`deriveThemeMode()` calcula la luminancia relativa WCAG del fondo aprobado:
si supera 0.5 el modo es claro. **No se consulta `prefers-color-scheme`** cuando
hay paleta, que era el requisito explícito: una marca que aprobó blanco no puede
volverse oscura porque el móvil del visitante esté en modo oscuro.

`BrandStyle` emite el conjunto semántico completo como `html:root { … }` en cada
página pública, más `color-scheme` para que los controles nativos (casillas,
barra de desplazamiento, autocompletado) sigan al modo. Se usa `html:root` y no
`:root` a propósito: gana a la regla `html, body` de `globals.css`
independientemente del orden de las hojas de estilo.

No hay bloque de sobreescrituras de modo claro en el CSS, y es deliberado: una
página clara necesita sus superficies mezcladas hacia el negro y sus filetes
oscuros, y eso depende de la paleta concreta. Se calcula en TypeScript.

### 3. Contraste medible, no a ojo — **cumplido**
`contrastRatio()` y `relativeLuminance()` implementan WCAG.
`readableTextOn()` elige blanco o casi-negro sobre un relleno de marca por
cálculo, no por suposición (un acento claro necesita texto oscuro).
`scoreSectionContrast()` devuelve la ratio de una sección para que la revisión
automática avise en vez de depender de que alguien se dé cuenta.

### 4. Vocabulario cerrado — **cumplido**
`normalizeSectionDesign()` descarta cualquier clave o valor fuera del catálogo y
devuelve la lista de incidencias. Esto no es cosmético: la IA generó una vez
`background: {type: "parallax"}`, se guardó tal cual y **tumbó la página pública**
(`Objects are not valid as a React child`). Además solo admite `href` que empiece
por `https?://`, `/` o `#`, lo que bloquea `javascript:`.

### 5. Alias y versionado de esquema — **cumplido**
`SECTION_DESIGN_SCHEMA_VERSION = 2`. `ALIASES` mantiene funcionando claves
antiguas (`bg`, `fx`, `cardStyle`) y valores antiguos (`solid`, `image`, `glow`,
`circle`, `lines`), además de los booleanos `fullHeight` / `fullBleed` de la
primera iteración. Ninguna fila guardada se rompe al leerla.

### 6. Defectos por tipo de sección — **cumplido**
`KIND_DEFAULTS` + `DESIGN_CAPABILITIES` para 10 tipos. Las restricciones son
deliberadas, no decorativas:
- `form` no admite fondo de foto ni órbita: un formulario necesita legibilidad
  máxima y nada que le robe el foco.
- `legal` no admite nada: es un documento, la decoración solo estorba.
- `list`, `cards`, `faq`, `pricing` no van a pantalla completa.

### 7. Corrección de combinaciones imposibles — **cumplido**
Una órbita alrededor de más de 320 caracteres degrada a `aurora`, porque las
etiquetas caen encima del texto. Un fondo `photo` sin imagen resuelta se marca
como incompatible. `checkSectionCompatibility()` permite comprobarlo sin
normalizar.

### 8. Movimiento reducido — **cumplido**
Antes de esta pasada `prefers-reduced-motion` **no aparecía en ningún sitio del
repo**, con 7 animaciones `infinite` corriendo sin condición. Ahora hay
resolución doble en tres niveles:
- CSS: bloque `@media (prefers-reduced-motion: reduce)` que neutraliza todas las
  animaciones y **oculta** las que solo existen para moverse (se quedarían como
  un borrón estático o un anillo a medio dibujar).
- TS: `resolveMotion()` devuelve la duración casi-cero.
- Diseño: `mergeSectionWithTheme()` cambia `aurora`/`orbit` por `geometry`
  cuando el visitante pidió menos movimiento.

### 9. Alto contraste — **cumplido**
`AccessibilityFlags.highContrast` sube los alfas de bordes y texto secundario en
`resolveSemanticColors()`, y `mergeSectionWithTheme()` quita los tintes
decorativos que reducen contraste.

### 10. Escalas y z-index centralizados — **cumplido con una decisión explícita**
`Z_INDEX` en TS y `--z-*` en CSS, misma escala. Las escalas de radio y sombra se
han añadido con nombre **semántico** (`--radius-card`, `--shadow-glow`) y no
numérico a propósito: redefinir `--radius-2xl` o `--shadow-lg` habría cambiado
de tamaño todos los `rounded-2xl` que ya usa la app. Las primitivas numéricas
siguen en `tokens.ts`.

### 11. Base tipográfica y de formularios — **cumplido, dentro de `@layer base`**
Los estilos de elemento van en `@layer base` para que las utilidades de Tailwind
sigan ganando; sin capa, una regla `h1 {}` batiría a `text-4xl` y rompería las
páginas existentes. Titulares fluidos con `clamp()`, `text-wrap: balance` en
titulares y `pretty` en párrafos, `:focus-visible` visible en todas las
superficies, `scroll-margin-top` para que un ancla no quede bajo la cabecera.

Dos reglas se descartaron a conciencia y pasaron a utilidades opt-in
(`.u-measure`, `.u-touch-target`), porque como reglas base habrían roto cosas:
- `min-height: 44px` en todo botón e input gana a `h-8` (min-height bate a
  height) e infla los controles del admin.
- `max-width: 75ch` en todo `<p>` desplaza a la izquierda el texto centrado,
  porque encoge la caja sin recentrarla.

### 12. Catálogo de efectos y animaciones — **cumplido**
22 clases `fx-*` y 15 keyframes con nombre, expuestos también como
`--animate-*` en `@theme` (`animate-fade-up`, `animate-shimmer`…). Todas leen
variables de marca, ninguna tiene un color fijo.

## Fallos encontrados al verificar con una paleta clara

Ninguno era del sistema de diseño nuevo; salieron al mirar de verdad una página
clara renderizada, y estaban en producción:

1. **El servicio de capturas no desactivaba las animaciones.** Las secciones se
   revelan al hacer scroll con framer-motion, que las arranca en `opacity: 0`, y
   una captura `fullPage` redimensiona la ventana en vez de hacer scroll — así
   que `whileInView` no se disparaba nunca y todo lo que había bajo el héroe
   salía en blanco. **La revisión automática de diseño llevaba tiempo puntuando
   capturas vacías.** Ahora el contexto se abre con `reducedMotion: "reduce"`.
2. **El CTA final era invisible.** `CtaBlock` dependía del mismo observador
   partiendo de opacidad 0, y `useReducedMotion()` no sirve de guardia porque
   devuelve `null` en el servidor: la opacidad 0 ya está en el HTML antes de
   conocer la preferencia. Con movimiento reducido no quedaba nada que la
   deshiciera. Ahora la animación siempre se ejecuta y siempre termina visible.
3. **El resplandor de la órbita teñía el texto.** La capa de la órbita está a
   `z-20` para que sus etiquetas sean clicables, y eso ponía también el
   resplandor central por encima de la copia. Se ha partido en dos:
   `SectionOrbitBackdrop` (anillo y resplandor, detrás) y `SectionOrbitLayer`
   (solo las etiquetas, delante).
4. **Las etiquetas de la órbita usaban el fondo de *página* para su pastilla.**
   Dentro de una banda oscura sobre una paleta clara salía pastilla pálida con
   texto blanco forzado. Ahora usan un tinte de marca y heredan el color.
5. **`glass` era el defecto en todas partes.** Es siempre una tarjeta oscura, así
   que el formulario de registro aparecía como un panel casi negro en medio de
   una página blanca. `defaultCardStyleFor()` elige `soft` en modo claro.

## Huecos conocidos

1. **`scoreSectionComplexity()` no está enganchado a la revisión automática** —
   la función mide el ruido visual de cada sección, pero nadie suma todavía las
   puntuaciones de una página para avisar de que hay varios gestos compitiendo
   (regla 10: un solo protagonista).
2. **`fx-conic-border` usa `mask ... exclude`** — soportado en navegadores
   actuales; en uno antiguo el borde se vería como relleno en vez de como anillo.
   Degrada a algo feo, no a algo roto.
3. **`accordion-down` / `accordion-up`** referencian
   `--radix-accordion-content-height`, que solo existe si se usa Radix. Con el
   fallback `auto` la animación no interpola; es la limitación conocida de animar
   altura sin conocerla.

## Lo que queda de la migración

Las 14 secciones ya consumen `resolveVisualStyle()` (caja, relleno por densidad y
hover), y `card-style.ts` se ha eliminado: había dos sistemas paralelos para lo
mismo. Los colores fijos de sólo-oscuro (`border-white/10`, `bg-black/40`,
`text-emerald-300`) se han sustituido por tokens semánticos en las seis páginas
públicas, porque en una paleta clara un filete blanco al 10 % es invisible.

Sigue pendiente: las secciones no usan todavía `align`, `density` ni `divider`
del vocabulario por sección — se normalizan y se guardan, pero sólo `background`,
`effect`, `height` y `width` llegan al DOM.
