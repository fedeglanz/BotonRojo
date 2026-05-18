"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Button> & { pendingLabel?: string };

export function SubmitButton({ children, pendingLabel, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button {...rest} type="submit" disabled={pending}>
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
