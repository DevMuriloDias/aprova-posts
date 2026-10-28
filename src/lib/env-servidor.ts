import "server-only";
import { z } from "zod";

const esquema = z.object({
  SUPABASE_SECRET_KEY: z
    .string({ error: "SUPABASE_SECRET_KEY não foi definida." })
    .min(1, "SUPABASE_SECRET_KEY não foi definida."),
});

export type EnvServidor = z.infer<typeof esquema>;

/** Variáveis que só existem no servidor. Nunca use com prefixo NEXT_PUBLIC_. */
export function lerEnvServidor(fonte: Record<string, string | undefined>): EnvServidor {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `- ${i.message}`).join("\n");
    throw new Error(
      `Variáveis de ambiente do servidor inválidas. Confira o .env.local:\n${problemas}`,
    );
  }
  return resultado.data;
}

export function envServidor(): EnvServidor {
  return lerEnvServidor({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
}

export const REMETENTE_PADRAO = "Aprova Posts <onboarding@resend.dev>";

/**
 * E-mail de aviso (opcional). Sem RESEND_API_KEY, os avisos ficam só no painel.
 * O remetente padrão do Resend só entrega para o e-mail dono da conta Resend;
 * para outros destinatários, verifique um domínio e defina EMAIL_REMETENTE.
 */
export function lerConfigEmail(fonte: Record<string, string | undefined>) {
  const apiKey = fonte.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, remetente: fonte.EMAIL_REMETENTE?.trim() || REMETENTE_PADRAO };
}

export function configEmail() {
  return lerConfigEmail({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_REMETENTE: process.env.EMAIL_REMETENTE,
  });
}
