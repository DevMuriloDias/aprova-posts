import { describe, expect, it } from "vitest";
import { bitrateAlvo, nomeEmMp4, planoDoVideo, type InfoVideo } from "./plano";

const info = (extra: Partial<InfoVideo> = {}): InfoVideo => ({
  codec: "avc",
  largura: 1080,
  altura: 1920,
  bitrate: 5_000_000,
  fps: 30,
  mp4: true,
  ...extra,
});

describe("planoDoVideo", () => {
  it("vídeo já leve (H.264, 1080p, 30 fps, ~5 Mbps, MP4) fica como está", () => {
    expect(planoDoVideo(info())).toBeNull();
  });

  it("4K do celular em pé vira 1080×1920", () => {
    const p = planoDoVideo(info({ codec: "hevc", largura: 2160, altura: 3840, bitrate: 40_000_000, mp4: false }));
    expect(p).toEqual({ largura: 1080, altura: 1920, fps: undefined, bitrate: bitrateAlvo(1080, 1920, 30) });
    expect(p!.bitrate).toBeGreaterThan(5_000_000);
    expect(p!.bitrate).toBeLessThan(7_000_000);
  });

  it("vídeo deitado: o lado menor fica com 1080", () => {
    expect(planoDoVideo(info({ largura: 3840, altura: 2160 }))).toMatchObject({ largura: 1920, altura: 1080 });
  });

  it("60 fps vira 30 fps", () => {
    expect(planoDoVideo(info({ fps: 59.94 }))).toMatchObject({ fps: 30, largura: 1080, altura: 1920 });
  });

  it("taxa de bits alta demais é reduzida, mesmo em 1080p", () => {
    expect(planoDoVideo(info({ bitrate: 25_000_000 }))).toMatchObject({ largura: 1080, altura: 1920 });
  });

  it("HEVC ou .mov é convertido para H.264 em MP4 (toca em qualquer celular)", () => {
    expect(planoDoVideo(info({ codec: "hevc" }))).not.toBeNull();
    expect(planoDoVideo(info({ mp4: false }))).not.toBeNull();
  });

  it("vídeo pequeno não é ampliado e as medidas ficam pares", () => {
    expect(planoDoVideo(info({ codec: "vp9", largura: 721, altura: 1281 }))).toMatchObject({
      largura: 722,
      altura: 1282,
    });
  });

  it("medidas inválidas: não mexe", () => {
    expect(planoDoVideo(info({ largura: 0, codec: "hevc" }))).toBeNull();
  });
});

describe("nomeEmMp4", () => {
  it.each([
    ["IMG_0001.MOV", "IMG_0001.mp4"],
    ["video.final.mp4", "video.final.mp4"],
    ["sem-extensao", "sem-extensao.mp4"],
    [".mov", "video.mp4"],
  ])("%s → %s", (de, para) => expect(nomeEmMp4(de)).toBe(para));
});
