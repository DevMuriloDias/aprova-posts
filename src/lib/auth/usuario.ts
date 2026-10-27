import "server-only";
import { redirect } from "next/navigation";
import { ROTA_ENTRAR } from "@/lib/auth/rotas";
import { criarClienteSupabase } from "@/lib/supabase/server";

export type UsuarioAtual = { id: string; email: string; nome: string };

/**
 * Retorna o social media logado ou redireciona para /entrar.
 * Use sempre dentro de um <Suspense>, pois lê os cookies da requisição.
 */
export async function exigirUsuario(): Promise<UsuarioAtual> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    redirect(ROTA_ENTRAR);
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: claims.email ?? "",
    nome: perfil?.full_name ?? "",
  };
}
