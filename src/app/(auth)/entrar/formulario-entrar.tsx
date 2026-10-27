"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotaoEnviar } from "@/components/ui/botao-enviar";
import { Campo } from "@/components/ui/campo";
import { entrar } from "../actions";

const MENSAGENS_URL: Record<string, string> = {
  "link-invalido": "O link de confirmação é inválido ou expirou. Tente entrar ou cadastre-se de novo.",
};

export function FormularioEntrar() {
  const params = useSearchParams();
  const [estado, acao] = useActionState(entrar, {});
  const erroUrl = MENSAGENS_URL[params.get("erro") ?? ""];
  const erro = estado.erro ?? (estado.erros ? undefined : erroUrl);

  return (
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
  );
}
