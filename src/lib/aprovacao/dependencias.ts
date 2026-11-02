import "server-only";
import { after } from "next/server";
import { armazenamento } from "@/lib/armazenamento";
import { envPublico } from "@/lib/env";
import { configEmail } from "@/lib/env-servidor";
import { enviarPeloResend, notificarDecisao } from "@/lib/notificacoes/email";
import type { ClienteAdmin } from "@/lib/supabase/admin";
import type { DependenciasPagina } from "./pagina";
import type { DependenciasDecisao } from "./servico";

export function dependenciasPagina(admin: ClienteAdmin): DependenciasPagina {
  return {
    async buscarPagina(tokenHash) {
      const { data, error } = await admin.rpc("get_approval_page", { p_token_hash: tokenHash });
      if (error) throw new Error(`Falha ao carregar a página de aprovação: ${error.message}`);
      return data;
    },
    // As URLs das mídias valem 1 hora; recarregar a página gera novas.
    assinarUrls: (caminhos) => armazenamento().assinarLeitura(caminhos),
  };
}

/**
 * Dependências do registro da decisão do cliente. O cliente admin só grava o
 * áudio na pasta devolvida por get_audio_upload_folder, que valida o link.
 */
export function dependenciasDecisao(admin: ClienteAdmin): DependenciasDecisao<Blob> {
  const arquivos = armazenamento();
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
      // Envia os bytes com o tipo já limpo ("audio/webm"), e não
      // "audio/webm;codecs=opus", que o storage pode recusar.
      try {
        await arquivos.enviar(caminho, await audio.arrayBuffer(), tipo);
        return true;
      } catch (erro) {
        console.error("[aprovacao] Falha ao enviar áudio:", erro);
        return false;
      }
    },
    async removerAudio(caminho) {
      await arquivos.apagar([caminho]).catch((erro) =>
        console.error("[aprovacao] Falha ao apagar áudio:", erro),
      );
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
      return (await arquivos.assinarLeitura([caminho])).get(caminho) ?? null;
    },
    aposRegistrar(eventoId) {
      const email = configEmail();
      if (!email) return;
      // Depois da resposta: o cliente não espera o e-mail sair.
      after(() =>
        notificarDecisao(eventoId, {
          siteUrl: envPublico().NEXT_PUBLIC_SITE_URL,
          enviar: (aviso) => enviarPeloResend(email, aviso),
          async buscarInfo(id) {
            const { data, error } = await admin.rpc("get_event_notification", { p_event_id: id });
            if (error) throw new Error(error.message);
            return data;
          },
        }),
      );
    },
  };
}
