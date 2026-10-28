/* eslint-disable @next/next/no-img-element -- URLs assinadas e temporárias do Storage */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { StatusPostSelo } from "@/components/status-post";
import { textoProgresso } from "@/lib/aprovacao/progresso";
import { exigirUsuario } from "@/lib/auth/usuario";
import { formatarDataCurta, formatarDataHora } from "@/lib/formatacao";
import { detalharCliente, type EventoNoPainel, type PostNoPainel } from "@/lib/painel/consultas";
import { EditorPost } from "./editor-post";
import { ExcluirCliente, ExcluirPost } from "./excluir";
import { FormularioPost } from "./formulario-post";
import { SecaoLink } from "./secao-link";

export const metadata: Metadata = { title: "Cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PaginaCliente({ params }: PageProps<"/painel/clientes/[id]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-2xl bg-zinc-100" />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: PageProps<"/painel/clientes/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const usuario = await exigirUsuario();
  const cliente = await detalharCliente(id);
  if (!cliente) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/painel" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
        ‹ Clientes
      </Link>

      <header className="flex items-center gap-4">
        <Avatar nome={cliente.nome} url={cliente.avatarUrl} tamanho="g" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-zinc-900">{cliente.nome}</h1>
          {cliente.instagram && <p className="text-sm text-zinc-600">@{cliente.instagram}</p>}
          {cliente.resumo.total > 0 && (
            <p className="mt-1 text-sm text-zinc-600">
              {textoProgresso(cliente.resumo)}
              {cliente.resumo.ajustes > 0 && ` · ${cliente.resumo.ajustes} com ajuste`}
            </p>
          )}
        </div>
      </header>

      <SecaoLink clienteId={cliente.id} nomeCliente={cliente.nome} link={cliente.link} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-zinc-900">Posts</h2>
          <FormularioPost donoId={usuario.id} clienteId={cliente.id} />
        </div>
        {cliente.posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
            Nenhum post ainda. Crie o primeiro e envie o link para o cliente aprovar.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cliente.posts.map((post) => (
              <ItemPost key={post.id} post={post} donoId={usuario.id} clienteId={cliente.id} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 flex flex-col gap-2 rounded-2xl border border-red-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Excluir cliente</h2>
          <p className="text-xs text-zinc-600">Apaga o cliente, os posts, as mídias e o histórico.</p>
        </div>
        <ExcluirCliente clienteId={cliente.id} nome={cliente.nome} totalPosts={cliente.posts.length} />
      </section>
    </div>
  );
}

type PropsItem = { post: PostNoPainel; donoId: string; clienteId: string };

function ItemPost({ post, donoId, clienteId }: PropsItem) {
  const ultimo = post.historico[0];
  // A última resposta foi sobre uma versão anterior: o post já foi ajustado e reenviado.
  const reenviado = ultimo && ultimo.versao < post.versao;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="flex gap-3">
        <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
          {post.capaUrl && post.capaTipo === "image" && (
            <img src={post.capaUrl} alt="" className="h-full w-full object-cover" />
          )}
          {post.capaUrl && post.capaTipo === "video" && (
            <video src={post.capaUrl} muted preload="metadata" className="h-full w-full object-cover" />
          )}
          {post.totalMidias > 1 && (
            <span className="absolute right-1 top-1 rounded bg-zinc-900/70 px-1 text-[10px] text-white">
              {post.totalMidias}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPostSelo status={post.status} />
            {post.agendadoPara && (
              <span className="text-xs text-zinc-500">{formatarDataCurta(post.agendadoPara)}</span>
            )}
            {post.versao > 1 && <span className="text-xs text-zinc-500">Versão {post.versao}</span>}
          </div>
          <p className="line-clamp-2 text-sm text-zinc-800">{post.legenda || "Sem legenda"}</p>
          {reenviado && post.reenviadoEm && (
            <p className="text-xs font-medium text-sky-800">
              Reenviado em {formatarDataHora(post.reenviadoEm)}. Aguardando o cliente.
            </p>
          )}
          {ultimo && <Resposta evento={ultimo} anterior={reenviado} />}
        </div>
      </div>

      {post.historico.length > 1 && (
        <details className="text-xs text-zinc-600">
          <summary className="cursor-pointer font-medium">
            Histórico ({post.historico.length} respostas)
          </summary>
          <ol className="mt-2 flex flex-col gap-2">
            {post.historico.map((e, i) => (
              <li key={i}>
                {formatarDataHora(e.em)} · versão {e.versao}:{" "}
                {e.acao === "approved" ? "aprovado" : "ajuste pedido"}
                {e.comentario && ` (“${e.comentario}”)`}
                {e.audioUrl && (
                  <audio src={e.audioUrl} controls preload="none" className="mt-1 w-full" />
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <EditorPost
          donoId={donoId}
          clienteId={clienteId}
          post={{
            id: post.id,
            legenda: post.legenda,
            agendadoPara: post.agendadoPara,
            status: post.status,
            totalMidias: post.totalMidias,
          }}
        />
        <ExcluirPost postId={post.id} clienteId={clienteId} />
      </div>
    </li>
  );
}

function Resposta({ evento, anterior }: { evento: EventoNoPainel; anterior: boolean }) {
  return (
    <div className="text-xs text-zinc-600">
      <p>
        {anterior ? "Pedido anterior: " : ""}
        {evento.acao === "approved" ? "Aprovado" : "Ajuste pedido"} em {formatarDataHora(evento.em)}
      </p>
      {evento.comentario && <p className="mt-0.5 italic">“{evento.comentario}”</p>}
      {evento.audioUrl && (
        <audio
          src={evento.audioUrl}
          controls
          preload="none"
          className="mt-1 w-full max-w-xs"
          aria-label="Áudio do cliente"
        />
      )}
    </div>
  );
}
