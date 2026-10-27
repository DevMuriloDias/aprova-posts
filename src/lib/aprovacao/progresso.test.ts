import { describe, expect, it } from "vitest";
import { resumir, textoProgresso } from "./progresso";

const s = (...status: Parameters<typeof resumir>[0][number]["status"][]) =>
  status.map((x) => ({ status: x }));

describe("resumir", () => {
  it("conta aprovados, ajustes e pendentes", () => {
    expect(
      resumir(s("approved", "approved", "changes_requested", "pending_approval", "pending_approval", "pending_approval")),
    ).toEqual({ total: 6, aprovados: 2, ajustes: 1, pendentes: 3, percentual: 33 });
  });

  it("ignora rascunhos", () => {
    expect(resumir(s("draft", "approved"))).toMatchObject({ total: 1, aprovados: 1, percentual: 100 });
  });

  it("sem posts dá 0%", () => {
    expect(resumir([])).toEqual({ total: 0, aprovados: 0, ajustes: 0, pendentes: 0, percentual: 0 });
  });
});

describe("textoProgresso", () => {
  it("usa plural e singular corretamente", () => {
    expect(textoProgresso({ aprovados: 2, total: 6 })).toBe("2 de 6 posts aprovados");
    expect(textoProgresso({ aprovados: 0, total: 1 })).toBe("0 de 1 post aprovado");
    expect(textoProgresso({ aprovados: 1, total: 1 })).toBe("1 de 1 post aprovado");
    expect(textoProgresso({ aprovados: 0, total: 0 })).toBe("0 de 0 posts aprovados");
  });
});
