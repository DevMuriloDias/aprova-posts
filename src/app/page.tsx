import Link from "next/link";
import { Logo } from "@/components/logo";
import { ROTA_CADASTRO, ROTA_ENTRAR } from "@/lib/auth/rotas";

const RECURSOS = [
  {
    titulo: "Um link, sem login",
    texto: "O cliente abre no celular, vê os posts como no feed e na grade do perfil.",
  },
  {
    titulo: "Aprovação com registro",
    texto: "Cada aprovação e pedido de ajuste fica guardado com data e hora. Dá até para mandar áudio.",
  },
  {
    titulo: "Calendário organizado",
    texto: "Programe os posts de todos os clientes por dia e horário, num lugar só.",
  },
];

export default function PaginaInicial() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href={ROTA_ENTRAR} className="text-sm font-semibold text-zinc-700 hover:text-tinta">
          Entrar
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-12 pt-10 text-center sm:pt-16">
        <span className="rounded-full bg-destaque px-3 py-1 text-xs font-bold text-destaque-tinta">
          Para social medias
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-tinta sm:text-6xl">
          Aprovação de posts sem bagunça no{" "}
          <span className="relative whitespace-nowrap text-marca-600">
            WhatsApp
            <span aria-hidden className="absolute inset-x-0 -bottom-1 h-2 rounded-full bg-destaque/70" />
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-base text-zinc-600 sm:text-lg">
          Envie os posts do Instagram por um link. O cliente vê tudo como no feed, aprova ou pede
          ajuste, e você organiza o mês inteiro no calendário.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={ROTA_CADASTRO}
            className="flex h-12 items-center justify-center rounded-xl bg-marca-600 px-7 font-semibold text-white shadow-sm hover:bg-marca-700"
          >
            Criar conta
          </Link>
          <Link
            href={ROTA_ENTRAR}
            className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-7 font-semibold text-tinta hover:bg-zinc-50"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-white">
        <ul className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3">
          {RECURSOS.map((r) => (
            <li key={r.titulo} className="rounded-2xl bg-fundo p-5">
              <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-marca-600 text-sm font-black text-destaque">
                ✓
              </span>
              <h2 className="mt-3 text-base font-bold text-tinta">{r.titulo}</h2>
              <p className="mt-1 text-sm text-zinc-600">{r.texto}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
