import { notFound } from "next/navigation";
import { verifyPayload } from "@/lib/crypto";
import { googleFontsUrl, hexToRgba } from "@/lib/brand-kit";
import { AD_FORMATS, isAdFormatKey, isAdTemplateKey, type AdRenderPayload } from "@/lib/ad-templates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ p?: string; sig?: string }>;

/**
 * Composes one static ad at exact pixel dimensions so `screenshot-service`
 * can photograph it. It is NOT behind auth on purpose: the screenshot service
 * is a headless Chromium with no session. Instead every parameter arrives in
 * an HMAC-signed payload, so the page can't be driven with arbitrary data.
 */
export default async function AdRenderPage(props: { searchParams: SearchParams }) {
  const { p, sig } = await props.searchParams;
  if (!p || !sig) notFound();

  const payload = verifyPayload<AdRenderPayload>(p, sig);
  if (!payload) notFound();
  if (!isAdFormatKey(payload.format) || !isAdTemplateKey(payload.template)) notFound();

  const format = AD_FORMATS[payload.format];
  const { width, height } = format;
  const aspect = width / height;

  // Extreme display-banner shapes get a purpose-built split layout: cropping a
  // portrait into a 728×90 strip loses the face entirely, and the social
  // templates leave the text unreadably small. Anything in normal proportions
  // uses the chosen art-direction template.
  const layout: "banner-h" | "banner-v" | typeof payload.template =
    aspect >= 2.2 ? "banner-h" : aspect <= 0.45 ? "banner-v" : payload.template;
  const isBanner = layout === "banner-h" || layout === "banner-v";

  const scale = Math.min(width, height) / 1080;

  // Type sizes are derived from the shortest side so the same template reads
  // correctly at 1080×1080 and at 300×250 without separate designs. Banners
  // instead scale off their own height, which is the real constraint there.
  const headlineSize = isBanner
    ? Math.max(13, Math.round(layout === "banner-h" ? height * 0.26 : width * 0.13))
    : Math.max(13, Math.round(68 * scale));
  const subSize = Math.max(10, Math.round(30 * scale));
  const ctaSize = isBanner ? Math.max(9, Math.round(headlineSize * 0.6)) : Math.max(9, Math.round(26 * scale));
  const pad = isBanner ? Math.max(8, Math.round(Math.min(width, height) * 0.1)) : Math.max(10, Math.round(64 * scale));

  const fonts = { display: payload.displayFont, body: payload.bodyFont };

  const showSub = Boolean(payload.subheadline) && !format.compact;
  const showCta = Boolean(payload.ctaLabel) && (layout === "banner-v" ? height >= 400 : !isBanner ? height >= 200 : false);

  const textBlock = (
    <>
      <div
        style={{
          fontFamily: `"${payload.displayFont}", sans-serif`,
          fontWeight: 800,
          fontSize: headlineSize,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          textWrap: "balance",
        }}
      >
        {payload.headline}
      </div>
      {showSub && (
        <div
          style={{
            fontFamily: `"${payload.bodyFont}", sans-serif`,
            fontSize: subSize,
            lineHeight: 1.3,
            marginTop: pad * 0.3,
            opacity: 0.9,
          }}
        >
          {payload.subheadline}
        </div>
      )}
      {showCta && (
        <div
          style={{
            display: "inline-block",
            marginTop: pad * 0.45,
            background: payload.primary,
            color: "#fff",
            fontFamily: `"${payload.displayFont}", sans-serif`,
            fontWeight: 800,
            fontSize: ctaSize,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: `${ctaSize * 0.55}px ${ctaSize * 1.4}px`,
            borderRadius: 999,
          }}
        >
          {payload.ctaLabel}
        </div>
      )}
    </>
  );

  const photo = (style?: React.CSSProperties) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={payload.imageUrl}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }}
    />
  );

  const logo = payload.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={payload.logoUrl}
      alt=""
      style={{
        position: "absolute",
        top: pad * 0.5,
        left: pad * 0.5,
        height: Math.max(14, Math.round(56 * scale)),
        width: "auto",
        objectFit: "contain",
        zIndex: 3,
      }}
    />
  ) : null;

  return (
    <>
      <link rel="stylesheet" href={googleFontsUrl(fonts)} />
      {/* The captured surface must be exactly width×height with nothing else
          around it — no app chrome, no scrollbars. */}
      <style>{`
        html, body { margin: 0; padding: 0; background: ${payload.background}; overflow: hidden; }
        * { box-sizing: border-box; }
      `}</style>

      <div
        style={{
          position: "relative",
          width,
          height,
          overflow: "hidden",
          background: payload.background,
          color: payload.foreground,
        }}
      >
        {layout === "scrim-bottom" && (
          <>
            <div style={{ position: "absolute", inset: 0 }}>{photo()}</div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, ${hexToRgba(payload.background, 0.96)} 0%, ${hexToRgba(
                  payload.background,
                  0.75,
                )} 38%, transparent 72%)`,
              }}
            />
            {logo}
            <div
              style={{
                position: "absolute",
                left: pad,
                right: pad,
                bottom: pad,
                zIndex: 2,
                color: payload.foreground,
              }}
            >
              {textBlock}
            </div>
          </>
        )}

        {layout === "banda-superior" && (
          <>
            <div
              style={{
                background: payload.primary,
                color: "#fff",
                padding: pad * 0.7,
                minHeight: "42%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                position: "relative",
                zIndex: 2,
              }}
            >
              {textBlock}
            </div>
            <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>{photo()}</div>
            {logo}
          </>
        )}

        {layout === "centro" && (
          <>
            <div style={{ position: "absolute", inset: 0 }}>{photo()}</div>
            <div style={{ position: "absolute", inset: 0, background: hexToRgba(payload.background, 0.72) }} />
            {logo}
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: pad,
                color: payload.foreground,
              }}
            >
              {textBlock}
            </div>
          </>
        )}

        {layout === "lateral" && (
          <div style={{ display: "flex", flexDirection: "column", width, height }}>
            <div style={{ flex: "1 1 0", minHeight: 0, minWidth: 0 }}>{photo()}</div>
            <div
              style={{
                flex: "1 1 0",
                minWidth: 0,
                background: hexToRgba(payload.accent, 0.14),
                borderTop: `${Math.max(2, 4 * scale)}px solid ${payload.accent}`,
                borderLeft: "none",
                padding: pad * 0.8,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                color: payload.foreground,
              }}
            >
              {textBlock}
            </div>
            {logo}
          </div>
        )}

        {isBanner && (
          <div
            style={{
              display: "flex",
              flexDirection: layout === "banner-h" ? "row" : "column",
              width,
              height,
            }}
          >
            {/* The photo keeps a near-square crop so a face survives; the text
                lives on a solid brand panel where it's always legible. */}
            <div
              style={{
                flex: layout === "banner-h" ? `0 0 ${Math.round(height)}px` : `0 0 ${Math.round(width)}px`,
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {photo()}
            </div>
            <div
              style={{
                flex: "1 1 0",
                minWidth: 0,
                minHeight: 0,
                background: payload.primary,
                color: "#fff",
                padding: pad,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: pad * 0.4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: `"${payload.displayFont}", sans-serif`,
                  fontWeight: 800,
                  fontSize: headlineSize,
                  lineHeight: 1.08,
                  letterSpacing: "-0.02em",
                  textWrap: "balance",
                }}
              >
                {payload.headline}
              </div>
              {showCta && payload.ctaLabel && (
                <div
                  style={{
                    display: "inline-block",
                    alignSelf: "flex-start",
                    background: "#fff",
                    color: payload.primary,
                    fontFamily: `"${payload.displayFont}", sans-serif`,
                    fontWeight: 800,
                    fontSize: ctaSize,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: `${ctaSize * 0.5}px ${ctaSize * 1.2}px`,
                    borderRadius: 999,
                  }}
                >
                  {payload.ctaLabel}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
