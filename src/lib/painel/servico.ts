import { gerarToken, hashDoToken, urlDoLink } from "@/lib/links/token";
import { esquemaEdicaoPost, esquemaNovoCliente, esquemaNovoPost } from "./validacao";

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const ERRO_GENERICO = "Não foi possível salvar agora. Tente novamente.";

type RespostaBanco = { error: { message: string; code?: string } | null };

function primeiroErro(issues: { message: string }[]) {
  return issues[0]?.message ?? ERRO_GENERICO;
}

export type EntradaCliente = { id: string; nome: string; instagram: string; avatarPath?: string };

export async function criarCliente(
  entrada: EntradaCliente,
  donoId: string,
  inserir: (linha: {
    id: string;
    name: string;
    instagram_handle: string | null;
    avatar_path: string | null;
  }) => Promise<RespostaBanco>,
): Promise<Resultado<{ id: string }>> {
  const dados = esquemaNovoCliente(donoId).safeParse(entrada);
  if (!dados.success) return { ok: false, erro: primeiroErro(dados.error.issues) };

  const { error } = await inserir({
    id: dados.data.id,
    name: dados.data.nome,
    instagram_handle: dados.data.instagram,
    avatar_path: dados.data.avatarPath,
  });
  if (error) return { ok: false, erro: ERRO_GENERICO };
  return { ok: true, id: dados.data.id };
}

export type EntradaPost = {
  id: string;
  clienteId: string;
  legenda: string;
  agendadoPara?: string;
  midias: { caminho: string; tipo: "image" | "video" }[];
};

export async function criarPost(
  entrada: EntradaPost,
  donoId: string,
  rpcCriarPost: (args: {
    p_id: string;
    p_client_id: string;
    p_caption: string;
    p_scheduled_for: string | null;
    p_slides: { storage_path: string; media_type: "image" | "video" }[];
  }) => Promise<RespostaBanco>,
): Promise<Resultado> {
  const dados = esquemaNovoPost(donoId).safeParse(entrada);
  if (!dados.success) return { ok: false, erro: primeiroErro(dados.error.issues) };

  const { error } = await rpcCriarPost({
    p_id: dados.data.id,
    p_client_id: dados.data.clienteId,
    p_caption: dados.data.legenda,
    p_scheduled_for: dados.data.agendadoPara ? new Date(dados.data.agendadoPara).toISOString() : null,
    p_slides: dados.data.midias.map((m) => ({ storage_path: m.caminho, media_type: m.tipo })),
  });
  if (error) return { ok: false, erro: ERRO_GENERICO };
  return { ok: true };
}

export type EntradaEdicao = Omit<EntradaPost, "midias"> & { midias?: EntradaPost["midias"] };

/**
 * Edita o post e o devolve para aprovação do cliente (nova versão).
 * Retorna os caminhos das mídias que saíram, para apagar do storage.
 */
export async function editarPost(
  entrada: EntradaEdicao,
  donoId: string,
  rpcEditarPost: (args: {
    p_id: string;
    p_caption: string;
    p_scheduled_for: string | null;
    p_slides: { storage_path: string; media_type: "image" | "video" }[] | null;
  }) => Promise<RespostaBanco & { data: string[] | null }>,
): Promise<Resultado<{ removidos: string[] }>> {
  const dados = esquemaEdicaoPost(donoId).safeParse(entrada);
  if (!dados.success) return { ok: false, erro: primeiroErro(dados.error.issues) };

  const { data, error } = await rpcEditarPost({
    p_id: dados.data.id,
    p_caption: dados.data.legenda,
    p_scheduled_for: dados.data.agendadoPara ? new Date(dados.data.agendadoPara).toISOString() : null,
    p_slides: dados.data.midias
      ? dados.data.midias.map((m) => ({ storage_path: m.caminho, media_type: m.tipo }))
      : null,
  });
  if (error) {
    return {
      ok: false,
      erro: error.message.includes("post_nao_encontrado") ? "Post não encontrado." : ERRO_GENERICO,
    };
  }
  return { ok: true, removidos: data ?? [] };
}

export async function gerarLink(
  clienteId: string,
  siteUrl: string,
  rpcCriarLink: (args: { p_client_id: string; p_token_hash: string }) => Promise<
    RespostaBanco & { data: { expires_at: string } | null }
  >,
  token: string = gerarToken(),
): Promise<Resultado<{ url: string; expiraEm: string }>> {
  const { data, error } = await rpcCriarLink({
    p_client_id: clienteId,
    p_token_hash: hashDoToken(token),
  });
  if (error || !data) {
    return {
      ok: false,
      erro: error?.message.includes("cliente_nao_encontrado")
        ? "Cliente não encontrado."
        : "Não foi possível gerar o link. Tente novamente.",
    };
  }
  return { ok: true, url: urlDoLink(siteUrl, token), expiraEm: data.expires_at };
}
