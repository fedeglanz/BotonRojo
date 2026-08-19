import type { PageTokens } from "./custom-page";

/**
 * Campañas diseñadas fuera, en Claude Design.
 *
 * Se parecen a las páginas propias pero se diferencian en lo que importa: **un email
 * es una foto fija**. Lo envía ActiveCampaign desde su copia, así que ahí no corre
 * nuestro runtime y no hay forma de rellenar nada al abrirlo. De eso salen dos
 * decisiones:
 *
 * 1. Los `{{tokens}}` se sustituyen **al publicar**, no al servir. Lo que se guarda
 *    ya es el HTML definitivo, con el precio y las urls de ese momento.
 * 2. Los atributos `data-br` no sirven de nada en un email y el contrato los prohíbe:
 *    un botón de compra en un correo es un enlace a la página de venta, no una
 *    llamada a nuestra API.
 *
 * Cada campaña es su propio asset, no un elemento de una secuencia. Así se pueden
 * tener todas las que hagan falta, y rediseñar una no toca a las demás.
 */
export type CustomEmailBody = {
  format: "html";
  /** El HTML definitivo, con los tokens ya sustituidos. */
  html: string;
  subject: string;
  preheader?: string;
  /** Cómo se llama internamente: "Bienvenida 1", "Carta del martes 3"… */
  name: string;
  publishedAt?: string;
  source?: string;
  /** Id de la plantilla en ActiveCampaign, cuando ya se ha subido. */
  acTemplateId?: string;
  /** Fase del lanzamiento (mismo enum que milestones). */
  phase?: string;
  /** Días de offset respecto al inicio de la fase. */
  sendOffsetDays?: number;
  /** Descripción corta de cuándo enviar. */
  timing?: string;
  /** Aprobado para enviar a AC. */
  approved?: boolean;
  /**
   * Tipo de envío:
   * - "campaign" = broadcast a toda la lista en fecha fija (por defecto)
   * - "automation" = drip por persona, se dispara al entrar en la automatización
   */
  sendType?: "campaign" | "automation";
};

export function isCustomEmailBody(body: unknown): body is CustomEmailBody {
  return (
    Boolean(body) &&
    typeof body === "object" &&
    (body as { format?: unknown }).format === "html" &&
    typeof (body as { html?: unknown }).html === "string" &&
    typeof (body as { subject?: unknown }).subject === "string"
  );
}

/** Los valores que puede usar una campaña, además de los de una página. */
export type EmailTokens = PageTokens & {
  /** La página de baja del lanzamiento. Obligatoria en cualquier envío. */
  url_baja: string;
};
