import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROTA_ENTRAR, ROTA_PAINEL, rotaProtegida, rotaSoDeslogado } from "@/lib/auth/rotas";
import { envPublico } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Renova a sessão do Supabase a cada requisição e faz o redirecionamento
 * otimista: quem não está logado não entra no painel, e quem está logado
 * não vê as telas de entrar/cadastro. A autorização de verdade é o RLS.
 */
export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = envPublico();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([chave, valor]) =>
            response.headers.set(chave, valor),
          );
        },
      },
    },
  );

  // Não coloque código entre a criação do cliente e getClaims():
  // é aqui que a sessão é validada e renovada.
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!logado && rotaProtegida(pathname)) {
    return redirecionar(request, response, ROTA_ENTRAR, { proximo: `${pathname}${search}` });
  }
  if (logado && rotaSoDeslogado(pathname)) {
    return redirecionar(request, response, ROTA_PAINEL);
  }

  return response;
}

function redirecionar(
  request: NextRequest,
  base: NextResponse,
  destino: string,
  params: Record<string, string> = {},
) {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = new URLSearchParams(params).toString();
  const redirect = NextResponse.redirect(url);
  // Mantém os cookies de sessão renovados no redirecionamento.
  base.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  base.headers.forEach((valor, chave) => {
    if (chave.toLowerCase() !== "location" && chave.toLowerCase() !== "set-cookie") {
      redirect.headers.set(chave, valor);
    }
  });
  return redirect;
}
