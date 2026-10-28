"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import type { StatusPost } from "@/lib/aprovacao/tipos";
import { enviarMidias, paraCampoDataHora, removerMidias } from "@/lib/painel/upload";
import {
  MAXIMO_MIDIAS_POR_POST,
  TIPOS_MIDIA_ACEITOS,
  problemaNoArquivo,
} from "@/lib/painel/validacao";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { acaoEditarPost } from "../../actions";

type Props = {
  donoId: string;
  clienteId: string;
  post: {
    id: string;
    legenda: string;
    agendadoPara: string | null;
    status: StatusPost;
    totalMidias: number;
  };
};

const AVISOS: Partial<Record<StatusPost, string>> = {
  changes_requested: "Depois de salvar, o post volta para o cliente aprovar de novo.",
  approved: "Este post já foi aprovado. Se salvar, o cliente vai precisar aprovar de novo.",
};

export function EditorPost({ donoId, clienteId, post }: Props) {
  const [aberto, setAberto] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const ajuste = post.status === "changes_requested";

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`h-9 self-start rounded-lg px-3 text-sm font-semibold ${
          ajuste
            ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
            : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        {ajuste ? "Ajustar e reenviar" : "Editar"}
      </button>
    );
  }

  function escolher(lista: FileList | null) {
    setErro(null);
    const novos = Array.from(lista ?? []);
    for (const arquivo of novos) {
      const problema = problemaNoArquivo(arquivo);
      if (problema) return setErro(problema);
    }
    if (novos.length > MAXIMO_MIDIAS_POR_POST) {
      return setErro(`Um post pode ter no máximo ${MAXIMO_MIDIAS_POR_POST} mídias.`);
    }
    setArquivos(novos);
  }

  function salvar(form: FormData) {
    setErro(null);
    const agendado = String(form.get("agendadoPara") ?? "");

    iniciar(async () => {
      const supabase = criarClienteNavegador();
      let midias: { caminho: string; tipo: "image" | "video" }[] | undefined;

      if (arquivos.length > 0) {
        const envio = await enviarMidias(
          supabase,
          { donoId, clienteId, postId: post.id },
          arquivos,
          (n, total) => setProgresso(`Enviando ${n} de ${total}…`),
        );
        if (!envio.ok) {
          setProgresso(null);
          return setErro(envio.erro);
        }
        midias = envio.midias;
      }

      setProgresso("Salvando…");
      const r = await acaoEditarPost({
        id: post.id,
        clienteId,
        legenda: String(form.get("legenda") ?? ""),
        agendadoPara: agendado ? new Date(agendado).toISOString() : undefined,
        midias,
      });
      setProgresso(null);
      if (!r.ok) {
        if (midias) await removerMidias(supabase, midias);
        return setErro(r.erro);
      }
      setArquivos([]);
      setAberto(false);
    });
  }

  return (
    <form action={salvar} className="order-last mt-2 flex w-full flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      {AVISOS[post.status] && <p className="text-xs text-zinc-600">{AVISOS[post.status]}</p>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Legenda
        <textarea
          name="legenda"
          rows={5}
          maxLength={2200}
          defaultValue={post.legenda}
          className="rounded-xl border border-zinc-300 bg-white p-3 text-base font-normal outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Publicação prevista (opcional)
        <input
          type="datetime-local"
          name="agendadoPara"
          defaultValue={paraCampoDataHora(post.agendadoPara)}
          className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base font-normal outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Trocar fotos ou vídeos (opcional)
        <span className="text-xs font-normal text-zinc-500">
          {arquivos.length > 0
            ? `${arquivos.length} ${arquivos.length === 1 ? "arquivo novo substitui" : "arquivos novos substituem"} as ${post.totalMidias} mídias atuais.`
            : `Sem escolher nada, ficam as ${post.totalMidias} mídias atuais.`}
        </span>
        <input
          type="file"
          multiple
          accept={Object.keys(TIPOS_MIDIA_ACEITOS).join(",")}
          onChange={(e) => escolher(e.target.files)}
          className="text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setArquivos([]);
            setErro(null);
          }}
          disabled={pendente}
          className="h-11 rounded-xl border border-zinc-300 bg-white font-semibold text-zinc-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pendente}
          className="h-11 rounded-xl bg-marca-600 font-semibold text-white disabled:opacity-60"
        >
          {pendente ? (progresso ?? "Salvando…") : "Salvar e reenviar"}
        </button>
      </div>
    </form>
  );
}
