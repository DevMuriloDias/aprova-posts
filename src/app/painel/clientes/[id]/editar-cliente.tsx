"use client";

/* eslint-disable @next/next/no-img-element -- prévia local (blob:) e URL assinada da foto */

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Aviso } from "@/components/ui/aviso";
import { descartarMidias, enviarMidias } from "@/lib/painel/upload";
import { problemaNoArquivo } from "@/lib/painel/validacao";
import { acaoEditarCliente } from "../../actions";
import { dependenciasEnvio } from "../../dependencias-envio";

type Props = {
  cliente: { id: string; nome: string; instagram: string | null; avatarUrl: string | null };
  limiteBytes: number;
};

const CAMPO =
  "h-12 rounded-xl border border-zinc-300 px-4 text-base font-normal outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100";

/** Edita nome, @ e foto de perfil do cliente. */
export function EditarCliente({ cliente, limiteBytes }: Props) {
  const router = useRouter();
  const idFoto = useId();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [removerFoto, setRemoverFoto] = useState(false);
  const [pendente, iniciar] = useTransition();

  const previa = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa);
    },
    [previa],
  );

  function fechar() {
    setAberto(false);
    setErro(null);
    setFoto(null);
    setRemoverFoto(false);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="h-10 shrink-0 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
      >
        Editar cliente
      </button>
    );
  }

  function enviar(form: FormData) {
    setErro(null);
    iniciar(async () => {
      let avatarPath: string | undefined;
      if (foto) {
        const envio = await enviarMidias({ destino: "avatar", clienteId: cliente.id }, [foto], dependenciasEnvio);
        if (!envio.ok) return setErro(envio.erro);
        avatarPath = envio.midias[0].caminho;
      }

      const r = await acaoEditarCliente({
        id: cliente.id,
        nome: String(form.get("nome") ?? ""),
        instagram: String(form.get("instagram") ?? ""),
        avatarPath,
        removerFoto: !foto && removerFoto,
      });
      if (!r.ok) {
        if (avatarPath) await descartarMidias(dependenciasEnvio, [{ caminho: avatarPath }]);
        return setErro(r.erro);
      }
      fechar();
      router.refresh();
    });
  }

  const fotoMostrada = previa ?? (removerFoto ? null : cliente.avatarUrl);

  return (
    <form
      action={enviar}
      className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"
    >
      <h2 className="text-base font-bold text-zinc-900">Editar cliente</h2>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="flex flex-col gap-2">
        <label htmlFor={idFoto} className="text-sm font-medium text-zinc-800">
          Foto de perfil
        </label>
        <div className="flex items-center gap-4">
          {fotoMostrada ? (
            <img
              src={fotoMostrada}
              alt="Foto de perfil"
              className="size-16 shrink-0 rounded-full border border-zinc-200 object-cover"
            />
          ) : (
            <Avatar nome={cliente.nome} url={null} tamanho="g" />
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <input
              id={idFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const arquivo = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (!arquivo) return;
                const problema = problemaNoArquivo(arquivo, { apenasImagem: true, limiteBytes });
                if (problema) return setErro(problema);
                setErro(null);
                setFoto(arquivo);
                setRemoverFoto(false);
              }}
              className="text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-semibold"
            />
            {foto ? (
              <button
                type="button"
                onClick={() => setFoto(null)}
                className="self-start text-sm font-semibold text-red-700 hover:underline"
              >
                Desfazer a troca
              </button>
            ) : (
              cliente.avatarUrl && (
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={removerFoto}
                    onChange={(e) => setRemoverFoto(e.target.checked)}
                    className="size-4 accent-marca-600"
                  />
                  Tirar a foto atual
                </label>
              )
            )}
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Nome do cliente
        <input name="nome" required maxLength={120} defaultValue={cliente.nome} className={CAMPO} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        @ do perfil (opcional)
        <input
          name="instagram"
          maxLength={31}
          defaultValue={cliente.instagram ?? ""}
          placeholder="padariadobairro"
          autoCapitalize="none"
          autoCorrect="off"
          className={CAMPO}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={fechar}
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
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
