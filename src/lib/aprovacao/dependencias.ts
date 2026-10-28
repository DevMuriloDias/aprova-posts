import "server-only";
import { BUCKET as BUCKET_MIDIAS } from "@/lib/painel/constantes";
import type { ClienteAdmin } from "@/lib/supabase/admin";
import type { DependenciasPagina } from "./pagina";
import type { DependenciasDecisao } from "./servico";

export { BUCKET_MIDIAS };

/** As URLs das mídias valem 1 hora; recarregar a página gera novas. */
const VALIDADE_URL_SEGUNDOS = 60 * 60;

export function dependenciasPagina(admin: ClienteAdmin): DependenciasPagina {
  return {
    async buscarPagina(tokenHash) {
      const { data, error } = await admin.rpc("get_approval_page", { p_token_hash: tokenHash });
      if (error) throw new Error(`Falha ao carregar a página de aprovação: ${error.message}`);
      return data;
    },
    async assinarUrls(caminhos) {
      const { data, error } = await admin.storage
        .from(BUCKET_MIDIAS)
        .createSignedUrls(caminhos, VALIDADE_URL_SEGUNDOS);
      if (error) throw new Error(`Falha ao assinar as mídias: ${error.message}`);
      const urls = new Map<string, string>();
      for (const item of data) {
        if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
      }
      return urls;
    },
  };
}

/**
 * Dependências do registro da decisão do cliente. O cliente admin só grava o
 * áudio na pasta devolvida por get_audio_upload_folder, que valida o link.
 */
export function dependenciasDecisao(admin: ClienteAdmin): DependenciasDecisao<Blob> {
  const bucket = () => admin.storage.from(BUCKET_MIDIAS);
  return {
    async pastaDoAudio(tokenHash, postId) {
      const { data, error } = await admin.rpc("get_audio_upload_folder", {
        p_token_hash: tokenHash,
        p_post_id: postId,
      });
      if (error || !data) return { ok: false, mensagem: error?.message ?? "sem_resposta" };
      return { ok: true, pasta: data };
    },
    async enviarAudio(caminho, audio, tipo) {
      // Envia os bytes (e não o Blob): assim o storage recebe o tipo já limpo
      // ("audio/webm"), e não "audio/webm;codecs=opus", que o bucket não lista.
      const bytes = await audio.arrayBuffer();
      const { error } = await bucket().upload(caminho, bytes, { contentType: tipo, upsert: false });
      if (error) console.error("[aprovacao] Falha ao enviar áudio:", error.message);
      return !error;
    },
    async removerAudio(caminho) {
      await bucket().remove([caminho]);
    },
    async registrar({ tokenHash, postId, acao, comentario, audioPath }) {
      const { data, error } = await admin.rpc("register_approval", {
        p_token_hash: tokenHash,
        p_post_id: postId,
        p_action: acao,
        p_comment: comentario,
        p_audio_path: audioPath,
      });
      if (error || !data) {
        return { ok: false, mensagem: error?.message ?? "sem_resposta" };
      }
      return { ok: true, evento: data };
    },
    async assinar(caminho) {
      const { data } = await bucket().createSignedUrl(caminho, VALIDADE_URL_SEGUNDOS);
      return data?.signedUrl ?? null;
    },
  };
}
