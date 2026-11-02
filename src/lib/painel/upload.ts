import type { DestinoEnvio } from "@/lib/armazenamento/tipos";
import type { PedidoEnvio } from "./envio";
import type { Resultado } from "./servico";
import { TIPOS_MIDIA_ACEITOS } from "./validacao";

export type MidiaEnviada = { caminho: string; tipo: "image" | "video" };

export type DependenciasEnvio = {
  /** Server Action que valida e devolve onde enviar cada arquivo. */
  preparar: (pedido: PedidoEnvio) => Promise<Resultado<{ destinos: DestinoEnvio[] }>>;
  /** Envia um arquivo; `aoProgresso` recebe de 0 a 1. */
  enviarArquivo: (destino: DestinoEnvio, arquivo: File, aoProgresso: (fracao: number) => void) => Promise<boolean>;
  /** Server Action que apaga o que subiu e não será usado. */
  descartar: (caminhos: string[]) => Promise<unknown>;
};

type Alvo = { destino: "post"; clienteId: string; postId: string } | { destino: "avatar"; clienteId: string };

/**
 * Envia as mídias, na ordem, para a pasta do dono (R2 ou Supabase).
 * Se alguma falhar, descarta as que já tinham subido e devolve o erro.
 */
export async function enviarMidias(
  alvo: Alvo,
  arquivos: File[],
  deps: DependenciasEnvio,
  aoProgredir?: (atual: number, total: number, fracao: number) => void,
): Promise<{ ok: true; midias: MidiaEnviada[] } | { ok: false; erro: string }> {
  const preparo = await deps.preparar({
    ...alvo,
    arquivos: arquivos.map((a) => ({ nome: a.name, tipo: a.type, tamanho: a.size })),
  } as PedidoEnvio);
  if (!preparo.ok) return preparo;

  const enviadas: MidiaEnviada[] = [];
  for (const [i, arquivo] of arquivos.entries()) {
    const destino = preparo.destinos[i];
    aoProgredir?.(i + 1, arquivos.length, 0);
    const ok = await deps
      .enviarArquivo(destino, arquivo, (fracao) => aoProgredir?.(i + 1, arquivos.length, fracao))
      .catch(() => false);
    if (!ok) {
      await descartarMidias(deps, enviadas);
      return {
        ok: false,
        erro: `Não foi possível enviar "${arquivo.name}". Confira a conexão e tente de novo.`,
      };
    }
    enviadas.push({
      caminho: destino.caminho,
      tipo: TIPOS_MIDIA_ACEITOS[arquivo.type as keyof typeof TIPOS_MIDIA_ACEITOS],
    });
  }
  return { ok: true, midias: enviadas };
}

export async function descartarMidias(deps: Pick<DependenciasEnvio, "descartar">, midias: { caminho: string }[]) {
  if (midias.length === 0) return;
  await deps.descartar(midias.map((m) => m.caminho)).catch(() => undefined);
}

/** "Enviando 1 de 3… 45%" */
export function textoDoProgresso(atual: number, total: number, fracao: number): string {
  const base = total > 1 ? `Enviando ${atual} de ${total}…` : "Enviando…";
  return fracao > 0 && fracao < 1 ? `${base} ${Math.round(fracao * 100)}%` : base;
}

/** ISO → valor do <input type="datetime-local"> no fuso do navegador. */
export function paraCampoDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
