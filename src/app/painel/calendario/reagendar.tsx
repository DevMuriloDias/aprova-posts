"use client";

import { useState, useTransition } from "react";
import { paraCampoDataHora } from "@/lib/painel/upload";
import { acaoReagendarPost } from "../actions";

type Props = { postId: string; agendadoPara: string | null };

/** Muda a data/hora do post (não pede nova aprovação ao cliente). */
export function Reagendar({ postId, agendadoPara }: Props) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setValor(paraCampoDataHora(agendadoPara));
          setErro(null);
          setAberto(true);
        }}
        className="text-sm font-semibold text-marca-700 hover:underline"
      >
        {agendadoPara ? "Mudar data" : "Definir data"}
      </button>
    );
  }

  function salvar(novo: string | null) {
    setErro(null);
    iniciar(async () => {
      // datetime-local não tem fuso: convertemos no navegador, que sabe o fuso local.
      const r = await acaoReagendarPost(postId, novo ? new Date(novo).toISOString() : null);
      if (!r.ok) return setErro(r.erro);
      setAberto(false);
    });
  }

  return (
    <form
      className="mt-2 flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valor) return setErro("Escolha a data e o horário.");
        salvar(valor);
      }}
    >
      <label className="text-xs font-medium text-zinc-700">
        Nova data e horário
        <input
          type="datetime-local"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
        />
      </label>
      {erro && (
        <p role="alert" className="text-xs text-red-700">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendente}
          className="h-9 rounded-lg bg-marca-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={pendente}
          className="h-9 rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-700"
        >
          Cancelar
        </button>
        {agendadoPara && (
          <button
            type="button"
            onClick={() => salvar(null)}
            disabled={pendente}
            className="h-9 px-1 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
          >
            Tirar a data
          </button>
        )}
      </div>
    </form>
  );
}
