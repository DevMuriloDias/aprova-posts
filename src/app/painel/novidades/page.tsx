import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth/usuario";
import { formatarDataHora } from "@/lib/formatacao";
import { listarNovidades } from "@/lib/painel/consultas";
import { dataValida, type Novidade } from "@/lib/painel/novidades";
import { MarcarComoVisto } from "./marcar-como-visto";

export const metadata: Metadata = { title: "Novidades" };

export default function PaginaNovidades({ searchParams }: PageProps<"/painel/novidades">) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/painel" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ‹ Clientes
        </Link>
        <h1 className="mt-2 text-xl font-bold text-zinc-900 sm:text-2xl">Novidades</h1>
        <p className="mt-1 text-sm text-zinc-600">As últimas respostas dos seus clientes.</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Lista({
  searchParams,
}: {
  searchParams: PageProps<"/painel/novidades">["searchParams"];
}) {
  await exigirUsuario();
  const { desde } = await searchParams;
  const { itens } = await listarNovidades(dataValida(typeof desde === "string" ? desde : null));
  const haNovidades = itens.some((i) => i.nova);

  if (itens.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
        Ainda não há respostas. Quando um cliente aprovar ou pedir ajuste, aparece aqui.
      </p>
    );
  }

  return (
    <>
      <MarcarComoVisto haNovidades={haNovidades && typeof desde !== "string"} />
      <ul className="flex flex-col gap-2">
        {itens.map((item) => (
          <ItemNovidade key={item.id} item={item} />
        ))}
      </ul>
    </>
  );
}

function ItemNovidade({ item }: { item: Novidade }) {
  const ajuste = item.acao === "changes_requested";
  const conteudo = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            ajuste ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {ajuste ? "Ajuste pedido" : "Aprovado"}
        </span>
        {item.nova && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
            Novo
          </span>
        )}
        <span className="text-xs text-zinc-500">{formatarDataHora(item.em)}</span>
      </div>
      <p className="mt-1.5 text-sm text-zinc-900">
        <span className="font-semibold">{item.clienteNome}</span>
        {item.legenda ? ` · ${item.legenda}` : ""}
      </p>
      {item.comentario && <p className="mt-1 text-sm italic text-zinc-700">“{item.comentario}”</p>}
    </>
  );

  return (
    <li
      className={`rounded-2xl border bg-white p-4 ${item.nova ? "border-indigo-300" : "border-zinc-200"}`}
    >
      {item.clienteId ? (
        <Link href={`/painel/clientes/${item.clienteId}`} className="block [&_p]:line-clamp-2">
          {conteudo}
        </Link>
      ) : (
        conteudo
      )}
      {item.audioUrl && (
        <audio
          src={item.audioUrl}
          controls
          preload="none"
          className="mt-2 w-full max-w-sm"
          aria-label={`Áudio de ${item.clienteNome}`}
        />
      )}
    </li>
  );
}
