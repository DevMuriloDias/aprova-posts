"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BUCKET } from "@/lib/painel/constantes";
import { caminhoDoAvatar, problemaNoArquivo } from "@/lib/painel/validacao";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { acaoCriarCliente } from "./actions";

export function FormularioCliente({ donoId }: { donoId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="h-11 rounded-xl bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700"
      >
        + Novo cliente
      </button>
    );
  }

  function enviar(form: FormData) {
    setErro(null);
    const foto = form.get("foto");
    const arquivo = foto instanceof File && foto.size > 0 ? foto : null;
    if (arquivo) {
      const problema = problemaNoArquivo(arquivo, { apenasImagem: true });
      if (problema) return setErro(problema);
    }

    iniciar(async () => {
      const id = crypto.randomUUID();
      let avatarPath: string | undefined;
      const supabase = criarClienteNavegador();

      if (arquivo) {
        avatarPath = caminhoDoAvatar(donoId, id, arquivo.name, crypto.randomUUID().slice(0, 8));
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(avatarPath, arquivo, { contentType: arquivo.type });
        if (error) return setErro("Não foi possível enviar a foto. Tente novamente.");
      }

      const r = await acaoCriarCliente({
        id,
        nome: String(form.get("nome") ?? ""),
        instagram: String(form.get("instagram") ?? ""),
        avatarPath,
      });
      if (!r.ok) {
        if (avatarPath) await supabase.storage.from(BUCKET).remove([avatarPath]);
        return setErro(r.erro);
      }
      router.push(`/painel/clientes/${r.id}`);
    });
  }

  return (
    <form
      action={enviar}
      className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"
    >
      <h2 className="text-base font-bold text-zinc-900">Novo cliente</h2>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Nome do cliente
        <input
          name="nome"
          required
          maxLength={120}
          className="h-12 rounded-xl border border-zinc-300 px-4 text-base font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        @ do perfil (opcional)
        <input
          name="instagram"
          maxLength={31}
          placeholder="padariadobairro"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-12 rounded-xl border border-zinc-300 px-4 text-base font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
        Foto de perfil (opcional)
        <input
          name="foto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-semibold"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="h-11 rounded-xl border border-zinc-300 font-semibold text-zinc-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pendente}
          className="h-11 rounded-xl bg-indigo-600 font-semibold text-white disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
