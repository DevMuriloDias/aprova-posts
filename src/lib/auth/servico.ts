import type { SupabaseClient } from "@supabase/supabase-js";
import { caminhoSeguro, ROTA_PAINEL } from "./rotas";
import {
  errosPorCampo,
  esquemaCadastro,
  esquemaEntrar,
  traduzirErroAuth,
  type ErrosDeCampo,
} from "./validacao";

/** Só a parte do Supabase Auth que usamos (facilita os testes). */
export type AuthCliente = Pick<SupabaseClient["auth"], "signInWithPassword" | "signUp">;

export type EstadoFormulario = {
  erro?: string;
  erros?: ErrosDeCampo;
  sucesso?: string;
  /** Valores para repreencher o formulário (nunca a senha). */
  valores?: { nome?: string; email?: string };
};

export type Resultado =
  | { tipo: "estado"; estado: EstadoFormulario }
  | { tipo: "redirecionar"; destino: string };

/**
 * Mostra no terminal do servidor o motivo real de um erro do Supabase Auth.
 * Registra só código, status e mensagem: nunca senha nem e-mail.
 */
export function registrarErroAuth(
  operacao: "entrar" | "cadastrar",
  erro: { code?: string; status?: number; message?: string; name?: string },
) {
  console.error(`[auth] Falha ao ${operacao}:`, {
    code: erro.code,
    status: erro.status,
    name: erro.name,
    message: erro.message,
  });
}

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

export async function processarEntrada(
  auth: AuthCliente,
  formData: FormData,
): Promise<Resultado> {
  const email = texto(formData, "email");
  const dados = esquemaEntrar.safeParse({ email, senha: texto(formData, "senha") });
  if (!dados.success) {
    return { tipo: "estado", estado: { erros: errosPorCampo(dados.error), valores: { email } } };
  }

  const { error } = await auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  if (error) {
    registrarErroAuth("entrar", error);
    return { tipo: "estado", estado: { erro: traduzirErroAuth(error), valores: { email } } };
  }

  return { tipo: "redirecionar", destino: caminhoSeguro(texto(formData, "proximo")) };
}

export async function processarCadastro(
  auth: AuthCliente,
  formData: FormData,
  siteUrl: string,
): Promise<Resultado> {
  const valores = { nome: texto(formData, "nome"), email: texto(formData, "email") };
  const dados = esquemaCadastro.safeParse({
    ...valores,
    senha: texto(formData, "senha"),
    confirmacao: texto(formData, "confirmacao"),
  });
  if (!dados.success) {
    return { tipo: "estado", estado: { erros: errosPorCampo(dados.error), valores } };
  }

  const confirmacao = new URL("/auth/confirm", siteUrl);
  confirmacao.searchParams.set("proximo", ROTA_PAINEL);

  const { data, error } = await auth.signUp({
    email: dados.data.email,
    password: dados.data.senha,
    options: {
      data: { full_name: dados.data.nome },
      emailRedirectTo: confirmacao.toString(),
    },
  });
  if (error) {
    registrarErroAuth("cadastrar", error);
    return { tipo: "estado", estado: { erro: traduzirErroAuth(error), valores } };
  }

  // Se a confirmação de e-mail estiver desligada no Supabase, já vem a sessão.
  if (data.session) {
    return { tipo: "redirecionar", destino: ROTA_PAINEL };
  }

  return {
    tipo: "estado",
    estado: {
      sucesso: `Quase lá! Enviamos um link de confirmação para ${dados.data.email}. Abra o e-mail para ativar sua conta.`,
    },
  };
}
