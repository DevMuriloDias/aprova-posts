"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import type { LinkAtivo } from "@/lib/painel/consultas";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { acaoGerarLink, acaoRevogarLink } from "../../actions";

type Props = { clienteId: string; nomeCliente: string; link: LinkAtivo };

export function SecaoLink({ clienteId, nomeCliente, link }: Props) {
  const [pendente, iniciar] = useTransition();
  const [novo, setNovo] = useState<{ url: string; expiraEm: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function gerar() {
    if (link && !confirm("Gerar um novo link desativa o link atual. Continuar?")) return;
    setErro(null);
    iniciar(async () => {
      const r = await acaoGerarLink(clienteId);
      if (!r.ok) return setErro(r.erro);
      setNovo({ url: r.url, expiraEm: r.expiraEm });
      setCopiado(false);
    });
  }

  function revogar() {
    if (!link || !confirm("O cliente não vai mais conseguir abrir este link. Revogar?")) return;
    setErro(null);
    iniciar(async () => {
      const r = await acaoRevogarLink(link.id, clienteId);
      if (!r.ok) return setErro(r.erro);
      setNovo(null);
    });
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  const mensagemWhatsapp = novo
    ? `Oi! Seguem os posts de ${nomeCliente} para aprovação: ${novo.url}`
    : "";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
      <h2 className="text-base font-bold text-zinc-900">Link de aprovação</h2>
      {erro && (
        <div className="mt-3">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      {novo ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-zinc-600">
            Envie este link ao cliente. Por segurança, ele só aparece agora: se perder, gere outro.
          </p>
          <input
            readOnly
            value={novo.url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Link de aprovação"
            className="h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 font-mono text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => copiar(novo.url)}
              className="h-11 rounded-xl bg-indigo-600 font-semibold text-white"
            >
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensagemWhatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-11 place-items-center rounded-xl border border-zinc-300 font-semibold text-zinc-800"
            >
              Enviar no WhatsApp
            </a>
          </div>
          <p className="text-xs text-zinc-500">Válido até {formatarData(novo.expiraEm)}.</p>
        </div>
      ) : link ? (
        <p className="mt-2 text-sm text-zinc-600">
          Há um link ativo até <strong>{formatarData(link.expiraEm)}</strong>.{" "}
          {link.ultimoAcesso
            ? `Último acesso do cliente: ${formatarDataHora(link.ultimoAcesso)}.`
            : "O cliente ainda não abriu."}
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">
          Nenhum link ativo. Gere um link para o cliente ver e aprovar os posts. Ele vale por 30 dias.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={gerar}
          disabled={pendente}
          className="h-10 rounded-xl border border-indigo-300 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
        >
          {pendente ? "Aguarde…" : link || novo ? "Gerar novo link" : "Gerar link"}
        </button>
        {(link || novo) && (
          <button
            type="button"
            onClick={revogar}
            disabled={pendente || !link}
            className="h-10 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            Revogar link
          </button>
        )}
      </div>
    </section>
  );
}
