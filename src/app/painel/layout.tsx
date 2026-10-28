import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { BotaoEnviar } from "@/components/ui/botao-enviar";
import { contarNovidades } from "@/lib/painel/consultas";
import { sair } from "../(auth)/actions";

export default function LayoutPainel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Suspense fallback={<LinkNovidades quantidade={0} />}>
              <ContadorNovidades />
            </Suspense>
            <form action={sair}>
              <BotaoEnviar variante="secundario" enviando="Saindo…">
                Sair
              </BotaoEnviar>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

async function ContadorNovidades() {
  return <LinkNovidades quantidade={await contarNovidades()} />;
}

function LinkNovidades({ quantidade }: { quantidade: number }) {
  return (
    <Link
      href="/painel/novidades"
      className="relative flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
      aria-label={quantidade > 0 ? `Novidades: ${quantidade} novas respostas` : "Novidades"}
    >
      Novidades
      {quantidade > 0 && (
        <span className="ml-2 grid min-w-5 place-items-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">
          {quantidade > 99 ? "99+" : quantidade}
        </span>
      )}
    </Link>
  );
}
