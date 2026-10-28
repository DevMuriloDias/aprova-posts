"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONES = {
  clientes: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  calendario: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  novidades: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Zm4.3 13a2 2 0 0 0 3.4 0",
} as const;

function Icone({ nome }: { nome: keyof typeof ICONES }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONES[nome]} />
    </svg>
  );
}

const ITENS = [
  { href: "/painel", rotulo: "Clientes", icone: "clientes", exato: true },
  { href: "/painel/calendario", rotulo: "Calendário", icone: "calendario", exato: false },
  { href: "/painel/novidades", rotulo: "Novidades", icone: "novidades", exato: false },
] as const;

export function itemAtivo(caminho: string, href: string, exato: boolean): boolean {
  if (exato) return caminho === href || caminho.startsWith(`${href}/clientes`);
  return caminho === href || caminho.startsWith(`${href}/`);
}

function Contador({ quantidade }: { quantidade: number }) {
  if (quantidade <= 0) return null;
  return (
    <span className="grid min-w-5 place-items-center rounded-full bg-destaque px-1.5 text-[11px] font-bold text-destaque-tinta">
      {quantidade > 99 ? "99+" : quantidade}
    </span>
  );
}

/** Abas do painel: no topo (telas grandes) e fixas embaixo (celular). */
export function NavegacaoPainel({ novidades }: { novidades: number }) {
  const caminho = usePathname();

  return (
    <>
      <nav aria-label="Seções do painel" className="hidden items-center gap-1 sm:flex">
        {ITENS.map((item) => {
          const ativo = itemAtivo(caminho, item.href, item.exato);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                ativo ? "bg-marca-600 text-white" : "text-zinc-700 hover:bg-marca-50"
              }`}
            >
              {item.rotulo}
              {item.href === "/painel/novidades" && <Contador quantidade={novidades} />}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="Seções do painel"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {ITENS.map((item) => {
          const ativo = itemAtivo(caminho, item.href, item.exato);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                ativo ? "text-marca-700" : "text-zinc-500"
              }`}
            >
              <span className="relative">
                <Icone nome={item.icone} />
                {item.href === "/painel/novidades" && novidades > 0 && (
                  <span className="absolute -right-3 -top-1">
                    <Contador quantidade={novidades} />
                  </span>
                )}
              </span>
              {item.rotulo}
              <span
                aria-hidden
                className={`mt-0.5 h-1 w-6 rounded-full ${ativo ? "bg-marca-600" : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
