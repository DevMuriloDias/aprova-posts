"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth/usuario";
import { envPublico } from "@/lib/env";
import {
  criarCliente,
  criarPost,
  gerarLink,
  type EntradaCliente,
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
  if (r.ok) revalidatePath(`/painel/clientes/${entrada.clienteId}`);
  return r;
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
