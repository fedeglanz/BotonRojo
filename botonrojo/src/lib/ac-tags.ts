import type { LaunchType } from "@/lib/launch-types";

/**
 * Qué etiqueta a qué en ActiveCampaign, según el tipo de lanzamiento.
 *
 * Eran cuatro fijas para todo —registro, comprador, evento, carrito abandonado—, y
 * en una newsletter tres de ellas no existen: no hay compra, no hay evento y no hay
 * carrito que abandonar. Lo que sí hay, y no estaba, es la baja: alguien que se va
 * de la lista es el dato que más importa cuidar en una newsletter, y hasta ahora
 * solo se le quitaba de la lista sin dejar marca.
 *
 * La lista vive aquí, en un sitio, porque la leen cuatro: el desplegable del panel,
 * el guardado, el aprovisionamiento automático y quien aplica la etiqueta cuando
 * alguien se registra o se da de baja. Repartida, cada uno tendría su propia idea de
 * qué etiquetas existen.
 */
export type AcTagSpec = {
  key: string;
  /** Cómo se llama en el panel. */
  label: string;
  /** Cuándo se aplica, en una frase. */
  when: string;
  /** El sufijo del nombre que se crea en AC: `slug` + esto. */
  suffix: string;
  description: string;
};

const VENTA: AcTagSpec[] = [
  {
    key: "registro",
    label: "Registro",
    when: "quien deja su email",
    suffix: "-registro",
    description: "Registro / lead",
  },
  {
    key: "comprador",
    label: "Comprador",
    when: "quien compra",
    suffix: "-comprador",
    description: "Compradores",
  },
  {
    key: "evento",
    label: "Evento",
    when: "quien asiste al directo",
    suffix: "-evento",
    description: "Asistente a evento",
  },
  {
    key: "abandono",
    label: "Carrito abandonado",
    when: "quien no terminó la compra",
    suffix: "-carrito-abandono",
    description: "Carrito abandonado",
  },
];

const NEWSLETTER: AcTagSpec[] = [
  {
    key: "suscrito",
    label: "Suscrito",
    when: "quien se apunta a la lista",
    suffix: "-suscrito",
    description: "Suscrito a la newsletter",
  },
  {
    key: "desuscrito",
    label: "Desuscrito",
    when: "quien se da de baja",
    suffix: "-desuscrito",
    description: "Baja de la newsletter",
  },
];

export function acTagsFor(type: LaunchType | string): AcTagSpec[] {
  return type === "newsletter" ? NEWSLETTER : VENTA;
}

/**
 * Con qué clave se etiqueta un registro nuevo en este tipo de lanzamiento.
 *
 * En una newsletter, "suscrito"; en el resto, "registro". Es la misma acción de la
 * persona con dos nombres, y quien aplica la etiqueta no tiene por qué saber en qué
 * tipo de lanzamiento está.
 */
export function altaTagKey(type: LaunchType | string): string {
  return type === "newsletter" ? "suscrito" : "registro";
}

/** Y con cuál se marca la baja. En venta no hay etiqueta de baja. */
export function bajaTagKey(type: LaunchType | string): string | null {
  return type === "newsletter" ? "desuscrito" : null;
}
