import "server-only";

export type ConfigR2 = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const VARIAVEIS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

/**
 * Lê a configuração do Cloudflare R2. Sem nenhuma variável, devolve null e o
 * app usa o Supabase Storage. Com só algumas, avisa o que falta (meio
 * configurado é quase sempre um erro de digitação).
 */
export function lerConfigR2(fonte: Record<string, string | undefined>): ConfigR2 | null {
  const valores = VARIAVEIS.map((v) => fonte[v]?.trim() ?? "");
  if (valores.every((v) => v === "")) return null;
  const faltando = VARIAVEIS.filter((_, i) => valores[i] === "");
  if (faltando.length > 0) {
    throw new Error(
      `Configuração do Cloudflare R2 incompleta. Defina também: ${faltando.join(", ")} (ou apague todas as R2_* para usar o Supabase).`,
    );
  }
  const [accountId, accessKeyId, secretAccessKey, bucket] = valores;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function configR2(): ConfigR2 | null {
  return lerConfigR2({
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
  });
}
