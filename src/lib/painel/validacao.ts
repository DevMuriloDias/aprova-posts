import { z } from "zod";

export const TIPOS_MIDIA_ACEITOS = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
} as const;

export const TAMANHO_MAXIMO_MIDIA = 100 * 1024 * 1024; // igual ao limite do bucket
export const MAXIMO_MIDIAS_POR_POST = 20;

const pastaDoDono = (dono: string, ...partes: string[]) => `${[dono, ...partes].join("/")}/`;

export function esquemaNovoCliente(donoId: string) {
  return z
    .object({
      id: z.uuid("Cliente inválido."),
      nome: z
        .string()
        .trim()
        .min(1, "Informe o nome do cliente.")
        .max(120, "O nome pode ter no máximo 120 caracteres."),
      instagram: z
        .string()
        .trim()
        .transform((v) => v.replace(/^@/, ""))
        .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), {
          message: "Use só letras, números, ponto e _ (até 30 caracteres).",
        })
        .transform((v) => (v === "" ? null : v)),
      avatarPath: z
        .string()
        .optional()
        .transform((v) => (v ? v : null)),
    })
    .refine((d) => !d.avatarPath || d.avatarPath.startsWith(pastaDoDono(donoId, d.id)), {
      path: ["avatarPath"],
      message: "Foto de perfil inválida.",
    });
}

export function esquemaNovoPost(donoId: string) {
  return z
    .object({
      id: z.uuid(),
      clienteId: z.uuid(),
      legenda: z.string().max(2200, "A legenda pode ter no máximo 2.200 caracteres."),
      agendadoPara: z
        .string()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || !Number.isNaN(Date.parse(v)), {
          message: "Data de publicação inválida.",
        }),
      midias: z
        .array(
          z.object({
            caminho: z.string().min(1),
            tipo: z.enum(["image", "video"]),
          }),
        )
        .min(1, "Adicione pelo menos uma foto ou vídeo.")
        .max(MAXIMO_MIDIAS_POR_POST, `Um post pode ter no máximo ${MAXIMO_MIDIAS_POR_POST} mídias.`),
    })
    .refine(
      (d) => d.midias.every((m) => m.caminho.startsWith(pastaDoDono(donoId, d.clienteId, d.id))),
      { path: ["midias"], message: "Mídia inválida." },
    );
}

/** Edição: mesmas regras do post novo, mas as mídias são opcionais (sem elas, ficam as atuais). */
export function esquemaEdicaoPost(donoId: string) {
  return z
    .object({
      id: z.uuid(),
      clienteId: z.uuid(),
      legenda: z.string().max(2200, "A legenda pode ter no máximo 2.200 caracteres."),
      agendadoPara: z
        .string()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || !Number.isNaN(Date.parse(v)), {
          message: "Data de publicação inválida.",
        }),
      midias: z
        .array(z.object({ caminho: z.string().min(1), tipo: z.enum(["image", "video"]) }))
        .min(1, "Adicione pelo menos uma foto ou vídeo.")
        .max(MAXIMO_MIDIAS_POR_POST, `Um post pode ter no máximo ${MAXIMO_MIDIAS_POR_POST} mídias.`)
        .optional(),
    })
    .refine(
      (d) =>
        !d.midias ||
        d.midias.every((m) => m.caminho.startsWith(pastaDoDono(donoId, d.clienteId, d.id))),
      { path: ["midias"], message: "Mídia inválida." },
    );
}

/** Caminho no bucket: <dono>/<cliente>/<post>/<n>-<aleatório>.<ext> */
export function caminhoDaMidia(
  donoId: string,
  clienteId: string,
  postId: string,
  indice: number,
  nomeArquivo: string,
  aleatorio: string,
): string {
  const ext = (nomeArquivo.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${donoId}/${clienteId}/${postId}/${indice}-${aleatorio}${ext ? `.${ext}` : ""}`;
}

export function caminhoDoAvatar(donoId: string, clienteId: string, nomeArquivo: string, aleatorio: string) {
  const ext = (nomeArquivo.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${donoId}/${clienteId}/avatar-${aleatorio}${ext ? `.${ext}` : ""}`;
}

/** Valida um arquivo antes do upload. Retorna a mensagem de erro, se houver. */
export function problemaNoArquivo(
  arquivo: { type: string; size: number; name: string },
  { apenasImagem = false } = {},
): string | null {
  if (apenasImagem && !arquivo.type.startsWith("image/")) {
    return `"${arquivo.name}" não é uma imagem. Use JPG, PNG ou WEBP.`;
  }
  if (!(arquivo.type in TIPOS_MIDIA_ACEITOS)) {
    return `"${arquivo.name}" não é um formato aceito. Use JPG, PNG, WEBP, MP4 ou MOV.`;
  }
  if (arquivo.size > TAMANHO_MAXIMO_MIDIA) {
    return `"${arquivo.name}" passa de 100 MB.`;
  }
  return null;
}
