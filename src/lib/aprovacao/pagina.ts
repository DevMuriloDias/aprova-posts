import { hashDoToken, tokenTemFormatoValido } from "@/lib/links/token";
import { esquemaPaginaBanco, type PaginaAprovacao } from "./tipos";

export type DependenciasPagina = {
  /** Chama public.get_approval_page com o hash do token. */
  buscarPagina: (tokenHash: string) => Promise<unknown>;
  /** Gera URLs assinadas (temporárias) para caminhos do bucket privado. */
  assinarUrls: (caminhos: string[]) => Promise<Map<string, string>>;
};

export async function carregarPaginaAprovacao(
  token: string,
  deps: DependenciasPagina,
): Promise<PaginaAprovacao> {
  if (!tokenTemFormatoValido(token)) {
    return { estado: "inexistente" };
  }

  const bruto = await deps.buscarPagina(hashDoToken(token));
  if (bruto === null || bruto === undefined) {
    return { estado: "inexistente" };
  }

  const pagina = esquemaPaginaBanco.parse(bruto);
  if (pagina.state === "revoked") return { estado: "revogado" };
  if (pagina.state === "expired") return { estado: "expirado" };

  const caminhos = [
    ...(pagina.client.avatar_path ? [pagina.client.avatar_path] : []),
    ...pagina.posts.flatMap((p) => p.slides.map((s) => s.storage_path)),
    ...pagina.posts.flatMap((p) => (p.last_event?.audio_path ? [p.last_event.audio_path] : [])),
  ];
  const urls = caminhos.length > 0 ? await deps.assinarUrls(caminhos) : new Map<string, string>();

  return {
    estado: "ativo",
    expiraEm: pagina.expires_at,
    cliente: {
      nome: pagina.client.name,
      instagram: pagina.client.instagram_handle,
      avatarUrl: pagina.client.avatar_path ? (urls.get(pagina.client.avatar_path) ?? null) : null,
    },
    posts: pagina.posts.map((p) => ({
      id: p.id,
      legenda: p.caption,
      status: p.status,
      agendadoPara: p.scheduled_for,
      versao: p.version,
      reenviadoEm: p.resubmitted_at,
      midias: p.slides.map((s) => ({
        tipo: s.media_type,
        url: urls.get(s.storage_path) ?? null,
      })),
      ultimaDecisao: p.last_event
        ? {
            acao: p.last_event.action,
            comentario: p.last_event.comment,
            audioUrl: p.last_event.audio_path ? (urls.get(p.last_event.audio_path) ?? null) : null,
            versao: p.last_event.post_version,
            em: p.last_event.created_at,
          }
        : null,
    })),
  };
}
