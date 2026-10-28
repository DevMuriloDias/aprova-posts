import { z } from "zod";
import { hashDoToken, tokenTemFormatoValido } from "@/lib/links/token";
import {
  LIMITE_COMENTARIO,
  TAMANHO_MAXIMO_AUDIO,
  TIPOS_AUDIO,
  tipoBaseDoAudio,
  tipoDeAudioAceito,
} from "./limites";
import type { Decisao, ResultadoDecisao } from "./tipos";

export const MENSAGENS = {
  linkInvalido: "Este link não está mais ativo. Peça um novo link a quem enviou os posts.",
  postInvalido: "Este post não está mais disponível para aprovação.",
  semComentario: "Escreva o que precisa ajustar ou grave um áudio.",
  comentarioLongo: `O comentário pode ter no máximo ${LIMITE_COMENTARIO} caracteres.`,
  audioFormato: "Não foi possível ler o áudio. Grave de novo.",
  audioGrande: "O áudio ficou grande demais. Grave um áudio mais curto.",
  audioFalhou: "Não foi possível enviar o áudio. Tente de novo.",
  generico: "Não foi possível registrar sua resposta. Tente novamente.",
} as const;

const esquemaDecisao = z
  .object({
    postId: z.uuid(),
    acao: z.enum(["approved", "changes_requested"]),
    comentario: z
      .string()
      .trim()
      .max(LIMITE_COMENTARIO, MENSAGENS.comentarioLongo)
      .optional()
      .transform((v) => (v ? v : undefined)),
  });

/** Áudio recebido do navegador (um File/Blob). */
export type AudioRecebido = { type: string; size: number };

export type EntradaDecisao<A extends AudioRecebido = AudioRecebido> = {
  token: string;
  postId: string;
  acao: string;
  comentario?: string;
  audio?: A | null;
};

export type EventoRegistrado = {
  action: Decisao;
  comment: string | null;
  audio_path: string | null;
  post_version: number;
  created_at: string;
};

export type DependenciasDecisao<A extends AudioRecebido = AudioRecebido> = {
  /** Valida link + post e devolve a pasta do áudio (get_audio_upload_folder). */
  pastaDoAudio: (tokenHash: string, postId: string) => Promise<{ ok: true; pasta: string } | { ok: false; mensagem: string }>;
  enviarAudio: (caminho: string, audio: A, tipo: string) => Promise<boolean>;
  removerAudio: (caminho: string) => Promise<void>;
  registrar: (args: {
    tokenHash: string;
    postId: string;
    acao: Decisao;
    comentario: string | null;
    audioPath: string | null;
  }) => Promise<{ ok: true; evento: EventoRegistrado } | { ok: false; mensagem: string }>;
  assinar: (caminho: string) => Promise<string | null>;
  idAleatorio?: () => string;
};

function traduzirErroBanco(mensagem: string): string {
  if (mensagem.includes("link_invalido")) return MENSAGENS.linkInvalido;
  if (mensagem.includes("post_invalido")) return MENSAGENS.postInvalido;
  if (mensagem.includes("audio_invalido")) return MENSAGENS.audioFalhou;
  return MENSAGENS.generico;
}

/** Problema com o áudio, se houver. */
export function problemaNoAudio(audio: AudioRecebido): string | null {
  if (!tipoDeAudioAceito(audio.type) || audio.size === 0) return MENSAGENS.audioFormato;
  if (audio.size > TAMANHO_MAXIMO_AUDIO) return MENSAGENS.audioGrande;
  return null;
}

export async function registrarDecisao<A extends AudioRecebido>(
  entrada: EntradaDecisao<A>,
  deps: DependenciasDecisao<A>,
): Promise<ResultadoDecisao> {
  if (!tokenTemFormatoValido(entrada.token)) {
    return { ok: false, erro: MENSAGENS.linkInvalido };
  }

  const dados = esquemaDecisao.safeParse(entrada);
  if (!dados.success) {
    const mensagem = dados.error.issues[0]?.message;
    const conhecida = Object.values(MENSAGENS).find((m) => m === mensagem);
    return { ok: false, erro: conhecida ?? MENSAGENS.postInvalido };
  }
  const { postId, acao, comentario } = dados.data;

  // O áudio só faz sentido no pedido de ajuste.
  const audio = acao === "changes_requested" && entrada.audio ? entrada.audio : null;
  if (acao === "changes_requested" && !comentario && !audio) {
    return { ok: false, erro: MENSAGENS.semComentario };
  }
  if (audio) {
    const problema = problemaNoAudio(audio);
    if (problema) return { ok: false, erro: problema };
  }

  const tokenHash = hashDoToken(entrada.token);
  let audioPath: string | null = null;

  if (audio) {
    // O banco valida o link e o post antes de qualquer upload.
    const pasta = await deps.pastaDoAudio(tokenHash, postId);
    if (!pasta.ok) return { ok: false, erro: traduzirErroBanco(pasta.mensagem) };

    const tipo = tipoBaseDoAudio(audio.type) as keyof typeof TIPOS_AUDIO;
    const id = (deps.idAleatorio ?? (() => crypto.randomUUID()))();
    audioPath = `${pasta.pasta}${id}.${TIPOS_AUDIO[tipo]}`;
    if (!(await deps.enviarAudio(audioPath, audio, tipo))) {
      return { ok: false, erro: MENSAGENS.audioFalhou };
    }
  }

  const r = await deps.registrar({
    tokenHash,
    postId,
    acao,
    comentario: comentario ?? null,
    audioPath,
  });

  if (!r.ok) {
    if (audioPath) await deps.removerAudio(audioPath);
    return { ok: false, erro: traduzirErroBanco(r.mensagem) };
  }

  return {
    ok: true,
    status: r.evento.action,
    decisao: {
      acao: r.evento.action,
      comentario: r.evento.comment,
      audioUrl: r.evento.audio_path ? await deps.assinar(r.evento.audio_path) : null,
      versao: r.evento.post_version,
      em: r.evento.created_at,
    },
  };
}
