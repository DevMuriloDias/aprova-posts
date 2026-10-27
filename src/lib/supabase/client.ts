import { createBrowserClient } from "@supabase/ssr";
import { envPublico } from "@/lib/env";
import type { Database } from "@/types/database";

/** Cliente do Supabase no navegador (usa a sessão do social media; passa pelo RLS). */
export function criarClienteNavegador() {
  const env = envPublico();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
