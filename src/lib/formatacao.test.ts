import { describe, expect, it } from "vitest";
import { formatarData, formatarDataCurta, formatarDataHora } from "./formatacao";

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
});
