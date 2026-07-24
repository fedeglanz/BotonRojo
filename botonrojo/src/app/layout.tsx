import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Botón Rojo · Lanzamientos",
  description: "El sistema de lanzamientos digitales de Escuela Nómada Digital.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="grain antialiased">
        <div className="mesh-bg" aria-hidden />
        <div className="circuit-grid" aria-hidden />
        <div className="vignette" aria-hidden />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
