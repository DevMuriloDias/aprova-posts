"use client";

import { useId, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Carrossel } from "@/components/feed/carrossel";
import { GravadorAudio } from "@/components/gravador-audio";
import { StatusPostSelo } from "@/components/status-post";
import { LIMITE_COMENTARIO } from "@/lib/aprovacao/limites";
import type {
  ClienteDaPagina,
  Decisao,
  PostParaAprovar,
  ResultadoDecisao,
} from "@/lib/aprovacao/tipos";
import { formatarDataCurta, formatarDataHora } from "@/lib/formatacao";

/** Recebe FormData com postId, acao, comentario e, se houver, audio. */
export type FuncaoDecidir = (dados: FormData) => Promise<ResultadoDecisao>;

export function montarDecisao(
  postId: string,
  acao: Decisao,
  comentario?: string,
  audio?: Blob | null,
): FormData {
  const dados = new FormData();
  dados.set("postId", postId);
  dados.set("acao", acao);
  if (comentario?.trim()) dados.set("comentario", comentario.trim());
  if (audio) dados.set("audio", audio, "audio");
  return dados;
}

type Props = {
  post: PostParaAprovar;
  cliente: ClienteDaPagina;
  decidir: FuncaoDecidir;
  aoDecidir: (resultado: Extract<ResultadoDecisao, { ok: true }>) => void;
};

const LEGENDA_CURTA = 125;

export function CartaoPost({ post, cliente, decidir, aoDecidir }: Props) {
  const [pendente, iniciar] = useTransition();
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
  const [comentario, setComentario] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [legendaAberta, setLegendaAberta] = useState(false);
  const idComentario = useId();
  const nomeExibido = cliente.instagram ?? cliente.nome;

  function enviar(acao: Decisao) {
    setErro(null);
    iniciar(async () => {
      const resultado = await decidir(
        acao === "changes_requested"
          ? montarDecisao(post.id, acao, comentario, audio)
          : montarDecisao(post.id, acao),
      );
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setPedindoAjuste(false);
      setComentario("");
      setAudio(null);
      aoDecidir(resultado);
    });
  }

  const legendaLonga = post.legenda.length > LEGENDA_CURTA;
  const legenda =
    legendaLonga && !legendaAberta ? `${post.legenda.slice(0, LEGENDA_CURTA).trimEnd()}…` : post.legenda;

  return (
    <article
      id={`post-${post.id}`}
      aria-labelledby={`post-${post.id}-titulo`}
      className="scroll-mt-32 overflow-hidden border-y border-zinc-200 bg-white sm:rounded-2xl sm:border"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar nome={cliente.nome} url={cliente.avatarUrl} tamanho="p" />
        <div className="min-w-0 flex-1">
          <p id={`post-${post.id}-titulo`} className="truncate text-sm font-semibold text-zinc-900">
            {nomeExibido}
          </p>
          <p className="text-xs text-zinc-500">
            {post.agendadoPara
              ? `Previsto: ${formatarDataCurta(post.agendadoPara)}`
              : "Sem data prevista"}
          </p>
        </div>
        <StatusPostSelo status={post.status} />
      </header>

      <Carrossel midias={post.midias} rotulo={`Mídias do post de ${nomeExibido}`} />

      <div className="flex flex-col gap-4 px-4 py-4">
        {post.legenda && (
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-zinc-800">
            <span className="font-semibold">{nomeExibido}</span> {legenda}
            {legendaLonga && (
              <button
                type="button"
                onClick={() => setLegendaAberta((v) => !v)}
                className="ml-1 font-medium text-zinc-500"
              >
                {legendaAberta ? "ver menos" : "ver mais"}
              </button>
            )}
          </p>
        )}

        <AvisoDecisao post={post} />

        {erro && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        {pedindoAjuste ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!comentario.trim() && !audio) {
                setErro("Escreva o que precisa ajustar ou grave um áudio.");
                return;
              }
              enviar("changes_requested");
            }}
          >
            <label htmlFor={idComentario} className="text-sm font-medium text-zinc-800">
              O que precisa ajustar? Escreva ou grave um áudio.
            </label>
            <textarea
              id={idComentario}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={LIMITE_COMENTARIO}
              rows={3}
              placeholder="Ex.: trocar a segunda foto e corrigir o preço na legenda."
              className="w-full rounded-xl border border-zinc-300 p-3 text-base outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
            <GravadorAudio aoMudar={setAudio} desabilitado={pendente} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPedindoAjuste(false);
                  setErro(null);
                  setAudio(null);
                }}
                className="h-11 rounded-xl border border-zinc-300 font-semibold text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pendente}
                className="h-11 rounded-xl bg-amber-500 font-semibold text-zinc-950 disabled:opacity-60"
              >
                {pendente ? "Enviando…" : "Enviar ajuste"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => enviar("approved")}
              disabled={pendente || post.status === "approved"}
              className="h-11 rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendente ? "Enviando…" : post.status === "approved" ? "Aprovado ✓" : "Aprovar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setPedindoAjuste(true);
              }}
              disabled={pendente}
              className="h-11 rounded-xl border border-amber-400 bg-white font-semibold text-amber-900 transition hover:bg-amber-50 disabled:opacity-60"
            >
              Pedir ajuste
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function OuvirAudio({ url }: { url: string | null }) {
  if (!url) return null;
  return <audio src={url} controls preload="none" className="mt-2 w-full" aria-label="Áudio do pedido de ajuste" />;
}

/** O que o cliente já respondeu, ou o aviso de que o post mudou depois disso. */
function AvisoDecisao({ post }: { post: PostParaAprovar }) {
  const decisao = post.ultimaDecisao;
  if (!decisao) return null;

  if (decisao.versao < post.versao) {
    const quando = post.reenviadoEm ? ` em ${formatarDataHora(post.reenviadoEm)}` : "";
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" role="status">
        {decisao.acao === "changes_requested" ? (
          <>
            <p className="font-semibold">Post ajustado{quando}. Confira a nova versão.</p>
            {decisao.comentario && (
              <p className="mt-1 text-sky-800">
                Você tinha pedido: <span className="italic">“{decisao.comentario}”</span>
              </p>
            )}
            {decisao.audioUrl && <p className="mt-1 text-sky-800">Seu áudio:</p>}
            <OuvirAudio url={decisao.audioUrl} />
          </>
        ) : (
          <p className="font-semibold">
            Este post foi alterado{quando}, depois da sua aprovação. Confira de novo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700" role="status">
      {decisao.acao === "approved" ? "Você aprovou" : "Você pediu ajuste"} em{" "}
      {formatarDataHora(decisao.em)}
      {decisao.comentario && (
        <span className="mt-1 block italic text-zinc-600">“{decisao.comentario}”</span>
      )}
      <OuvirAudio url={decisao.audioUrl} />
    </div>
  );
}
