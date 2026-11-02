import { describe, expect, it, vi } from "vitest";
import { copiarTudo, listarTudo } from "../../scripts/migrar-midias-para-r2.mjs";

type Item = { name: string; id: string | null; metadata?: { size: number; mimetype: string } };

/** Simula o list() do Supabase Storage: pastas têm id null. */
function storageFalso(arvore: Record<string, Item[]>) {
  return vi.fn(async (prefixo: string, { offset }: { offset: number }) => ({
    data: (arvore[prefixo] ?? []).slice(offset, offset + 1000),
    error: null,
  }));
}

const arquivo = (name: string, size = 10, mimetype = "image/jpeg"): Item => ({
  name,
  id: `id-${name}`,
  metadata: { size, mimetype },
});
const pasta = (name: string): Item => ({ name, id: null });

describe("listarTudo", () => {
  it("entra nas pastas e devolve caminho, tamanho e tipo de cada arquivo", async () => {
    const listar = storageFalso({
      "": [pasta("dono")],
      dono: [pasta("cliente")],
      "dono/cliente": [arquivo("avatar.jpg"), pasta("post")],
      "dono/cliente/post": [arquivo("0.mp4", 50, "video/mp4"), pasta("audios")],
      "dono/cliente/post/audios": [arquivo("a.webm", 5, "audio/webm")],
    });
    expect(await listarTudo(listar)).toEqual([
      { caminho: "dono/cliente/avatar.jpg", tamanho: 10, tipo: "image/jpeg" },
      { caminho: "dono/cliente/post/0.mp4", tamanho: 50, tipo: "video/mp4" },
      { caminho: "dono/cliente/post/audios/a.webm", tamanho: 5, tipo: "audio/webm" },
    ]);
  });

  it("pagina quando a pasta tem mais de 1000 itens", async () => {
    const muitos = Array.from({ length: 1500 }, (_, i) => arquivo(`${i}.jpg`));
    const listar = storageFalso({ "": muitos });
    expect(await listarTudo(listar)).toHaveLength(1500);
    expect(listar).toHaveBeenCalledTimes(2);
  });
});

describe("copiarTudo", () => {
  const arquivos = [
    { caminho: "d/a.jpg", tamanho: 10, tipo: "image/jpeg" },
    { caminho: "d/b.mp4", tamanho: 20, tipo: "video/mp4" },
    { caminho: "d/c.jpg", tamanho: 30, tipo: "image/jpeg" },
  ];

  it("pula o que já está no R2 com o mesmo tamanho e copia o resto", async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    const resumo = await copiarTudo({
      arquivos,
      tamanhoNoDestino: async (c: string) => (c === "d/a.jpg" ? 10 : c === "d/c.jpg" ? 5 : null),
      baixar: async (c: string) => new TextEncoder().encode(c).buffer,
      enviar,
    });
    expect(resumo).toEqual({ copiados: 2, pulados: 1, falhas: [] });
    expect(enviar.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ["d/b.mp4", "video/mp4"],
      ["d/c.jpg", "image/jpeg"], // tamanho diferente: copia de novo
    ]);
  });

  it("uma falha não interrompe as outras e fica no resumo", async () => {
    const resumo = await copiarTudo({
      arquivos,
      tamanhoNoDestino: async () => null,
      baixar: async (c: string) => {
        if (c === "d/b.mp4") throw new Error("download falhou");
        return new ArrayBuffer(1);
      },
      enviar: vi.fn().mockResolvedValue(undefined),
    });
    expect(resumo.copiados).toBe(2);
    expect(resumo.falhas).toEqual([{ caminho: "d/b.mp4", erro: "download falhou" }]);
  });
});
