# Reglas básicas de diseño web

Este documento resume los principios clave para diseñar una web que se vea profesional, funcione bien y cause una impresión sólida desde el primer vistazo. Un buen diseño no depende solo de “verse bonito”: también debe guiar al usuario, facilitar la lectura, adaptarse al móvil y reducir fricción en cada interacción.

> **Cómo se aplica en este proyecto:** la versión condensada de estas reglas vive en
> `src/ai/prompts/design-rules.ts` y se inyecta en cada generación de página (landing,
> registro, contenido). Además, la revisión automática de diseño
> (`src/ai/prompts/design-review.ts`) audita las capturas reales contra este checklist.
> No es un documento aspiracional: si cambias algo aquí, cámbialo también allí.

## 1. Diseña con un objetivo claro

Cada página debe tener un propósito principal y una acción dominante. Si una pantalla intenta vender, informar, captar leads y explicar todo a la vez, el resultado suele ser confuso.

Aplicación práctica:
- Define una única acción principal por pantalla.
- Coloca el CTA principal en una zona visible.
- Reduce enlaces, banners o bloques que compitan con esa acción.

## 2. Crea jerarquía visual

La jerarquía visual guía la mirada hacia lo más importante usando tamaño, contraste, color y agrupación. Cuando esa jerarquía está bien construida, el usuario entiende más rápido qué debe leer primero y qué debe hacer después.

Aplicación práctica:
- Usa una estructura clara: título, subtítulo, contenido y CTA.
- Haz más grande el elemento más importante y limita los elementos “grandes” para que de verdad destaquen.
- Usa el contraste para destacar acciones clave sin saturar la interfaz.
- A mi personalmente me encanta el contraste, letras grandes y pequeñas, contraste entre formas, constraste entre colores... Y también jugar con la geometría básica me encanta.

## 3. Menos ruido, más claridad

La simplicidad mejora la comprensión, reduce la carga mental y hace que la navegación sea más intuitiva. Una página sorprendente no suele ser la que más efectos tiene, sino la que hace evidente el mensaje con pocos elementos bien elegidos.

Aplicación práctica:
- Elimina elementos decorativos que no aporten función.
- Evita varios botones principales compitiendo entre sí.
- Usa texto breve, directo y fácil de escanear.

## 4. Usa una retícula y espaciado consistente

Las retículas ayudan a alinear bloques, crear ritmo visual y hacer que la página se perciba ordenada. El espacio en blanco no es espacio perdido: separa ideas, agrupa contenido relacionado y mejora la legibilidad.

Aplicación práctica:
- Trabaja con columnas y márgenes consistentes.
- Mantén una escala de espaciado repetible, por ejemplo 8, 16, 24 y 32 px.
- Evita ajustar elementos “a ojo” si rompen la alineación general.

## 5. Mantén consistencia visual

La consistencia en colores, tipografías, botones, iconos y estructuras genera confianza y hace que la experiencia sea predecible. Cuando cada sección parece hecha con reglas distintas, la marca pierde fuerza y la interfaz se siente menos profesional.

Aplicación práctica:
- Limita la paleta de color y define roles claros para cada color.
- Usa una escala tipográfica estable para títulos, subtítulos y texto base.
- Repite patrones de diseño en cards, formularios, botones y navegación.

## 6. Prioriza la legibilidad

Un diseño potente falla si el contenido cuesta leerlo. La lectura mejora con tamaños adecuados, contraste suficiente, párrafos cortos y una estructura visual fácil de escanear.

Aplicación práctica:
- Usa texto base de tamaño cómodo y líneas de longitud moderada.
- Separa el contenido con títulos, listas y bloques cortos.
- Asegura contraste suficiente entre texto y fondo.

## 7. Diseña mobile-first

Una web bien diseñada debe funcionar en distintos tamaños de pantalla y dispositivos de entrada. El diseño responsive no es un extra: hoy es parte central de la calidad de la experiencia.

Aplicación práctica:
- Diseña primero la versión móvil y luego escala hacia desktop.
- Usa botones y áreas táctiles cómodas para tocar.
- Simplifica menús y prioriza el contenido clave en pantallas pequeñas.

## 8. Haz la web accesible

La accesibilidad mejora la usabilidad para todo el mundo, no solo para personas con discapacidad. Una web accesible debe poder usarse con teclado, lectores de pantalla, distintos niveles de visión y sin depender únicamente del color para comunicar información.

Aplicación práctica:
- Garantiza navegación por teclado y foco visible.
- Añade texto alternativo útil en imágenes relevantes.
- No uses solo color para indicar errores, estados o prioridades.
- Respeta preferencias de movimiento reducido y evita animaciones molestas o parpadeos.

## 9. Cuida el rendimiento

La percepción de calidad también depende de la velocidad. Una página lenta transmite peor experiencia, genera abandono y reduce el impacto del diseño, aunque visualmente sea buena.

Aplicación práctica:
- Optimiza imágenes y usa formatos modernos cuando sea posible.
- Reduce scripts innecesarios y evita efectos pesados sin valor real.
- Mantén estable el layout para evitar saltos visuales durante la carga.

## 10. Sorprender con criterio

Un diseño que sorprende no necesita exagerar; necesita intención. El efecto memorable suele aparecer cuando una base limpia y usable se combina con uno o dos recursos diferenciales, como una hero potente, una composición muy cuidada, una tipografía con personalidad o microinteracciones discretas.

Aplicación práctica:
- Construye primero una base clara, usable y consistente.
- Introduce un gesto visual protagonista, no diez a la vez.
- Haz que el estilo refuerce el mensaje de la marca y no solo “decoración”.
- Mete efectos casi siempre, me encantan los efectos que sea un círculo y alrededor cosas que van dando vueltas y que si pasas con el ratón se pare, y algunos sean clicables.

## Checklist rápido

- Un objetivo principal por página.
- Jerarquía visual clara.
- Diseño simple y sin ruido.
- Retícula y espaciado consistentes.
- Tipografía legible y buen contraste.
- Consistencia de componentes y marca.
- Buena experiencia móvil.
- Accesibilidad real.
- Carga rápida.
- Un toque diferencial bien medido.

## Criterio final

La mejor regla para una web bien diseñada es esta: cada elemento debe tener una función clara, visual o funcional. Si algo no mejora comprensión, conversión, identidad o experiencia, probablemente sobra.

---

## Cómo está implementado (referencia técnica)

| Regla | Dónde vive en el código |
|---|---|
| Efectos con criterio (regla 10) | `src/components/public/section-effects.tsx` — órbita, geometría, resplandor y retícula. Vocabulario cerrado: la IA elige de esa lista, no inventa CSS. |
| Movimiento reducido (regla 8) | `@media (prefers-reduced-motion: reduce)` en `src/app/globals.css` + `useReducedMotion()` en `src/components/public/reveal.tsx`. |
| Foco visible y teclado (regla 8) | Los elementos clicables de la órbita son `<a>` reales con `:focus-visible`. |
| Fondo / altura / ancho por sección | `src/components/public/section-design.ts` + `section-shell.tsx`. |
| Validación de lo que pide la IA | `normalizeSectionDesign()` en `src/components/public/landing-types.ts` — descarta cualquier valor fuera del catálogo. |
