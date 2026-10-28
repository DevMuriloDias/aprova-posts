import "server-only";
import { BUCKET_MIDIAS } from "@/lib/aprovacao/dependencias";
import { resumir, type Resumo } from "@/lib/aprovacao/progresso";
import type { Decisao, StatusPost } from "@/lib/aprovacao/tipos";
import { criarClienteSupabase } from "@/lib/supabase/server";
import { LIMITE_NOVIDADES, mapearNovidades, type LinhaNovidade } from "./novidades";
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

// ---------------------------------------------------------------------------
// Novidades (respostas dos clientes)
// ---------------------------------------------------------------------------

/** Quando o social media viu as Novidades pela última vez. */
async function vistoEm(supabase: Supabase): Promise<string> {
  const { data } = await supabase.from("profiles").select("events_seen_at").maybeSingle();
  return data?.events_seen_at ?? new Date().toISOString();
}

export async function contarNovidades(): Promise<number> {
  const supabase = await criarClienteSupabase();
  const desde = await vistoEm(supabase);
  const { count } = await supabase
    .from("approval_events")
    .select("id", { count: "exact", head: true })
    .gt("created_at", desde);
  return count ?? 0;
}

export async function listarNovidades(desdeDaUrl: string | null) {
  const supabase = await criarClienteSupabase();
  const visto = desdeDaUrl ?? (await vistoEm(supabase));
  const { data, error } = await supabase
    .from("approval_events")
    .select(
      "id, action, comment, audio_path, post_version, created_at, posts(id, caption, client_id, clients(name))",
    )
    .order("created_at", { ascending: false })
    .limit(LIMITE_NOVIDADES);
  if (error) throw new Error(`Falha ao carregar as novidades: ${error.message}`);

  const linhas = data as unknown as LinhaNovidade[];
  const urls = await assinar(
    supabase,
    linhas.flatMap((l) => (l.audio_path ? [l.audio_path] : [])),
  );
  return { vistoEm: visto, itens: mapearNovidades(linhas, visto, urls) };
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export type PostNoCalendario = {
  id: string;
  clienteId: string;
  clienteNome: string;
  legenda: string;
  status: StatusPost;
  agendadoPara: string | null;
  capaUrl: string | null;
  capaTipo: "image" | "video" | null;
  totalMidias: number;
};

type LinhaCalendario = {
  id: string;
  caption: string;
  status: StatusPost;
  scheduled_for: string | null;
  client_id: string;
  clients: { name: string } | null;
  post_slides: { position: number; media_type: "image" | "video"; storage_path: string }[];
};

const COLUNAS_CALENDARIO =
  "id, caption, status, scheduled_for, client_id, clients(name), post_slides(position, media_type, storage_path)";

/** Posts com data dentro de [inicio, fim), os sem data e a lista de clientes. */
export async function listarCalendario(filtro: {
  inicio: string;
  fim: string;
  clienteId: string | null;
}) {
  const supabase = await criarClienteSupabase();

  let agendados = supabase
    .from("posts")
    .select(COLUNAS_CALENDARIO)
    .gte("scheduled_for", filtro.inicio)
    .lt("scheduled_for", filtro.fim)
    .order("scheduled_for");
  let semData = supabase
    .from("posts")
    .select(COLUNAS_CALENDARIO)
    .is("scheduled_for", null)
    .order("created_at");
  if (filtro.clienteId) {
    agendados = agendados.eq("client_id", filtro.clienteId);
    semData = semData.eq("client_id", filtro.clienteId);
  }

  const [rAgendados, rSemData, rClientes] = await Promise.all([
    agendados,
    semData,
    supabase.from("clients").select("id, name").order("name"),
  ]);
  for (const r of [rAgendados, rSemData, rClientes]) {
    if (r.error) throw new Error(`Falha ao carregar o calendário: ${r.error.message}`);
  }

  const linhas = [
    ...((rAgendados.data ?? []) as unknown as LinhaCalendario[]),
    ...((rSemData.data ?? []) as unknown as LinhaCalendario[]),
  ];
  const capas = new Map(
    linhas.map((l) => [l.id, [...l.post_slides].sort((a, b) => a.position - b.position)[0]]),
  );
  const urls = await assinar(
    supabase,
    [...capas.values()].flatMap((c) => (c ? [c.storage_path] : [])),
  );

  const mapear = (l: LinhaCalendario): PostNoCalendario => {
    const capa = capas.get(l.id);
    return {
      id: l.id,
      clienteId: l.client_id,
      clienteNome: l.clients?.name ?? "Cliente",
      legenda: l.caption,
      status: l.status,
      agendadoPara: l.scheduled_for,
      capaUrl: capa ? (urls.get(capa.storage_path) ?? null) : null,
      capaTipo: capa?.media_type ?? null,
      totalMidias: l.post_slides.length,
    };
  };

  return {
    clientes: (rClientes.data ?? []).map((c) => ({ id: c.id, nome: c.name })),
    agendados: ((rAgendados.data ?? []) as unknown as LinhaCalendario[]).map(mapear),
    semData: ((rSemData.data ?? []) as unknown as LinhaCalendario[]).map(mapear),
  };
}
