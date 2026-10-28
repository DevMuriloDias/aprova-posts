"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotaoEnviar } from "@/components/ui/botao-enviar";
import { Campo } from "@/components/ui/campo";
import { entrar } from "../actions";
import { FormularioReenvio } from "../formulario-reenvio";

const MENSAGENS_URL: Record<string, string> = {
  "link-invalido":
    "O link de confirmação não funcionou. Se você já clicou nele antes, seu e-mail pode já estar confirmado: tente entrar. Se não, peça um novo link abaixo.",
};

export function FormularioEntrar() {
  const params = useSearchParams();
  const [estado, acao] = useActionState(entrar, {});
  const erroUrl = MENSAGENS_URL[params.get("erro") ?? ""];
  const erro = estado.erro ?? (estado.erros ? undefined : erroUrl);

  const linkFalhou = params.get("erro") === "link-invalido";
  const oferecerReenvio = estado.precisaConfirmar || (linkFalhou && !estado.erro);

  return (
    <div className="flex flex-col gap-4">
      <form action={acao} className="flex flex-col gap-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <input type="hidden" name="proximo" value={params.get("proximo") ?? ""} />
        <Campo
          name="email"
          type="email"
          rotulo="E-mail"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          defaultValue={estado.valores?.email}
          erro={estado.erros?.email}
          required
        />
        <Campo
          name="senha"
          type="password"
          rotulo="Senha"
          autoComplete="current-password"
          erro={estado.erros?.senha}
          required
        />
        <BotaoEnviar enviando="Entrando…">Entrar</BotaoEnviar>
      </form>
      {oferecerReenvio && (
        <FormularioReenvio
          key={estado.valores?.email ?? ""}
          emailInicial={estado.valores?.email}
          aberto={estado.precisaConfirmar}
        />
      )}
    </div>
  );
}
