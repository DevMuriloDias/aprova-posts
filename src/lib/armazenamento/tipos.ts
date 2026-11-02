import type { ModoArmazenamento } from "./limites";

/** Onde o navegador deve enviar um arquivo. */
export type DestinoEnvio =
  | { modo: "r2"; caminho: string; url: string; headers: Record<string, string> }
  | { modo: "supabase"; caminho: string };

/**
 * Onde ficam as mídias (fotos, vídeos e áudios). Os caminhos são sempre
 * "<dono>/<cliente>/...": quem chama já validou que o dono é o usuário.
 */
export interface Armazenamento {
  modo: ModoArmazenamento;
  limiteBytes: number;
  /** URLs temporárias de leitura (1 hora). */
  assinarLeitura(caminhos: string[]): Promise<Map<string, string>>;
  /** Prepara o envio direto do navegador para um caminho. */
  prepararEnvio(caminho: string, tipo: string, tamanho: number): Promise<DestinoEnvio>;
  /** Envia pelo servidor (áudio do cliente). */
  enviar(caminho: string, bytes: ArrayBuffer, tipo: string): Promise<void>;
  apagar(caminhos: string[]): Promise<void>;
}

export const VALIDADE_URL_SEGUNDOS = 60 * 60;
