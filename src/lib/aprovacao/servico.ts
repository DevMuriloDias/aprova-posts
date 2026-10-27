import { z } from "zod";
import { hashDoToken, tokenTemFormatoValido } from "@/lib/links/token";
import { LIMITE_COMENTARIO } from "./limites";
import type { ResultadoDecisao } from "./tipos";

export const MENSAGENS = {
  linkInvalido: "Este link não está mais ativo. Peça um novo link a quem enviou os posts.",
  postInvalido: "Este post não está mais disponível para aprovação.",
  semComentario: "Conte o que precisa ser ajustado.",
  comentarioLongo: `O comentário pode ter no máximo ${LIMITE_COMENTARIO} caracteres.`,
  generico: "Não foi possível registrar sua resposta. Tente novamente.",
} as const;

const esquemaDecisao = z
  .object({
    postId: z.uuid(),
    acao: z.enum(["approved", "changes_requested"]),
    comentario: z
      .string()
      .trim()
      .max(LIMITE_COMENTARIO, MENSAGENS.comentarioLongo)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine((d) => d.acao !== "changes_requested" || d.comentario, {
    message: MENSAGENS.semComentario,
  });

export type EntradaDecisao = {
  token: string;
  postId: string;
  acao: string;
  comentario?: string;
};

export type RegistrarNoBanco = (args: {
  tokenHash: string;
  postId: string;
  acao: "approved" | "changes_requested";
  comentario: string | null;
}) => Promise<
  | { ok: true; evento: { action: "approved" | "changes_requested"; comment: string | null; created_at: string } }
  | { ok: false; mensagem: string }
>;

export async function registrarDecisao(
  entrada: EntradaDecisao,
  registrar: RegistrarNoBanco,
): Promise<ResultadoDecisao> {
  if (!tokenTemFormatoValido(entrada.token)) {
    return { ok: false, erro: MENSAGENS.linkInvalido };
  }

  const dados = esquemaDecisao.safeParse(entrada);
  if (!dados.success) {
    const mensagem = dados.error.issues[0]?.message;
    const conhecida = Object.values(MENSAGENS).find((m) => m === mensagem);
    return { ok: false, erro: conhecida ?? MENSAGENS.postInvalido };
  }

  const r = await registrar({
    tokenHash: hashDoToken(entrada.token),
    postId: dados.data.postId,
    acao: dados.data.acao,
    comentario: dados.data.comentario ?? null,
  });

  if (!r.ok) {
    if (r.mensagem.includes("link_invalido")) return { ok: false, erro: MENSAGENS.linkInvalido };
    if (r.mensagem.includes("post_invalido")) return { ok: false, erro: MENSAGENS.postInvalido };
    return { ok: false, erro: MENSAGENS.generico };
  }

  return {
    ok: true,
    status: r.evento.action,
    decisao: { acao: r.evento.action, comentario: r.evento.comment, em: r.evento.created_at },
  };
}
