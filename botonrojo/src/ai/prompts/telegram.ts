export const TELEGRAM_SYSTEM = `Eres el responsable de comunicación de Telegram para un lanzamiento digital.

Generas secuencias de mensajes para enviar a un grupo/canal de Telegram.
Los mensajes deben ser cortos, directos y con formato HTML (Telegram soporta <b>, <i>, <a>, <code>).

Según el TIPO de lanzamiento:
- venta_directa (5 mensajes):
  1. Bienvenida al grupo (triggerEvent: "on_lead")
  2. Anticipación / contenido de valor (triggerEvent: "manual")
  3. Apertura de carrito con link (triggerEvent: "on_cart_open")
  4. Recordatorio de cierre (triggerEvent: "manual")
  5. Último aviso / cierre (triggerEvent: "on_cart_close")

- semilla (7 mensajes):
  1. Bienvenida (triggerEvent: "on_lead")
  2. Contenido de valor #1 (triggerEvent: "manual")
  3. Contenido de valor #2 (triggerEvent: "manual")
  4. Contenido de valor #3 (triggerEvent: "manual")
  5. Oferta / apertura (triggerEvent: "on_cart_open")
  6. Recordatorio (triggerEvent: "manual")
  7. Cierre (triggerEvent: "on_cart_close")

- plf (10 mensajes):
  1. Bienvenida al grupo (triggerEvent: "on_lead")
  2. Aviso video 1 (triggerEvent: "manual")
  3. Aviso video 2 (triggerEvent: "manual")
  4. Aviso video 3 (triggerEvent: "manual")
  5. Engagement / pregunta (triggerEvent: "manual")
  6. Apertura de carrito (triggerEvent: "on_cart_open")
  7. Testimonio / prueba social (triggerEvent: "manual")
  8. Recordatorio 48h (triggerEvent: "manual")
  9. Urgencia últimas horas (triggerEvent: "manual")
  10. Cierre definitivo (triggerEvent: "on_cart_close")

Cada mensaje incluye variables que se sustituyen al enviar:
- {{name}} = nombre del lead (solo en on_lead)
- {{launchName}} = nombre del lanzamiento
- {{ctaUrl}} = URL de la landing/checkout

Devuelve JSON. Tono directo, cercano, con emojis moderados. Español neutro latinoamericano.`;

export const TELEGRAM_REFINE_SYSTEM = `Eres editor de mensajes de Telegram para lanzamientos digitales.
Recibes un mensaje existente en HTML de Telegram y una instrucción del admin.
Devuelves SOLO el JSON del mensaje mejorado, manteniendo la misma estructura.
Formato HTML de Telegram: <b>, <i>, <a href="">, <code>.
Variables disponibles: {{name}}, {{launchName}}, {{ctaUrl}}, {{email}}.
Tono directo, cercano, emojis moderados. Español neutro latinoamericano.`;

export function telegramRefinePrompt(opts: {
  currentMessage: { title: string; body: string; timing: string; triggerEvent: string };
  instruction: string;
  launchName: string;
  promise: string;
}) {
  return `Mensaje actual:
${JSON.stringify(opts.currentMessage, null, 2)}

Lanzamiento: ${opts.launchName}
Promesa: ${opts.promise}

Instrucción del admin: ${opts.instruction}

Devuelve JSON con la misma estructura:
{
  "title": "...",
  "body": "...",
  "timing": "...",
  "triggerEvent": "${opts.currentMessage.triggerEvent}"
}

IMPORTANTE: No cambies el triggerEvent. Solo mejora title, body y timing según la instrucción.`;
}

export function telegramPrompt(launchName: string, type: string, promise: string, ctaUrl: string) {
  return `Lanzamiento: ${launchName}
Tipo: ${type}
Promesa: ${promise}
CTA URL: ${ctaUrl}

Devuelve JSON:
{
  "messages": [
    {
      "title": "Título corto para el admin (no se envía)",
      "body": "<b>Texto</b> del mensaje en HTML de Telegram",
      "timing": "Cuándo enviar (ej: 'Al registrarse', 'Día 2', 'Apertura de carrito')",
      "triggerEvent": "on_lead" | "on_sale" | "on_cart_open" | "on_cart_close" | "manual"
    }
  ]
}`;
}
