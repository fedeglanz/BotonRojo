/**
 * The client's own web-design rulebook, condensed into something a generator
 * can act on. Injected into every page-generation prompt (and audited by the
 * design review) so it's enforced rather than aspirational. Full version:
 * docs/reglas-diseno-web.md
 */
export const DESIGN_RULES = `REGLAS DE DISEÑO — obligatorias, compruébalas antes de responder:

1. UN OBJETIVO POR PÁGINA. Una sola acción dominante. No compitas con enlaces ni bloques
   que distraigan del CTA principal.
2. JERARQUÍA VISUAL. Estructura clara: titular → subtítulo → contenido → CTA. Lo más
   importante, más grande; y pocos elementos "grandes" para que de verdad destaquen.
3. MENOS RUIDO. Nada decorativo que no aporte función. Texto breve, directo, fácil de
   escanear. Un solo botón principal.
4. RETÍCULA Y ESPACIADO. Ritmo consistente; el espacio en blanco separa ideas y agrupa lo
   relacionado. No amontones.
5. CONSISTENCIA. Mismos patrones en tarjetas, botones y bloques a lo largo de la página.
6. LEGIBILIDAD. Párrafos cortos, líneas de longitud moderada, contraste suficiente. Si un
   párrafo pasa de 4-5 líneas, pártelo o resúmelo.
7. MÓVIL PRIMERO. Piensa el orden en pantalla pequeña: lo esencial arriba. Titulares que
   no se rompan mal, CTA alcanzable con el pulgar.
8. ACCESIBILIDAD. No comuniques nada solo con el color. Textos alternativos útiles.
9. RENDIMIENTO. Nada de efectos pesados sin valor real.
10. SORPRENDER CON CRITERIO. Base limpia y usable + UN gesto visual protagonista, no diez
    a la vez.

PREFERENCIAS EXPLÍCITAS DEL CLIENTE (aplícalas, le importan):
- Mucho contraste: entre tamaños de letra (muy grande junto a muy pequeña), entre formas y
  entre colores.
- Jugar con geometría básica (círculos, arcos, rectángulos) como recurso visual.
- Los efectos le gustan, sobre todo el de un círculo con elementos girando alrededor que se
  paran al pasar el ratón. Úsalos con criterio: uno protagonista por página, no en todas
  las secciones.

CÓMO SE APLICA AQUÍ: el titular del hero corto y contundente; los textos de sección
escaneables; y si usas el diseño por sección, un único efecto llamativo en la página.`;
