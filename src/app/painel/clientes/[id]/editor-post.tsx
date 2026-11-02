"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import type { StatusPost } from "@/lib/aprovacao/tipos";
import { textoDoLimite } from "@/lib/armazenamento/limites";
import { descartarMidias, enviarMidias, paraCampoDataHora, textoDoProgresso } from "@/lib/painel/upload";
import {
  MAXIMO_MIDIAS_POR_POST,
  TIPOS_MIDIA_ACEITOS,
  problemaNoArquivo,
} from "@/lib/painel/validacao";
import { acaoEditarPost } from "../../actions";
import { dependenciasEnvio } from "../../dependencias-envio";
import { CampoCapa } from "./campo-capa";

type Props = {
  clienteId: string;
  post: {
    id: string;
    legenda: string;
    agendadoPara: string | null;
    status: StatusPost;
    totalMidias: number;
    temCapa: boolean;
  };
  limiteBytes: number;
};

const AVISOS: Partial<Record<StatusPost, string>> = {
  changes_requested: "Depois de salvar, o post volta para o cliente aprovar de novo.",
  approved: "Este post já foi aprovado. Se salvar, o cliente vai precisar aprovar de novo.",
};

export function EditorPost({ clienteId, post, limiteBytes }: Props) {
  const [aberto, setAberto] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [capa, setCapa] = useState<File | null>(null);
  const [removerCapa, setRemoverCapa] = useState(false);
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
      const problema = problemaNoArquivo(arquivo, { limiteBytes });
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
      let midias: { caminho: string; tipo: "image" | "video" }[] | undefined;

      if (arquivos.length > 0) {
        const envio = await enviarMidias(
          { destino: "post", clienteId, postId: post.id },
          arquivos,
          dependenciasEnvio,
          (n, total, fracao) => setProgresso(textoDoProgresso(n, total, fracao)),
        );
        if (!envio.ok) {
          setProgresso(null);
          return setErro(envio.erro);
        }
        midias = envio.midias;
      }
      const enviados = [...(midias ?? [])];

      let capaCaminho: string | undefined;
      if (capa) {
        setProgresso("Enviando a capa…");
        const envioCapa = await enviarMidias(
          { destino: "capa", clienteId, postId: post.id },
          [capa],
          dependenciasEnvio,
        );
        if (!envioCapa.ok) {
          await descartarMidias(dependenciasEnvio, enviados);
          setProgresso(null);
          return setErro(envioCapa.erro);
        }
        capaCaminho = envioCapa.midias[0].caminho;
        enviados.push(envioCapa.midias[0]);
      }

      setProgresso("Salvando…");
      const r = await acaoEditarPost({
        id: post.id,
        clienteId,
        legenda: String(form.get("legenda") ?? ""),
        agendadoPara: agendado ? new Date(agendado).toISOString() : undefined,
        midias,
        capaCaminho,
        removerCapa,
      });
      setProgresso(null);
      if (!r.ok) {
        await descartarMidias(dependenciasEnvio, enviados);
        return setErro(r.erro);
      }
      setArquivos([]);
      setCapa(null);
      setRemoverCapa(false);
      setAberto(false);
    });
  }

  return (
    <form action={salvar} className="order-last mt-2 flex w-full flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      {AVISOS[post.status] && <p className="text-xs text-zinc-600">{AVISOS[post.status]}</p>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="flex flex-col gap-2">
        <CampoCapa
          capa={capa}
          aoMudar={(nova) => {
            setCapa(nova);
            if (nova) setRemoverCapa(false);
          }}
          aoErro={setErro}
          limiteBytes={limiteBytes}
          ajuda={
            post.temCapa
              ? "Este post já tem capa. Escolha uma imagem para trocar."
              : "Imagem que aparece na grade do perfil para o cliente. Sem capa, usamos a primeira foto ou vídeo."
          }
        />
        {post.temCapa && !capa && (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={removerCapa}
              onChange={(e) => setRemoverCapa(e.target.checked)}
              className="size-4 accent-marca-600"
            />
            Tirar a capa atual (volta a usar a primeira foto ou vídeo)
          </label>
        )}
      </div>

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
            : `Sem escolher nada, ficam as ${post.totalMidias} mídias atuais.`}{" "}
          Até {textoDoLimite(limiteBytes)} por arquivo.
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
            setCapa(null);
            setRemoverCapa(false);
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
