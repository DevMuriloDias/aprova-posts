"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  children: ReactNode;
  enviando: string;
  variante?: "primario" | "secundario";
};

export function BotaoEnviar({ children, enviando, variante = "primario" }: Props) {
  const { pending } = useFormStatus();
  const estilo =
    variante === "primario"
      ? "h-12 w-full bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white shadow-sm hover:opacity-95"
      : "h-10 border border-zinc-300 bg-white px-4 text-zinc-700 hover:bg-zinc-50";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`rounded-xl text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${estilo}`}
    >
      {pending ? enviando : children}
    </button>
  );
}
