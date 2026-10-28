"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FiltroCliente({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
      <span className="sr-only sm:not-sr-only">Cliente</span>
      <select
        value={params.get("cliente") ?? ""}
        onChange={(e) => {
          const novos = new URLSearchParams(params);
          if (e.target.value) novos.set("cliente", e.target.value);
          else novos.delete("cliente");
          router.push(`${caminho}?${novos.toString()}`, { scroll: false });
        }}
        className="h-10 max-w-48 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
      >
        <option value="">Todos os clientes</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
