"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Button> & { pendingLabel?: string };

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    // El `disabled` que llega se respeta: antes lo pisaba el del envío, así que un
    // botón que tenía que estar bloqueado hasta cumplirse algo —escribir el nombre
    // para confirmar un borrado— salía pulsable.
    <Button {...rest} type="submit" disabled={pending || disabled}>
      {pending && (
        <span
          aria-hidden
          className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
        />
      )}
      {pending ? pendingLabel ?? "Procesando…" : children}
    </Button>
  );
}
