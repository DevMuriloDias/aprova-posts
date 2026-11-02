"use client";

/* eslint-disable @next/next/no-img-element -- prévia local (blob:) da imagem escolhida */

import { useEffect, useId, useMemo } from "react";
import { problemaNoArquivo } from "@/lib/painel/validacao";

type Props = {
  capa: File | null;
  aoMudar: (capa: File | null) => void;
  aoErro: (mensagem: string) => void;
  limiteBytes: number;
  /** Texto de ajuda abaixo do título. */
  ajuda?: string;
};

/** Campo separado para a capa do post (uma imagem, mostrada na grade do perfil). */
export function CampoCapa({ capa, aoMudar, aoErro, limiteBytes, ajuda }: Props) {
  const id = useId();
  const previa = useMemo(() => (capa ? URL.createObjectURL(capa) : null), [capa]);

  // Libera a prévia anterior quando a capa muda ou o campo sai da tela.
  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa);
    },
    [previa],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        Capa (opcional)
      </label>
      <span className="text-xs text-zinc-500">
        {ajuda ?? "Imagem que aparece na grade do perfil para o cliente. Sem capa, usamos a primeira foto ou vídeo."}
      </span>
      {previa ? (
        <div className="flex items-end gap-3">
          <img
            src={previa}
            alt="Prévia da capa"
            className="aspect-[3/4] w-20 rounded-lg border border-zinc-200 object-cover"
          />
          <button
            type="button"
            onClick={() => aoMudar(null)}
            className="text-sm font-semibold text-red-700 hover:underline"
          >
            Tirar esta capa
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const arquivo = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!arquivo) return;
            const problema = problemaNoArquivo(arquivo, { apenasImagem: true, limiteBytes });
            if (problema) return aoErro(problema);
            aoMudar(arquivo);
          }}
          className="text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-semibold"
        />
      )}
    </div>
  );
}
