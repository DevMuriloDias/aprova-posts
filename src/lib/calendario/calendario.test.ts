import { describe, expect, it } from "vitest";
import {
  agruparPorDia,
  chaveDoDia,
  corDoCliente,
  coresPorCliente,
  diaDaUrl,
  gradeDoMes,
  horaDe,
  intervaloDaGrade,
  mesDaUrl,
  somarMeses,
  textoDoDia,
  textoDoMes,
} from "./calendario";

describe("datas no horário de Brasília", () => {
  it("um post às 23h de Brasília fica no dia certo (e não no dia seguinte em UTC)", () => {
    expect(chaveDoDia("2026-11-06T02:00:00Z")).toBe("2026-11-05");
    expect(horaDe("2026-11-06T02:00:00Z")).toBe("23:00");
    expect(chaveDoDia("2026-11-05T03:00:00Z")).toBe("2026-11-05");
  });

  it("lê o mês da URL ou usa o mês atual", () => {
    expect(mesDaUrl("2026-11")).toEqual({ ano: 2026, mes: 11 });
    const hoje = new Date("2026-10-28T12:00:00Z");
    for (const ruim of [null, "", "2026-13", "abc", "2026-1"]) {
      expect(mesDaUrl(ruim, hoje), String(ruim)).toEqual({ ano: 2026, mes: 10 });
    }
  });

  it("só aceita dias que existem", () => {
    expect(diaDaUrl("2026-11-05")).toBe("2026-11-05");
    expect(diaDaUrl("2026-02-30")).toBeNull();
    expect(diaDaUrl("05/11/2026")).toBeNull();
  });

  it("navega entre meses virando o ano", () => {
    expect(somarMeses({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMeses({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
  });

  it("textos em pt-BR", () => {
    expect(textoDoMes({ ano: 2026, mes: 11 })).toBe("Novembro de 2026");
    expect(textoDoDia("2026-11-05")).toBe("Quinta, 5 de novembro");
  });
});

describe("grade do mês", () => {
  it("começa no domingo e completa as semanas com os dias vizinhos", () => {
    // Novembro de 2026 começa num domingo e tem 30 dias: 5 semanas.
    const nov = gradeDoMes({ ano: 2026, mes: 11 });
    expect(nov).toHaveLength(5);
    expect(nov[0][0]).toEqual({ chave: "2026-11-01", dia: 1, doMes: true });
    expect(nov[4][6]).toEqual({ chave: "2026-12-05", dia: 5, doMes: false });

    // Outubro de 2026 começa numa quinta: a grade começa em 27 de setembro.
    const out = gradeDoMes({ ano: 2026, mes: 10 });
    expect(out[0][0]).toEqual({ chave: "2026-09-27", dia: 27, doMes: false });
    expect(out.flat().filter((d) => d.doMes)).toHaveLength(31);
    expect(out.every((s) => s.length === 7)).toBe(true);
  });

  it("o intervalo da consulta cobre a grade inteira no fuso de Brasília", () => {
    expect(intervaloDaGrade({ ano: 2026, mes: 11 })).toEqual({
      inicio: "2026-11-01T03:00:00.000Z",
      fim: "2026-12-06T03:00:00.000Z",
    });
  });
});

describe("agrupar e colorir", () => {
  it("agrupa por dia em ordem de horário", () => {
    const grupos = agruparPorDia([
      { id: "b", agendadoPara: "2026-11-05T20:00:00Z" },
      { id: "a", agendadoPara: "2026-11-05T12:00:00Z" },
      { id: "c", agendadoPara: "2026-11-06T02:30:00Z" }, // 23:30 do dia 5 em Brasília
      { id: "d", agendadoPara: "2026-11-07T12:00:00Z" },
    ]);
    expect(grupos.get("2026-11-05")?.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(grupos.get("2026-11-07")?.map((p) => p.id)).toEqual(["d"]);
  });

  it("pela ordem, até 8 clientes nunca repetem cor", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `cliente-${i}`);
    const cor = coresPorCliente(ids);
    expect(new Set(ids.map((id) => cor(id).ponto)).size).toBe(8);
    expect(cor("cliente-0")).toBe(cor("cliente-0"));
    expect(cor("fora-da-lista")).toBe(corDoCliente("fora-da-lista"));
  });

  it("cada cliente tem sempre a mesma cor", () => {
    expect(corDoCliente("cliente-1")).toBe(corDoCliente("cliente-1"));
    const cores = new Set(["a1", "b2", "c3", "d4", "e5", "f6"].map((id) => corDoCliente(id).ponto));
    expect(cores.size).toBeGreaterThan(1);
  });
});
