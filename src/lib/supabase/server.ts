import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { envPublico } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente do Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do usuário (cookies), então todas as consultas passam pelo RLS.
 * Crie um novo cliente a cada requisição.
 */
export async function criarClienteSupabase() {
  const cookieStore = await cookies();
  const env = envPublico();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components não podem gravar cookies. O proxy já
            // renova a sessão, então pode ignorar com segurança.
          }
        },
      },
    },
  );
}
