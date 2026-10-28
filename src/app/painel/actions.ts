"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/usuario";
import { envPublico } from "@/lib/env";
import { BUCKET } from "@/lib/painel/constantes";
import {
  criarCliente,
  criarPost,
  editarPost,
  excluirCliente,
  excluirPost,
  gerarLink,
  reagendarPost,
  type EntradaCliente,
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
  // As mídias substituídas não são mais usadas: apaga do storage (RLS: só a pasta do dono).
  if (r.removidos.length > 0) {
    await supabase.storage.from(BUCKET).remove(r.removidos);
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

async function apagarDoStorage(caminhos: string[]) {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove(caminhos);
  if (error) throw new Error(error.message);
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
