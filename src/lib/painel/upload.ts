import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "./constantes";
import { TIPOS_MIDIA_ACEITOS, caminhoDaMidia } from "./validacao";

export type MidiaEnviada = { caminho: string; tipo: "image" | "video" };

/**
 * Envia as mídias de um post, na ordem, para a pasta do dono no bucket.
 * Se alguma falhar, apaga as que já tinham subido e devolve o erro.
 */
export async function enviarMidias(
  supabase: Pick<SupabaseClient, "storage">,
  pasta: { donoId: string; clienteId: string; postId: string },
  arquivos: File[],
  aoProgredir?: (atual: number, total: number) => void,
): Promise<{ ok: true; midias: MidiaEnviada[] } | { ok: false; erro: string }> {
  const enviadas: MidiaEnviada[] = [];
  for (const [i, arquivo] of arquivos.entries()) {
    aoProgredir?.(i + 1, arquivos.length);
    const caminho = caminhoDaMidia(
      pasta.donoId,
      pasta.clienteId,
      pasta.postId,
      i,
      arquivo.name,
      crypto.randomUUID().slice(0, 8),
    );
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, arquivo, { contentType: arquivo.type });
    if (error) {
      await removerMidias(supabase, enviadas);
      return { ok: false, erro: `Não foi possível enviar "${arquivo.name}". Tente novamente.` };
    }
    enviadas.push({
      caminho,
      tipo: TIPOS_MIDIA_ACEITOS[arquivo.type as keyof typeof TIPOS_MIDIA_ACEITOS],
    });
  }
  return { ok: true, midias: enviadas };
}

export async function removerMidias(
  supabase: Pick<SupabaseClient, "storage">,
  midias: { caminho: string }[],
) {
  if (midias.length === 0) return;
  await supabase.storage.from(BUCKET).remove(midias.map((m) => m.caminho));
}

/** ISO → valor do <input type="datetime-local"> no fuso do navegador. */
export function paraCampoDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
