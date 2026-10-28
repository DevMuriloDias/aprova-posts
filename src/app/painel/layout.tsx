import type { ReactNode } from "react";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { NavegacaoPainel } from "@/components/painel/navegacao";
import { BotaoEnviar } from "@/components/ui/botao-enviar";
import { contarNovidades } from "@/lib/painel/consultas";
import { sair } from "../(auth)/actions";

export default function LayoutPainel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Logo href="/painel" />
          {/* A navegação lê o endereço (usePathname), então até a versão
              provisória, sem o contador, precisa ficar dentro de um Suspense. */}
          <Suspense
            fallback={
              <Suspense fallback={null}>
                <NavegacaoPainel novidades={0} />
              </Suspense>
            }
          >
            <NavegacaoComContador />
          </Suspense>
          <form action={sair}>
            <BotaoEnviar variante="secundario" enviando="Saindo…">
              Sair
            </BotaoEnviar>
          </form>
        </div>
      </header>
      {/* pb-24: espaço para as abas fixas do celular */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:pb-10">{children}</main>
    </div>
  );
}

async function NavegacaoComContador() {
  return <NavegacaoPainel novidades={await contarNovidades()} />;
}
