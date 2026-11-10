// Decide se um vídeo precisa ser convertido para tocar liso no celular do cliente.
// Vídeos gravados no celular costumam vir em 4K, 60 fps, HEVC e 20–50 Mbps: pesados
// demais para baixar enquanto tocam numa rede móvel (o vídeo congela para carregar).
// O alvo é parecido com o que o Instagram entrega: H.264, até 1080p, 30 fps, ~6 Mbps.

/** O lado menor fica com até 1080 px (1080×1920 em pé, 1920×1080 deitado). */
export const LADO_MENOR_MAXIMO = 1080;
export const FPS_MAXIMO = 30;
/** Bits por pixel por quadro: 1080×1920 a 30 fps dá ~6,2 Mbps. */
const BITS_POR_PIXEL = 0.1;
const BITRATE_MINIMO = 1_500_000;
/** Folga antes de reconverter um vídeo que já está bom. */
const FOLGA = 1.5;

export type InfoVideo = {
  /** Codec de vídeo ("avc" = H.264, "hevc", "vp9"…). */
  codec: string | null;
  /** Dimensões como o vídeo aparece (já considerando a rotação). */
  largura: number;
  altura: number;
  /** Bits por segundo do vídeo (média). */
  bitrate: number;
  /** Quadros por segundo (média). */
  fps: number;
  /** O arquivo já é MP4 (o .mov do iPhone não é). */
  mp4: boolean;
};

export type PlanoVideo = { largura: number; altura: number; fps: number | undefined; bitrate: number };

const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export function bitrateAlvo(largura: number, altura: number, fps: number): number {
  return Math.max(BITRATE_MINIMO, Math.round(largura * altura * Math.min(fps || FPS_MAXIMO, FPS_MAXIMO) * BITS_POR_PIXEL));
}

/** `null` quando o vídeo já serve como está. */
export function planoDoVideo(info: InfoVideo): PlanoVideo | null {
  const menor = Math.min(info.largura, info.altura);
  if (!(menor > 0)) return null;

  const escala = Math.min(1, LADO_MENOR_MAXIMO / menor);
  const largura = par(info.largura * escala);
  const altura = par(info.altura * escala);
  const fps = info.fps > FPS_MAXIMO + 1 ? FPS_MAXIMO : undefined;
  const bitrate = bitrateAlvo(largura, altura, fps ?? info.fps);

  const jaServe =
    info.codec === "avc" &&
    info.mp4 &&
    escala === 1 &&
    fps === undefined &&
    info.bitrate > 0 &&
    info.bitrate <= bitrate * FOLGA;
  return jaServe ? null : { largura, altura, fps, bitrate };
}

/** "video.mov" → "video.mp4" */
export function nomeEmMp4(nome: string): string {
  const base = nome.replace(/\.[^./\\]+$/, "");
  return `${base || "video"}.mp4`;
}
