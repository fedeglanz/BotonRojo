"use client";

import { useEffect, useState } from "react";

/**
 * El formulario de baja.
 *
 * Un solo paso: pulsar y estar fuera. Sin confirmación por correo, sin "¿seguro?" y
 * sin encuesta de salida — cada paso que se pone en medio es una persona más que
 * acaba marcando el correo como spam, y eso sale mucho más caro que una baja.
 *
 * El email suele venir en el enlace del correo (`?email=`), así que se rellena solo:
 * nadie quiere teclear su dirección para irse. Si no viene, se pide, porque es el
 * único dato con el que se puede dar de baja a alguien.
 */
export function UnsubscribeForm({
  launchSlug,
  ctaLabel,
  ctaClass,
  cardClass,
}: {
  launchSlug: string;
  ctaLabel: string;
  ctaClass: string;
  cardClass: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  // Del enlace, en el cliente: la página es estática para todos y el email de cada
  // persona no puede formar parte de lo que se cachea.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("email");
    if (fromLink) setEmail(fromLink);
  }, []);

  if (state === "done") {
    return (
      <div className={cardClass}>
        <p className="font-[family-name:var(--font-display)] text-lg font-bold">
          Hecho.
        </p>
        <p className="mt-2 text-[var(--color-muted-1)]">
          No volverás a recibir correos de esta lista. Si algún día cambias de
          idea, sabes dónde encontrarnos.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!email.trim()) return;
        setState("sending");
        try {
          const response = await fetch("/api/baja", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ launchSlug, email: email.trim() }),
          });
          if (!response.ok) throw new Error("baja_failed");
          setState("done");
        } catch {
          setState("error");
        }
      }}
    >
      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-[var(--color-muted-2)]">
          Tu email
        </span>
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@email.com"
          className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <button type="submit" className={ctaClass} disabled={state === "sending"}>
        {state === "sending" ? "Dándote de baja…" : ctaLabel}
      </button>

      {state === "error" && (
        <p className="text-sm text-[var(--color-warning)]">
          No se ha podido completar. Inténtalo otra vez y, si sigue fallando,
          responde a cualquiera de nuestros correos y te damos de baja a mano.
        </p>
      )}
    </form>
  );
}
