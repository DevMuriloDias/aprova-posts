import Link from "next/link";
import { Logo } from "@/components/logo";
import { ROTA_CADASTRO, ROTA_ENTRAR } from "@/lib/auth/rotas";

export default function PaginaInicial() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <Link href={ROTA_ENTRAR} className="text-sm font-semibold text-zinc-700 hover:text-zinc-900">
          Entrar
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12 text-center">
        <h1 className="text-3xl font-bold leading-tight text-zinc-900 sm:text-5xl">
          Aprovação de posts sem bagunça no WhatsApp
        </h1>
        <p className="mt-4 text-base text-zinc-600 sm:text-lg">
          Envie os posts do Instagram para o cliente por um link. Ele vê tudo como no feed,
          aprova ou pede ajuste, e fica tudo registrado com data e hora.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={ROTA_CADASTRO}
            className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-orange-500 px-6 font-semibold text-white"
          >
            Criar conta grátis
          </Link>
          <Link
            href={ROTA_ENTRAR}
            className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 font-semibold text-zinc-800"
          >
            Já tenho conta
          </Link>
        </div>
      </section>
    </main>
  );
}
