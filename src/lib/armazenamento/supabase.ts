import "server-only";
import { BUCKET } from "@/lib/painel/constantes";
import type { ClienteAdmin } from "@/lib/supabase/admin";
import { LIMITE_SUPABASE } from "./limites";
import { VALIDADE_URL_SEGUNDOS, type Armazenamento } from "./tipos";

/** Supabase Storage (bucket privado post-media), usado enquanto o R2 não está configurado. */
export function criarArmazenamentoSupabase(admin: ClienteAdmin): Armazenamento {
  const bucket = () => admin.storage.from(BUCKET);
  return {
    modo: "supabase",
    limiteBytes: LIMITE_SUPABASE,

    async assinarLeitura(caminhos) {
      const urls = new Map<string, string>();
      if (caminhos.length === 0) return urls;
      const { data, error } = await bucket().createSignedUrls(caminhos, VALIDADE_URL_SEGUNDOS);
      if (error) throw new Error(`Falha ao assinar as mídias: ${error.message}`);
      for (const item of data) {
        if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
      }
      return urls;
    },

    // No Supabase o navegador envia com a própria sessão (o RLS do storage
    // só deixa gravar na pasta do dono).
    async prepararEnvio(caminho) {
      return { modo: "supabase", caminho };
    },

    async enviar(caminho, bytes, tipo) {
      const { error } = await bucket().upload(caminho, bytes, { contentType: tipo, upsert: false });
      if (error) throw new Error(`Falha ao enviar para o storage: ${error.message}`);
    },

    async apagar(caminhos) {
      for (let i = 0; i < caminhos.length; i += 100) {
        const { error } = await bucket().remove(caminhos.slice(i, i + 100));
        if (error) throw new Error(`Falha ao apagar do storage: ${error.message}`);
      }
    },
  };
}
