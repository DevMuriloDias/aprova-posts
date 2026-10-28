import { z } from "zod";

const esquema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url({ message: "NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida." })
    // Só o endereço base: o Supabase mostra em algumas telas a URL com /rest/v1/.
    .refine((v) => URL.canParse(v) && new URL(v).pathname.replace(/\/+$/, "") === "", {
      message:
        "NEXT_PUBLIC_SUPABASE_URL deve ser só o endereço base, sem nada depois do domínio (ex.: https://abc123.supabase.co, sem /rest/v1).",
    }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não foi definida."),
  NEXT_PUBLIC_SITE_URL: z.url({
    message: "NEXT_PUBLIC_SITE_URL precisa ser uma URL válida.",
  }),
});

export type EnvPublico = z.infer<typeof esquema>;

/** Valida as variáveis de ambiente públicas. Recebe o objeto para facilitar os testes. */
export function lerEnvPublico(fonte: Record<string, string | undefined>): EnvPublico {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `- ${i.message}`).join("\n");
    throw new Error(
      `Variáveis de ambiente inválidas. Copie .env.example para .env.local e preencha:\n${problemas}`,
    );
  }
  return resultado.data;
}

let cache: EnvPublico | undefined;

export function envPublico(): EnvPublico {
  // As variáveis NEXT_PUBLIC_* precisam ser lidas de forma literal para o
  // Next.js conseguir embuti-las no bundle do navegador.
  cache ??= lerEnvPublico({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return cache;
}
