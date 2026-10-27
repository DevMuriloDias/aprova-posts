import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { caminhoSeguro, ROTA_ENTRAR } from "@/lib/auth/rotas";
import { criarClienteSupabase } from "@/lib/supabase/server";

const TIPOS_ACEITOS: EmailOtpType[] = ["signup", "email", "recovery", "invite", "email_change"];

/**
 * Destino do link de confirmação enviado por e-mail no cadastro.
 * Aceita o formato com token_hash (recomendado, funciona em outro dispositivo)
 * e o formato com code (PKCE, padrão do Supabase).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const destino = caminhoSeguro(searchParams.get("proximo"));
  const supabase = await criarClienteSupabase();

  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let ok = false;
  if (tokenHash && tipo && TIPOS_ACEITOS.includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const url = new URL(ok ? destino : `${ROTA_ENTRAR}?erro=link-invalido`, request.nextUrl.origin);
  return NextResponse.redirect(url);
}
