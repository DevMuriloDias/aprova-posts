import { z } from "zod";

const email = z
  .string({ error: "Informe seu e-mail." })
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .pipe(z.email("Informe um e-mail válido."));

export const esquemaEntrar = z.object({
  email,
  senha: z.string({ error: "Informe sua senha." }).min(1, "Informe sua senha."),
});

export const esquemaCadastro = z
  .object({
    nome: z
      .string({ error: "Informe seu nome." })
      .trim()
      .min(2, "Informe seu nome.")
      .max(120, "O nome pode ter no máximo 120 caracteres."),
    email,
    senha: z
      .string({ error: "Crie uma senha." })
      .min(8, "A senha precisa ter pelo menos 8 caracteres.")
      .max(72, "A senha pode ter no máximo 72 caracteres."),
    confirmacao: z.string({ error: "Repita a senha." }),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    path: ["confirmacao"],
    message: "As senhas não conferem.",
  });

export type ErrosDeCampo = Partial<Record<string, string>>;

/** Primeiro erro de cada campo, pronto para exibir no formulário. */
export function errosPorCampo(erro: z.ZodError): ErrosDeCampo {
  const erros: ErrosDeCampo = {};
  for (const issue of erro.issues) {
    const campo = String(issue.path[0] ?? "formulario");
    erros[campo] ??= issue.message;
  }
  return erros;
}

const MENSAGENS_SUPABASE: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  email_exists: "Já existe uma conta com este e-mail.",
  weak_password: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.",
  email_address_invalid: "Informe um e-mail válido.",
  signup_disabled: "Novos cadastros estão desativados no momento.",
  over_email_send_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  otp_expired: "O link expirou. Peça um novo.",
};

/** Traduz erros do Supabase Auth para mensagens em pt-BR. */
export function traduzirErroAuth(erro: { code?: string; message?: string } | null): string {
  if (erro?.code && MENSAGENS_SUPABASE[erro.code]) {
    return MENSAGENS_SUPABASE[erro.code];
  }
  return "Não foi possível concluir agora. Tente novamente em instantes.";
}
