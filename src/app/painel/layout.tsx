import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { BotaoEnviar } from "@/components/ui/botao-enviar";
import { sair } from "../(auth)/actions";

export default function LayoutPainel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <form action={sair}>
            <BotaoEnviar variante="secundario" enviando="Saindo…">
              Sair
            </BotaoEnviar>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
