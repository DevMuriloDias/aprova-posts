"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import { enviarMidias, removerMidias } from "@/lib/painel/upload";
import {
  MAXIMO_MIDIAS_POR_POST,
  TIPOS_MIDIA_ACEITOS,
  problemaNoArquivo,
} from "@/lib/painel/validacao";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { acaoCriarPost } from "../../actions";

type Props = {
  donoId: string;
  /** Cliente fixo (página do cliente). Sem ele, mostra a escolha de cliente. */
  clienteId?: string;
  clientes?: { id: string; nome: string }[];
  /** Valor inicial do campo de data/hora, ex.: "2026-11-05T10:00". */
  agendadoInicial?: string;
  rotulo?: string;
};

export function FormularioPost({
  donoId,
  clienteId: clienteFixo,
  clientes = [],
  agendadoInicial,
  rotulo = "+ Novo post",
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [chave, setChave] = useState(0); // reinicia o formulário depois de salvar

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="h-11 w-full rounded-xl bg-marca-600 px-4 font-semibold text-white hover:bg-marca-700 sm:w-auto"
      >
        {rotulo}
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

  function enviar(form: FormData) {
    setErro(null);
    const clienteId = clienteFixo ?? String(form.get("clienteId") ?? "");
    if (!clienteId) return setErro("Escolha o cliente.");
    if (arquivos.length === 0) return setErro("Adicione pelo menos uma foto ou vídeo.");
    const agendado = String(form.get("agendadoPara") ?? "");

    iniciar(async () => {
      const supabase = criarClienteNavegador();
      const postId = crypto.randomUUID();
      const envio = await enviarMidias(supabase, { donoId, clienteId, postId }, arquivos, (n, total) =>
        setProgresso(`Enviando ${n} de ${total}…`),
      );
      if (!envio.ok) {
        setProgresso(null);
        return setErro(envio.erro);
      }

      setProgresso("Salvando…");
      const r = await acaoCriarPost({
        id: postId,
        clienteId,
        legenda: String(form.get("legenda") ?? ""),
        // datetime-local não tem fuso: convertemos no navegador, que sabe o fuso local.
        agendadoPara: agendado ? new Date(agendado).toISOString() : undefined,
        midias: envio.midias,
      });
      setProgresso(null);
      if (!r.ok) {
        await removerMidias(supabase, envio.midias);
        return setErro(r.erro);
      }
      setArquivos([]);
      setChave((k) => k + 1);
      setAberto(false);
    });
  }

  return (
    <form
      key={chave}
      action={enviar}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"
    >
      <h2 className="text-base font-bold text-zinc-900">Novo post</h2>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {!clienteFixo && (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
          Cliente
          <select
            name="clienteId"
            required
            defaultValue={clientes.length === 1 ? clientes[0].id : ""}
            className="h-12 rounded-xl border border-zinc-300 bg-white px-3 text-base font-normal outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
          >
            <option value="" disabled>
              Escolha o cliente
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Fotos ou vídeos (na ordem do carrossel)
        <input
          type="file"
          multiple
          accept={Object.keys(TIPOS_MIDIA_ACEITOS).join(",")}
          onChange={(e) => escolher(e.target.files)}
          className="text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-semibold"
        />
      </label>
      {arquivos.length > 0 && (
        <ol className="flex gap-2 overflow-x-auto pb-1">
          {arquivos.map((a, i) => (
            <li
              key={`${a.name}-${i}`}
              className="flex size-16 shrink-0 items-end rounded-lg bg-zinc-100 p-1 text-[10px] text-zinc-600"
            >
              <span className="line-clamp-2 break-all">
                {i + 1}. {a.name}
              </span>
            </li>
          ))}
        </ol>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Legenda
        <textarea
          name="legenda"
          rows={5}
          maxLength={2200}
          className="rounded-xl border border-zinc-300 p-3 text-base font-normal outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Publicação prevista (opcional)
        <input
          type="datetime-local"
          name="agendadoPara"
          defaultValue={agendadoInicial}
          className="h-12 rounded-xl border border-zinc-300 px-4 text-base font-normal outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={pendente}
          className="h-11 rounded-xl border border-zinc-300 font-semibold text-zinc-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pendente}
          className="h-11 rounded-xl bg-marca-600 font-semibold text-white disabled:opacity-60"
        >
          {pendente ? (progresso ?? "Enviando…") : "Enviar para aprovação"}
        </button>
      </div>
    </form>
  );
}
