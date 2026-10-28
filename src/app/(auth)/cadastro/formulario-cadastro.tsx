"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotaoEnviar } from "@/components/ui/botao-enviar";
import { Campo } from "@/components/ui/campo";
import { cadastrar } from "../actions";
import { FormularioReenvio } from "../formulario-reenvio";

export function FormularioCadastro() {
  const [estado, acao] = useActionState(cadastrar, {});

  if (estado.sucesso) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso tipo="sucesso">{estado.sucesso}</Aviso>
        <FormularioReenvio
          emailInicial={estado.valores?.email}
          chamada="Não chegou? Reenviar o e-mail"
        />
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <Campo
        name="nome"
        rotulo="Seu nome"
        autoComplete="name"
        defaultValue={estado.valores?.nome}
        erro={estado.erros?.nome}
        required
      />
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
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres"
        erro={estado.erros?.senha}
        required
      />
      <Campo
        name="confirmacao"
        type="password"
        rotulo="Repita a senha"
        autoComplete="new-password"
        erro={estado.erros?.confirmacao}
        required
      />
      <BotaoEnviar enviando="Criando conta…">Criar conta</BotaoEnviar>
    </form>
  );
}
