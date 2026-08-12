import type { LaunchType } from "./launch-types";

export type PhaseTemplate = {
  phase: string;
  label: string;
  /** Days BEFORE the anchor date (negative = after anchor) */
  offsetStart: number;
  /** Days BEFORE the anchor date (negative = after anchor) */
  offsetEnd: number;
  sortOrder: number;
};

/**
 * Venta Directa: anchor = fecha del evento en vivo
 */
const VENTA_DIRECTA: PhaseTemplate[] = [
  { phase: "pre_captacion",   label: "Pre-captacion",         offsetStart: 21, offsetEnd: 14, sortOrder: 1 },
  { phase: "captacion",       label: "Captacion (registro)",  offsetStart: 14, offsetEnd: 5,  sortOrder: 2 },
  { phase: "calentamiento",   label: "Calentamiento",         offsetStart: 5,  offsetEnd: 1,  sortOrder: 3 },
  { phase: "evento_vivo",     label: "Evento en vivo",        offsetStart: 0,  offsetEnd: 0,  sortOrder: 4 },
  { phase: "replay",          label: "Replay + seguimiento",  offsetStart: -1, offsetEnd: -3, sortOrder: 5 },
  { phase: "apertura_carrito", label: "Apertura de carrito",  offsetStart: 0,  offsetEnd: -3, sortOrder: 6 },
  { phase: "cierre_carrito",  label: "Cierre de carrito",     offsetStart: -3, offsetEnd: -4, sortOrder: 7 },
];

/**
 * Semilla: anchor = apertura de carrito
 */
const SEMILLA: PhaseTemplate[] = [
  { phase: "pre_captacion",    label: "Pre-captacion",        offsetStart: 14, offsetEnd: 7,  sortOrder: 1 },
  { phase: "captacion",        label: "Captacion",            offsetStart: 7,  offsetEnd: 0,  sortOrder: 2 },
  { phase: "apertura_carrito", label: "Apertura de carrito",  offsetStart: 0,  offsetEnd: 0,  sortOrder: 3 },
  { phase: "venta",            label: "Periodo de venta",     offsetStart: 0,  offsetEnd: -5, sortOrder: 4 },
  { phase: "cierre_carrito",   label: "Cierre de carrito",    offsetStart: -5, offsetEnd: -5, sortOrder: 5 },
];

/**
 * PLF: anchor = apertura de carrito (PLC4)
 */
const PLF: PhaseTemplate[] = [
  { phase: "pre_pre_lanzamiento", label: "Pre-pre-lanzamiento", offsetStart: 28, offsetEnd: 21, sortOrder: 1 },
  { phase: "captacion",           label: "Captacion (registro)", offsetStart: 21, offsetEnd: 12, sortOrder: 2 },
  { phase: "plc_1",               label: "PLC 1 — La oportunidad", offsetStart: 12, offsetEnd: 12, sortOrder: 3 },
  { phase: "plc_2",               label: "PLC 2 — La transformacion", offsetStart: 9, offsetEnd: 9, sortOrder: 4 },
  { phase: "plc_3",               label: "PLC 3 — La experiencia", offsetStart: 6, offsetEnd: 6, sortOrder: 5 },
  { phase: "plc_4",               label: "PLC 4 — La oferta",    offsetStart: 0,  offsetEnd: 0,  sortOrder: 6 },
  { phase: "apertura_carrito",    label: "Apertura de carrito",  offsetStart: 0,  offsetEnd: 0,  sortOrder: 7 },
  { phase: "venta",               label: "Carrito abierto",      offsetStart: 0,  offsetEnd: -5, sortOrder: 8 },
  { phase: "urgencia",            label: "Ultimas horas",        offsetStart: -5, offsetEnd: -6, sortOrder: 9 },
  { phase: "cierre_carrito",      label: "Cierre de carrito",    offsetStart: -6, offsetEnd: -7, sortOrder: 10 },
];

const TEMPLATES: Partial<Record<LaunchType, PhaseTemplate[]>> = {
  venta_directa: VENTA_DIRECTA,
  semilla: SEMILLA,
  plf: PLF,
};

/**
 * Las fases de un tipo de lanzamiento, o ninguna.
 *
 * Newsletter no tiene: funciona en evergreen, no hay fecha ancla ni cierre, así que
 * un calendario ahí serían fases inventadas alrededor de un día que no existe.
 */
export function getTemplate(type: LaunchType): PhaseTemplate[] {
  return TEMPLATES[type] ?? [];
}

/** Si este tipo de lanzamiento tiene calendario. */
export function hasCalendar(type: LaunchType): boolean {
  return (TEMPLATES[type]?.length ?? 0) > 0;
}

/** Given an anchor date and a launch type, produce concrete milestone rows. */
export function generateMilestones(
  anchorDate: Date,
  type: LaunchType,
): Array<{ phase: string; label: string; startsAt: Date; endsAt: Date; sortOrder: number }> {
  const template = TEMPLATES[type] ?? [];
  return template.map((t) => ({
    phase: t.phase,
    label: t.label,
    startsAt: addDays(anchorDate, -t.offsetStart),
    endsAt: addDays(anchorDate, -t.offsetEnd),
    sortOrder: t.sortOrder,
  }));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Country/region helpers
export const REGIONS: Record<string, { label: string; countries: string[] }> = {
  LATAM: {
    label: "America Latina",
    countries: ["AR", "MX", "CO", "CL", "PE", "EC", "UY", "PY", "BO", "VE", "CR", "PA", "DO", "GT", "HN", "SV", "NI", "CU"],
  },
  NORTH_AMERICA: {
    label: "America del Norte",
    countries: ["US", "CA", "MX"],
  },
  EUROPE: {
    label: "Europa",
    countries: ["ES", "FR", "DE", "IT", "PT", "GB", "NL", "BE", "AT", "CH", "PL", "SE", "NO", "DK", "FI", "IE"],
  },
  AFRICA: {
    label: "Africa",
    countries: ["ZA", "NG", "KE", "EG", "MA", "GH", "TZ", "ET"],
  },
};

export const COUNTRIES: Record<string, string> = {
  AR: "Argentina", MX: "Mexico", CO: "Colombia", CL: "Chile", PE: "Peru",
  EC: "Ecuador", UY: "Uruguay", PY: "Paraguay", BO: "Bolivia", VE: "Venezuela",
  CR: "Costa Rica", PA: "Panama", DO: "Rep. Dominicana", GT: "Guatemala",
  HN: "Honduras", SV: "El Salvador", NI: "Nicaragua", CU: "Cuba",
  US: "Estados Unidos", CA: "Canada", BR: "Brasil",
  ES: "Espana", FR: "Francia", DE: "Alemania", IT: "Italia", PT: "Portugal",
  GB: "Reino Unido", NL: "Paises Bajos", BE: "Belgica", AT: "Austria",
  CH: "Suiza", PL: "Polonia", SE: "Suecia", NO: "Noruega", DK: "Dinamarca",
  FI: "Finlandia", IE: "Irlanda",
  ZA: "Sudafrica", NG: "Nigeria", KE: "Kenia", EG: "Egipto", MA: "Marruecos",
  GH: "Ghana", TZ: "Tanzania", ET: "Etiopia",
};
