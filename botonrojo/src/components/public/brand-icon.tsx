import {
  AlarmClock,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Brain,
  Briefcase,
  Calendar,
  ChartLine,
  CheckCircle2,
  XCircle,
  Clock,
  Cloud,
  Coins,
  Compass,
  CreditCard,
  Crown,
  Database,
  FileCheck2,
  FileText,
  Flame,
  Gauge,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Infinity as InfinityIcon,
  Layers,
  LifeBuoy,
  Lightbulb,
  Link2,
  Lock,
  Mail,
  MessagesSquare,
  Monitor,
  Percent,
  Play,
  Receipt,
  Repeat,
  Rocket,
  Scale,
  Search,
  Send,
  Settings2,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The icon vocabulary. Closed on purpose, like the design vocabulary: the model
 * picks a NAME from this list and anything unknown is dropped, so a page can
 * never end up with a missing glyph or an invented component.
 *
 * Lucide rather than SF Symbols: Apple's set is licensed for Apple platforms and
 * can't be redistributed in a web app. Lucide is ISC, drawn on a consistent grid,
 * and stroke-based — which is what lets a brand gradient run through it.
 */
export const BRAND_ICONS = {
  // Speed, results, momentum
  rayo: Zap,
  cohete: Rocket,
  fuego: Flame,
  tendencia: TrendingUp,
  grafica: ChartLine,
  barras: BarChart3,
  velocimetro: Gauge,
  diana: Target,
  trofeo: Trophy,
  corona: Crown,
  estrella: Star,

  // Trust, compliance, safety
  escudo: Shield,
  escudoOk: ShieldCheck,
  candado: Lock,
  verificado: BadgeCheck,
  documentoOk: FileCheck2,
  balanza: Scale,
  salvavidas: LifeBuoy,

  // Money
  cartera: Wallet,
  monedas: Coins,
  tarjeta: CreditCard,
  factura: Receipt,
  porcentaje: Percent,

  // Time
  reloj: Clock,
  alarma: AlarmClock,
  calendario: Calendar,
  repetir: Repeat,
  infinito: InfinityIcon,

  // Learning and content
  libro: BookOpen,
  birrete: GraduationCap,
  documento: FileText,
  reproducir: Play,
  bombilla: Lightbulb,
  cerebro: Brain,
  brujula: Compass,
  lupa: Search,

  // People and communication
  personas: Users,
  apretonManos: Handshake,
  manosCorazon: HeartHandshake,
  mensajes: MessagesSquare,
  correo: Mail,
  enviar: Send,
  campana: Bell,

  // Product and tooling
  capas: Layers,
  cajas: Boxes,
  ajustes: Settings2,
  enlace: Link2,
  nube: Cloud,
  baseDatos: Database,
  movil: Smartphone,
  pantalla: Monitor,
  maletin: Briefcase,
  mundo: Globe,
  regalo: Gift,
  chispas: Sparkles,
  varita: Wand2,
  check: CheckCircle2,
  cerrar: XCircle,
} satisfies Record<string, LucideIcon>;

export type BrandIconName = keyof typeof BRAND_ICONS;

export const BRAND_ICON_NAMES = Object.keys(BRAND_ICONS) as BrandIconName[];

export function isBrandIconName(value: unknown): value is BrandIconName {
  return typeof value === "string" && value in BRAND_ICONS;
}

type Props = {
  name: string;
  /** Fallback when the name isn't in the vocabulary — usually a legacy emoji. */
  fallback?: string;
  size?: "sm" | "md" | "lg";
  /** `gradient` runs a brand gradient through the strokes; `plain` uses the
   *  current colour. */
  treatment?: "gradient" | "plain";
  /** Wrap the icon in a tinted rounded plate. */
  plate?: boolean;
  className?: string;
};

/** One gradient definition for the whole page, referenced by every icon. */
const GRADIENT_ID = "brand-icon-gradient";

const SIZES = { sm: 18, md: 24, lg: 32 } as const;
const PLATE_SIZES = { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-14 w-14" } as const;

/**
 * Renders one icon from the vocabulary, optionally with a brand gradient through
 * its strokes and on a tinted plate.
 *
 * The gradient is a real SVG `<linearGradient>` referenced by `stroke`, not a CSS
 * background trick: strokes can't be filled with a CSS gradient, and the emoji
 * this replaces couldn't take brand colour at all.
 */
export function BrandIcon({
  name,
  fallback,
  size = "md",
  treatment = "gradient",
  plate = false,
  className,
}: Props) {
  const Icon = isBrandIconName(name) ? BRAND_ICONS[name] : null;

  if (!Icon) {
    // Legacy bodies stored an emoji here. Show it rather than nothing.
    if (!fallback && !name) return null;
    return <span className={className}>{fallback ?? name}</span>;
  }

  const px = SIZES[size];

  const glyph =
    treatment === "gradient" ? (
      <>
        {/* The gradient lives in its own zero-sized svg and is referenced by id.
            A nested <svg> inside <svg> also works but muddles sizing, and a CSS
            gradient can't fill a stroke at all — which is exactly why the emoji
            this replaces could never take brand colour. The id is fixed, so
            repeating these defs is harmless: same id, same definition. */}
        <svg width="0" height="0" aria-hidden className="absolute">
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="var(--color-accent)" />
              <stop offset="1" stopColor="var(--color-primary)" />
            </linearGradient>
          </defs>
        </svg>
        <Icon
          width={px}
          height={px}
          stroke={`url(#${GRADIENT_ID})`}
          strokeWidth={1.75}
          aria-hidden
          className="shrink-0"
        />
      </>
    ) : (
      <Icon width={px} height={px} strokeWidth={1.75} aria-hidden className="shrink-0" />
    );

  if (!plate) return <span className={className}>{glyph}</span>;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--color-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] ${PLATE_SIZES[size]} ${className ?? ""}`}
    >
      {glyph}
    </span>
  );
}
