import "server-only";
import { BUCKET_MIDIAS } from "@/lib/aprovacao/dependencias";
import { resumir, type Resumo } from "@/lib/aprovacao/progresso";
import type { Decisao, StatusPost } from "@/lib/aprovacao/tipos";
import { criarClienteSupabase } from "@/lib/supabase/server";
import { ordemDePublicacao } from "./ordem";

type Supabase = Awaited<ReturnType<typeof criarClienteSupabase>>;

const VALIDADE_URL_SEGUNDOS = 60 * 60;

async function assinar(supabase: Supabase, caminhos: string[]) {
  const urls = new Map<string, string>();
  if (caminhos.length === 0) return urls;
  // Com a sessão do social media: o RLS do storage só assina arquivos da pasta dele.
  const { data } = await supabase.storage
    .from(BUCKET_MIDIAS)
    .createSignedUrls(caminhos, VALIDADE_URL_SEGUNDOS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export type ClienteNaLista = {
  id: string;
  nome: string;
  instagram: string | null;
  avatarUrl: string | null;
  resumo: Resumo;
};

export async function listarClientes(): Promise<ClienteNaLista[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, instagram_handle, avatar_path, posts(status)")
    .order("name");
  if (error) throw new Error(`Falha ao listar clientes: ${error.message}`);

  const urls = await assinar(
    supabase,
    data.flatMap((c) => (c.avatar_path ? [c.avatar_path] : [])),
  );
  return data.map((c) => ({
    id: c.id,
    nome: c.name,
    instagram: c.instagram_handle,
    avatarUrl: c.avatar_path ? (urls.get(c.avatar_path) ?? null) : null,
    resumo: resumir(c.posts),
  }));
}

export type EventoNoPainel = {
  acao: Decisao;
  comentario: string | null;
  audioUrl: string | null;
  /** Versão do post que o cliente avaliou. */
  versao: number;
  em: string;
};

export type PostNoPainel = {
  id: string;
  legenda: string;
  status: StatusPost;
  agendadoPara: string | null;
  versao: number;
  reenviadoEm: string | null;
  capaUrl: string | null;
  capaTipo: "image" | "video" | null;
  totalMidias: number;
  historico: EventoNoPainel[];
};

export type LinkAtivo = {
  id: string;
  criadoEm: string;
  expiraEm: string;
  ultimoAcesso: string | null;
} | null;

export type DetalheCliente = {
  id: string;
  nome: string;
  instagram: string | null;
  avatarUrl: string | null;
  resumo: Resumo;
  posts: PostNoPainel[];
  link: LinkAtivo;
};

export async function detalharCliente(clienteId: string): Promise<DetalheCliente | null> {
  const supabase = await criarClienteSupabase();
  const { data: cliente, error } = await supabase
    .from("clients")
    .select(
      `id, name, instagram_handle, avatar_path,
       posts(id, caption, status, scheduled_for, created_at, version, resubmitted_at,
         post_slides(position, media_type, storage_path),
         approval_events(action, comment, audio_path, post_version, created_at))`,
    )
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar o cliente: ${error.message}`);
  if (!cliente) return null;

  const { data: links } = await supabase
    .from("approval_links")
    .select("id, created_at, expires_at, last_accessed_at")
    .eq("client_id", clienteId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  const posts = [...cliente.posts].sort(ordemDePublicacao);
  const capas = posts.map((p) => [...p.post_slides].sort((a, b) => a.position - b.position)[0]);
  const urls = await assinar(supabase, [
    ...(cliente.avatar_path ? [cliente.avatar_path] : []),
    ...capas.flatMap((c) => (c ? [c.storage_path] : [])),
    ...posts.flatMap((p) => p.approval_events.flatMap((e) => (e.audio_path ? [e.audio_path] : []))),
  ]);

  const link = links?.[0];
  return {
    id: cliente.id,
    nome: cliente.name,
    instagram: cliente.instagram_handle,
    avatarUrl: cliente.avatar_path ? (urls.get(cliente.avatar_path) ?? null) : null,
    resumo: resumir(posts),
    link: link
      ? {
          id: link.id,
          criadoEm: link.created_at,
          expiraEm: link.expires_at,
          ultimoAcesso: link.last_accessed_at,
        }
      : null,
    posts: posts.map((p, i) => ({
      id: p.id,
      legenda: p.caption,
      status: p.status,
      agendadoPara: p.scheduled_for,
      versao: p.version,
      reenviadoEm: p.resubmitted_at,
      capaUrl: capas[i] ? (urls.get(capas[i].storage_path) ?? null) : null,
      capaTipo: capas[i]?.media_type ?? null,
      totalMidias: p.post_slides.length,
      historico: [...p.approval_events]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((e) => ({
          acao: e.action,
          comentario: e.comment,
          audioUrl: e.audio_path ? (urls.get(e.audio_path) ?? null) : null,
          versao: e.post_version,
          em: e.created_at,
        })),
    })),
  };
}
