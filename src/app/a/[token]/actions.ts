"use server";

import { registrarNoBanco } from "@/lib/aprovacao/dependencias";
import { registrarDecisao } from "@/lib/aprovacao/servico";
import type { ResultadoDecisao } from "@/lib/aprovacao/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Ação pública (o cliente não tem login): a autorização é o próprio token,
 * validado de novo no banco a cada chamada por register_approval.
 */
export async function decidir(
  token: string,
  postId: string,
  acao: string,
  comentario?: string,
): Promise<ResultadoDecisao> {
  return registrarDecisao(
    { token, postId, acao, comentario },
    registrarNoBanco(criarClienteAdmin()),
  );
}
