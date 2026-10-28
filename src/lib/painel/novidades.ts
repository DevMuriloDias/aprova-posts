import type { Decisao } from "@/lib/aprovacao/tipos";

export const LIMITE_NOVIDADES = 30;

/** Linha de approval_events com o post e o cliente (consulta do painel). */
export type LinhaNovidade = {
  id: string;
  action: Decisao;
  comment: string | null;
  audio_path: string | null;
  post_version: number;
  created_at: string;
  posts: { id: string; caption: string; client_id: string; clients: { name: string } | null } | null;
};

export type Novidade = {
  id: string;
  acao: Decisao;
  comentario: string | null;
  audioUrl: string | null;
  versao: number;
  em: string;
  nova: boolean;
  clienteId: string | null;
  clienteNome: string;
  legenda: string;
};

/** Uma resposta é nova se chegou depois da última visita às Novidades. */
export function ehNova(em: string, vistoEm: string): boolean {
  return new Date(em).getTime() > new Date(vistoEm).getTime();
}

export function mapearNovidades(
  linhas: LinhaNovidade[],
  vistoEm: string,
  urls: Map<string, string>,
): Novidade[] {
  return linhas.map((l) => ({
    id: l.id,
    acao: l.action,
    comentario: l.comment,
    audioUrl: l.audio_path ? (urls.get(l.audio_path) ?? null) : null,
    versao: l.post_version,
    em: l.created_at,
    nova: ehNova(l.created_at, vistoEm),
    clienteId: l.posts?.client_id ?? null,
    clienteNome: l.posts?.clients?.name ?? "Cliente",
    legenda: l.posts?.caption ?? "",
  }));
}

/** Aceita só datas válidas vindas da URL (?desde=...). */
export function dataValida(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const tempo = Date.parse(valor);
  return Number.isNaN(tempo) ? null : new Date(tempo).toISOString();
}
