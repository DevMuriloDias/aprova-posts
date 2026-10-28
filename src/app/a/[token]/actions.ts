"use server";

import { dependenciasDecisao } from "@/lib/aprovacao/dependencias";
import { registrarDecisao } from "@/lib/aprovacao/servico";
import type { ResultadoDecisao } from "@/lib/aprovacao/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

/**
 * Ação pública (o cliente não tem login): a autorização é o próprio token,
 * validado de novo no banco a cada chamada (get_audio_upload_folder e
 * register_approval). Recebe FormData para poder trazer o áudio gravado.
 */
export async function decidir(token: string, formData: FormData): Promise<ResultadoDecisao> {
  const audio = formData.get("audio");
  return registrarDecisao(
    {
      token,
      postId: texto(formData, "postId"),
      acao: texto(formData, "acao"),
      comentario: texto(formData, "comentario") || undefined,
      audio: audio instanceof Blob && audio.size > 0 ? audio : null,
    },
    dependenciasDecisao(criarClienteAdmin()),
  );
}
