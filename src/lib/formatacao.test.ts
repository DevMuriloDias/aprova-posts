import { describe, expect, it } from "vitest";
import {
  formatarData,
  formatarDataCurta,
  formatarDataHora,
  formatarPostagem,
  formatarPostagemCurta,
} from "./formatacao";

describe("formatação de datas (horário de Brasília)", () => {
  it("data e hora", () => {
    expect(formatarDataHora("2026-10-27T17:32:00Z")).toBe("27/10/2026 às 14:32");
  });

  it("considera o fuso na virada do dia", () => {
    expect(formatarDataHora("2026-10-28T02:10:00Z")).toBe("27/10/2026 às 23:10");
    expect(formatarData("2026-10-28T02:10:00Z")).toBe("27/10/2026");
  });

  it("data curta", () => {
    expect(formatarDataCurta("2026-11-05T15:00:00Z")).toMatch(/^05 de nov/);
  });

  it("data e horário de postagem, com dia da semana", () => {
    expect(formatarPostagem("2026-11-05T15:00:00Z")).toBe("quinta, 05/11 às 12:00");
    expect(formatarPostagem("2026-11-09T13:30:00Z")).toBe("segunda, 09/11 às 10:30");
    expect(formatarPostagem("2026-11-08T22:00:00Z")).toBe("domingo, 08/11 às 19:00");
  });

  it("postagem na virada do dia (horário de Brasília)", () => {
    expect(formatarPostagem("2026-11-10T02:15:00Z")).toBe("segunda, 09/11 às 23:15");
    expect(formatarPostagemCurta("2026-11-10T02:15:00Z")).toBe("09/11 · 23:15");
  });
});
