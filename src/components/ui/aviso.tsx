import type { ReactNode } from "react";

export function Aviso({ tipo, children }: { tipo: "erro" | "sucesso"; children: ReactNode }) {
  const estilo =
    tipo === "erro"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${estilo}`}>
      {children}
    </div>
  );
}
