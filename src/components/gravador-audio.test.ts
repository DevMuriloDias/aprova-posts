import { describe, expect, it } from "vitest";
import { formatarDuracao } from "./gravador-audio";
import { tipoBaseDoAudio, tipoDeAudioAceito } from "@/lib/aprovacao/limites";

describe("gravador de áudio", () => {
  it("formata a duração como m:ss", () => {
    expect(formatarDuracao(0)).toBe("0:00");
    expect(formatarDuracao(9.8)).toBe("0:09");
    expect(formatarDuracao(65)).toBe("1:05");
    expect(formatarDuracao(180)).toBe("3:00");
  });

  it("reconhece os formatos gravados pelos navegadores", () => {
    expect(tipoBaseDoAudio("audio/webm;codecs=opus")).toBe("audio/webm");
    for (const tipo of ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg; codecs=opus"]) {
      expect(tipoDeAudioAceito(tipo), tipo).toBe(true);
    }
    for (const tipo of ["audio/wav", "video/mp4", "text/html", ""]) {
      expect(tipoDeAudioAceito(tipo), tipo).toBe(false);
    }
  });
});
