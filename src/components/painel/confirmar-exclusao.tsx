"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

type Props = {
  /** Texto do botão que abre a confirmação. */
  rotulo: string;
  titulo: string;
  descricao: string;
  /** Se definido, a pessoa precisa digitar este texto para confirmar. */
  confirmarDigitando?: string;
  acao: () => Promise<{ ok: true } | { ok: false; erro: string }>;
  aoExcluir?: () => void;
  variante?: "link" | "botao";
};

export function ConfirmarExclusao({
  rotulo,
  titulo,
  descricao,
  confirmarDigitando,
  acao,
  aoExcluir,
  variante = "botao",
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const idTitulo = useId();
  const idCampo = useId();
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    cancelar.current?.focus();
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && !pendente && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto, pendente]);

  const liberado =
    !confirmarDigitando || digitado.trim().toLowerCase() === confirmarDigitando.trim().toLowerCase();

  function excluir() {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) return setErro(r.erro);
      setAberto(false);
      aoExcluir?.();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDigitado("");
          setErro(null);
          setAberto(true);
        }}
        className={
          variante === "link"
            ? "text-sm font-semibold text-red-700 hover:underline"
            : "h-9 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
        }
      >
        {rotulo}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/50 p-4 sm:items-center">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 id={idTitulo} className="text-lg font-bold text-tinta">
              {titulo}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{descricao}</p>

            {confirmarDigitando && (
              <label htmlFor={idCampo} className="mt-4 block text-sm font-medium text-zinc-800">
                Para confirmar, digite <strong>{confirmarDigitando}</strong>
                <input
                  id={idCampo}
                  value={digitado}
                  onChange={(e) => setDigitado(e.target.value)}
                  autoComplete="off"
                  className="mt-1.5 h-11 w-full rounded-xl border border-zinc-300 px-3 text-base font-normal outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
                />
              </label>
            )}

            {erro && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {erro}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                ref={cancelar}
                type="button"
                onClick={() => setAberto(false)}
                disabled={pendente}
                className="h-11 rounded-xl border border-zinc-300 font-semibold text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={excluir}
                disabled={!liberado || pendente}
                className="h-11 rounded-xl bg-red-600 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendente ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
