// Constantes compartilhadas entre servidor e navegador (sem dependências de servidor).

export const LIMITE_COMENTARIO = 2000;

/** Duração máxima da gravação no navegador. */
export const LIMITE_AUDIO_SEGUNDOS = 3 * 60;

/**
 * Tamanho máximo do arquivo de áudio. Fica abaixo do limite de corpo das
 * Server Actions (next.config.ts) e do limite de 4,5 MB da Vercel.
 */
export const TAMANHO_MAXIMO_AUDIO = 4 * 1024 * 1024;

/** Formatos gravados pelos navegadores (Chrome/Firefox: webm/ogg; Safari: mp4) → extensão. */
export const TIPOS_AUDIO = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
} as const;

export type TipoAudio = keyof typeof TIPOS_AUDIO;

/** "audio/webm;codecs=opus" → "audio/webm" */
export function tipoBaseDoAudio(tipo: string): string {
  return tipo.split(";")[0].trim().toLowerCase();
}

export function tipoDeAudioAceito(tipo: string): tipo is TipoAudio {
  return tipoBaseDoAudio(tipo) in TIPOS_AUDIO;
}
