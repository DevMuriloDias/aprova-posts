"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotaoEnviar } from "@/components/ui/botao-enviar";
import { Campo } from "@/components/ui/campo";
import { reenviarConfirmacao } from "./actions";

type Props = {
  emailInicial?: string;
  /** Texto do link que abre o formulário. */
  chamada?: string;
  /** Já abre mostrando o campo (sem precisar clicar no link). */
  aberto?: boolean;
};

export function FormularioReenvio({
  emailInicial = "",
  chamada = "Reenviar e-mail de confirmação",
  aberto = false,
}: Props) {
  const [mostrar, setMostrar] = useState(aberto);
  const [estado, acao] = useActionState(reenviarConfirmacao, {});

  if (!mostrar) {
    return (
      <button
        type="button"
        onClick={() => setMostrar(true)}
        className="text-sm font-semibold text-marca-700 hover:underline"
      >
        {chamada}
      </button>
    );
  }

  return (
    <form
      action={acao}
      noValidate
      aria-label="Reenviar e-mail de confirmação"
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
    >
      <p className="text-sm font-medium text-zinc-800">Reenviar e-mail de confirmação</p>
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <Campo
        id="reenvio-email"
        name="email"
        type="email"
        rotulo="E-mail do cadastro"
        autoComplete="email"
        inputMode="email"
        defaultValue={estado.valores?.email ?? emailInicial}
        erro={estado.erros?.email}
        required
      />
      <BotaoEnviar enviando="Enviando…" variante="secundario">
        Enviar novo link
      </BotaoEnviar>
    </form>
  );
}
