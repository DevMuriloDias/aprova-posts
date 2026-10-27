import "server-only";
import { createClient } from "@supabase/supabase-js";
import { envPublico } from "@/lib/env";
import { envServidor } from "@/lib/env-servidor";
import type { Database } from "@/types/database";

/**
 * Cliente com a chave secreta: ignora o RLS. Use APENAS no servidor e apenas
 * para o fluxo do link mágico, sempre via get_approval_page/register_approval,
 * que validam o token, e para assinar URLs das mídias que essas funções retornam.
 */
export function criarClienteAdmin() {
  return createClient<Database>(
    envPublico().NEXT_PUBLIC_SUPABASE_URL,
    envServidor().SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

export type ClienteAdmin = ReturnType<typeof criarClienteAdmin>;
