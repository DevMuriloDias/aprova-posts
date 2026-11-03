"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/usuario";
import { envPublico } from "@/lib/env";
import { armazenamento } from "@/lib/armazenamento";
import type { DestinoEnvio } from "@/lib/armazenamento/tipos";
import { descartarEnvios, prepararEnvios, type PedidoEnvio } from "@/lib/painel/envio";
import {
  criarCliente,
  criarPost,
  editarCliente,
  editarPost,
  excluirCliente,
  excluirPost,
  gerarLink,
  reagendarPost,
  type EntradaCliente,
  type EntradaEdicaoCliente,
  type EntradaEdicao,
  type EntradaPost,
  type Resultado,
} from "@/lib/painel/servico";
import { criarClienteSupabase } from "@/lib/supabase/server";

// Todas as ações usam a sessão do social media: o RLS garante que ele só
// mexe nos próprios dados, mesmo que alguém forje os argumentos.

export async function acaoCriarCliente(entrada: EntradaCliente) {
  const usuario = await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await criarCliente(entrada, usuario.id, async (linha) =>
    supabase.from("clients").insert(linha),
  );
  if (r.ok) revalidatePath("/painel", "layout");
  return r;
}

export async function acaoEditarCliente(entrada: EntradaEdicaoCliente): Promise<Resultado> {
  const usuario = await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await editarCliente(entrada, usuario.id, {
    fotoAtual: async (id) => {
      const { data } = await supabase.from("clients").select("avatar_path").eq("id", id).maybeSingle();
      return data ? data.avatar_path : undefined;
    },
    atualizar: async (id, linha) => supabase.from("clients").update(linha).eq("id", id),
  });
  if (!r.ok) return r;
  // A foto antiga veio da consulta acima, que passou pelo RLS.
  if (r.removido) {
    await armazenamento()
      .apagar([r.removido])
      .catch((erro) => console.error("[painel] Falha ao apagar a foto antiga:", erro));
  }
  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function acaoCriarPost(entrada: EntradaPost) {
  const usuario = await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await criarPost(entrada, usuario.id, async (args) => supabase.rpc("create_post", args));
  if (r.ok) {
    revalidatePath(`/painel/clientes/${entrada.clienteId}`);
    revalidatePath("/painel/calendario");
  }
  return r;
}

export async function acaoEditarPost(entrada: EntradaEdicao): Promise<Resultado> {
  const usuario = await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await editarPost(entrada, usuario.id, async (args) => supabase.rpc("update_post", args));
  if (!r.ok) return r;
  // As mídias substituídas não são mais usadas. Os caminhos vêm de update_post,
  // que só mexe nos posts de quem está logado.
  if (r.removidos.length > 0) {
    await armazenamento()
      .apagar(r.removidos)
      .catch((erro) => console.error("[painel] Falha ao apagar mídias antigas:", erro));
  }
  revalidatePath(`/painel/clientes/${entrada.clienteId}`);
  revalidatePath("/painel/calendario");
  return { ok: true };
}

export async function acaoGerarLink(
  clienteId: string,
): Promise<Resultado<{ url: string; expiraEm: string }>> {
  await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await gerarLink(clienteId, envPublico().NEXT_PUBLIC_SITE_URL, async (args) =>
    supabase.rpc("create_approval_link", args),
  );
  if (r.ok) revalidatePath(`/painel/clientes/${clienteId}`);
  return r;
}

export async function acaoRevogarLink(linkId: string, clienteId: string): Promise<Resultado> {
  await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase
    .from("approval_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null);
  if (error) return { ok: false, erro: "Não foi possível revogar o link. Tente novamente." };
  revalidatePath(`/painel/clientes/${clienteId}`);
  return { ok: true };
}

/**
 * Marca as Novidades como vistas e devolve o horário da visita anterior,
 * para a tela continuar destacando o que era novo.
 */
export async function acaoMarcarNovidadesVistas(): Promise<string | null> {
  await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const { data: perfil } = await supabase.from("profiles").select("events_seen_at").maybeSingle();
  const { error } = await supabase.rpc("mark_events_seen");
  if (error) return null;
  revalidatePath("/painel", "layout");
  return perfil?.events_seen_at ?? null;
}

// Os caminhos vêm de delete_client/delete_post, que só apagam dados de quem está logado.
async function apagarDoStorage(caminhos: string[]) {
  await armazenamento().apagar(caminhos);
}

export async function acaoExcluirCliente(clienteId: string): Promise<Resultado> {
  await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await excluirCliente(clienteId, async (args) => supabase.rpc("delete_client", args), apagarDoStorage);
  if (!r.ok) return r;
  revalidatePath("/painel", "layout");
  redirect("/painel");
}

export async function acaoExcluirPost(postId: string, clienteId: string): Promise<Resultado> {
  await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await excluirPost(postId, async (args) => supabase.rpc("delete_post", args), apagarDoStorage);
  if (!r.ok) return r;
  revalidatePath(`/painel/clientes/${clienteId}`);
  revalidatePath("/painel/calendario");
  return { ok: true };
}

export async function acaoReagendarPost(postId: string, agendadoPara: string | null): Promise<Resultado> {
  await exigirUsuario();
  const supabase = await criarClienteSupabase();
  const r = await reagendarPost(postId, agendadoPara, async (args) => supabase.rpc("reschedule_post", args));
  if (r.ok) revalidatePath("/painel", "layout");
  return r;
}

/** Prepara o envio das mídias direto do navegador (R2 ou Supabase). */
export async function acaoPrepararEnvio(
  pedido: PedidoEnvio,
): Promise<Resultado<{ destinos: DestinoEnvio[] }>> {
  const usuario = await exigirUsuario();
  return prepararEnvios(pedido, usuario.id, armazenamento());
}

/** Apaga mídias enviadas que não chegaram a ser usadas. */
export async function acaoDescartarEnvios(caminhos: string[]): Promise<Resultado> {
  const usuario = await exigirUsuario();
  return descartarEnvios(caminhos, usuario.id, armazenamento());
}
