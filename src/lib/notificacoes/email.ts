import { z } from "zod";

/** Formato do JSON de public.get_event_notification. */
export const esquemaInfoAviso = z.object({
  email: z.string().nullable(),
  owner_name: z.string(),
  client_id: z.string(),
  client_name: z.string(),
  post_id: z.string(),
  caption: z.string(),
  action: z.enum(["approved", "changes_requested"]),
  comment: z.string().nullable(),
  has_audio: z.boolean(),
  remaining: z.number(),
  total: z.number(),
});

export type InfoAviso = z.infer<typeof esquemaInfoAviso>;

export type EmailAviso = { para: string; assunto: string; html: string; texto: string };

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resumir(texto: string, limite = 80): string {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > limite ? `${t.slice(0, limite - 1).trimEnd()}…` : t;
}

/**
 * Monta o e-mail para o social media, ou null quando não vale avisar.
 * Avisa em todo pedido de ajuste e quando o cliente aprova o último post
 * pendente; aprovações no meio do caminho só aparecem nas Novidades do painel.
 */
export function montarEmailDecisao(info: InfoAviso, siteUrl: string): EmailAviso | null {
  if (!info.email) return null;
  const tudoAprovado = info.action === "approved" && info.remaining === 0;
  if (info.action === "approved" && !tudoAprovado) return null;

  const link = new URL(`/painel/clientes/${info.client_id}`, siteUrl).toString();
  const cliente = info.client_name;
  const primeiroNome = info.owner_name.split(" ")[0];
  const saudacao = primeiroNome ? `Oi, ${primeiroNome}!` : "Oi!";
  const legenda = info.caption ? `“${resumir(info.caption)}”` : "sem legenda";

  let assunto: string;
  let linhas: string[];
  if (tudoAprovado) {
    assunto = `${cliente} aprovou todos os posts`;
    linhas = [
      info.total === 1
        ? `${cliente} aprovou o post que estava aguardando.`
        : `${cliente} aprovou os ${info.total} posts. Está tudo pronto para publicar.`,
    ];
  } else {
    assunto = `${cliente} pediu ajuste em um post`;
    linhas = [`${cliente} pediu ajuste no post ${legenda}.`];
    if (info.comment) linhas.push(`Comentário: “${info.comment}”`);
    if (info.has_audio) linhas.push("O cliente também enviou um áudio. Ouça no painel.");
  }

  const texto = [saudacao, "", ...linhas, "", `Ver no painel: ${link}`, "", "Aprova Posts"].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px">
      <p style="margin:0 0 16px;font-size:16px">${escaparHtml(saudacao)}</p>
      ${linhas.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escaparHtml(l)}</p>`).join("\n      ")}
      <p style="margin:24px 0 0">
        <a href="${escaparHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Ver no painel</a>
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#71717a">Aprova Posts</p>
    </div>
  </body>
</html>`;

  return { para: info.email, assunto, html, texto };
}

export type ConfigEmail = { apiKey: string; remetente: string };

/** Envia pelo Resend (https://resend.com). Retorna se deu certo. */
export async function enviarPeloResend(
  config: ConfigEmail,
  email: EmailAviso,
  buscar: typeof fetch = fetch,
): Promise<boolean> {
  const resposta = await buscar("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.remetente,
      to: [email.para],
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    }),
  });
  if (!resposta.ok) {
    console.error("[avisos] O Resend recusou o e-mail:", resposta.status, await resposta.text());
  }
  return resposta.ok;
}

export type DependenciasAviso = {
  buscarInfo: (eventoId: string) => Promise<unknown>;
  enviar: ((email: EmailAviso) => Promise<boolean>) | null;
  siteUrl: string;
};

export type ResultadoAviso = "desligado" | "sem_aviso" | "enviado" | "falhou";

/** Avisa o social media sobre uma resposta do cliente. Nunca lança erro. */
export async function notificarDecisao(
  eventoId: string,
  deps: DependenciasAviso,
): Promise<ResultadoAviso> {
  if (!deps.enviar) return "desligado";
  try {
    const info = esquemaInfoAviso.parse(await deps.buscarInfo(eventoId));
    const email = montarEmailDecisao(info, deps.siteUrl);
    if (!email) return "sem_aviso";
    return (await deps.enviar(email)) ? "enviado" : "falhou";
  } catch (erro) {
    console.error("[avisos] Falha ao avisar o social media:", erro);
    return "falhou";
  }
}
