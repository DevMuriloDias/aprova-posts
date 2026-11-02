// Limites de envio por destino. Pode ser importado no navegador.

const MB = 1024 * 1024;

/** Supabase gratuito: no máximo 50 MB por arquivo (limite global do plano). */
export const LIMITE_SUPABASE = 50 * MB;

/** Cloudflare R2: o envio direto aceita bem mais; 500 MB cobre vídeos longos. */
export const LIMITE_R2 = 500 * MB;

export type ModoArmazenamento = "r2" | "supabase";

export function limiteDoModo(modo: ModoArmazenamento): number {
  return modo === "r2" ? LIMITE_R2 : LIMITE_SUPABASE;
}

/** "50 MB" */
export function textoDoLimite(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}
