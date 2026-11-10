// Conversão no navegador (WebCodecs, via mediabunny). Só roda no navegador:
// a biblioteca é carregada sob demanda, quando há vídeo para enviar.

import { nomeEmMp4, planoDoVideo } from "./plano";

/**
 * Devolve uma versão leve do vídeo (MP4 H.264, até 1080p/30 fps), pronta para tocar
 * no celular. Se o vídeo já estiver bom, ou se o navegador não conseguir converter,
 * devolve o próprio arquivo: o envio nunca falha por causa disto.
 */
export async function otimizarVideo(arquivo: File, aoProgredir?: (fracao: number) => void): Promise<File> {
  if (typeof window === "undefined" || typeof VideoEncoder === "undefined") return arquivo;
  try {
    const mb = await import("mediabunny");
    const input = new mb.Input({ source: new mb.BlobSource(arquivo), formats: mb.ALL_FORMATS });
    const trilha = await input.getPrimaryVideoTrack();
    if (!trilha) return arquivo;

    const [formato, stats] = await Promise.all([input.getFormat(), trilha.computePacketStats(120)]);
    const plano = planoDoVideo({
      codec: trilha.codec,
      largura: trilha.displayWidth,
      altura: trilha.displayHeight,
      bitrate: stats.averageBitrate,
      fps: stats.averagePacketRate,
      mp4: formato === mb.MP4,
    });
    if (!plano) return arquivo;

    const podeCodificar = await mb.canEncodeVideo("avc", {
      width: plano.largura,
      height: plano.altura,
      bitrate: plano.bitrate,
    });
    if (!podeCodificar) return arquivo;

    const saida = new mb.Output({
      // fastStart: o índice vai no começo, e o vídeo começa a tocar antes de baixar tudo.
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const conversao = await mb.Conversion.init({
      input,
      output: saida,
      tracks: "primary",
      video: {
        codec: "avc",
        width: plano.largura,
        height: plano.altura,
        fit: "contain",
        frameRate: plano.fps,
        bitrate: plano.bitrate,
        // Um quadro-chave por segundo: avançar e retomar o vídeo fica mais rápido.
        keyFrameInterval: 1,
      },
      // Áudio AAC (o do celular normalmente já é, e só é copiado).
      audio: { codec: "aac" },
      showWarnings: false,
    });
    // Se o navegador não consegue gerar o áudio (ou o vídeo), não arriscamos perder nada.
    if (!conversao.isValid || conversao.discardedTracks.length > 0) return arquivo;

    conversao.onProgress = (fracao) => aoProgredir?.(fracao);
    await conversao.execute();
    const buffer = saida.target.buffer;
    // Não troca por um arquivo maior que o original.
    if (!buffer || buffer.byteLength >= arquivo.size) return arquivo;
    return new File([buffer], nomeEmMp4(arquivo.name), { type: "video/mp4" });
  } catch (erro) {
    console.warn("[video] Não foi possível otimizar; enviando o original.", erro);
    return arquivo;
  }
}
