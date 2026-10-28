"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { acaoMarcarNovidadesVistas } from "../actions";

/**
 * Ao abrir a página com novidades, marca tudo como visto (o contador do topo
 * zera) e guarda na URL o horário da visita anterior, para os itens
 * continuarem destacados como "Novo" nesta visita.
 */
export function MarcarComoVisto({ haNovidades }: { haNovidades: boolean }) {
  const router = useRouter();
  const caminho = usePathname();
  const feito = useRef(false);

  useEffect(() => {
    if (!haNovidades || feito.current) return;
    feito.current = true;
    acaoMarcarNovidadesVistas().then((anterior) => {
      if (anterior) router.replace(`${caminho}?desde=${encodeURIComponent(anterior)}`);
    });
  }, [haNovidades, caminho, router]);

  return null;
}
