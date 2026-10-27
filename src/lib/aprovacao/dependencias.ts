import "server-only";
import { BUCKET as BUCKET_MIDIAS } from "@/lib/painel/constantes";
import type { ClienteAdmin } from "@/lib/supabase/admin";
import type { DependenciasPagina } from "./pagina";
import type { RegistrarNoBanco } from "./servico";

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

export function registrarNoBanco(admin: ClienteAdmin): RegistrarNoBanco {
  return async ({ tokenHash, postId, acao, comentario }) => {
    const { data, error } = await admin.rpc("register_approval", {
      p_token_hash: tokenHash,
      p_post_id: postId,
      p_action: acao,
      p_comment: comentario,
    });
    if (error || !data) {
      return { ok: false, mensagem: error?.message ?? "sem_resposta" };
    }
    return { ok: true, evento: data };
  };
}
