import { describe, expect, it, vi } from "vitest";
import type { DestinoEnvio } from "@/lib/armazenamento/tipos";
import { enviarMidias, paraCampoDataHora, textoDoProgresso, type DependenciasEnvio } from "./upload";

const arquivo = (nome: string, tipo = "image/jpeg") => new File(["xx"], nome, { type: tipo });
const alvo = { destino: "post" as const, clienteId: "c", postId: "p" };

function deps(extra: Partial<DependenciasEnvio> = {}) {
  const base = {
    preparar: vi.fn(async (pedido: { arquivos: { nome: string }[] }) => ({
      ok: true as const,
      destinos: pedido.arquivos.map(
        (a, i): DestinoEnvio => ({ modo: "r2", caminho: `d/c/p/${i}-${a.nome}`, url: `https://r2/${i}`, headers: {} }),
      ),
    })),
    enviarArquivo: vi.fn(async (_d: DestinoEnvio, _a: File, progresso: (f: number) => void) => {
      progresso(0.5);
      progresso(1);
      return true;
    }),
    descartar: vi.fn().mockResolvedValue({ ok: true }),
  };
  return { ...base, ...extra } as typeof base;
}

describe("enviarMidias", () => {
  it("pede os destinos ao servidor com nome, tipo e tamanho, e envia na ordem", async () => {
    const d = deps();
    const progresso = vi.fn();
    const r = await enviarMidias(alvo, [arquivo("a.jpg"), arquivo("b.mp4", "video/mp4")], d, progresso);

    expect(d.preparar).toHaveBeenCalledWith({
      ...alvo,
      arquivos: [
        { nome: "a.jpg", tipo: "image/jpeg", tamanho: 2 },
        { nome: "b.mp4", tipo: "video/mp4", tamanho: 2 },
      ],
    });
    expect(r).toEqual({
      ok: true,
      midias: [
        { caminho: "d/c/p/0-a.jpg", tipo: "image" },
        { caminho: "d/c/p/1-b.mp4", tipo: "video" },
      ],
    });
    expect(progresso).toHaveBeenCalledWith(2, 2, 0.5);
  });

  it("se o servidor recusar (ex.: arquivo grande), não envia nada", async () => {
    const d = deps({ preparar: vi.fn().mockResolvedValue({ ok: false, erro: '"v.mov" passa de 50 MB.' }) });
    expect(await enviarMidias(alvo, [arquivo("v.mov", "video/quicktime")], d)).toEqual({
      ok: false,
      erro: '"v.mov" passa de 50 MB.',
    });
    expect(d.enviarArquivo).not.toHaveBeenCalled();
  });

  it("se um envio falhar, descarta os que já tinham subido", async () => {
    const d = deps({ enviarArquivo: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) });
    const r = await enviarMidias(alvo, [arquivo("a.jpg"), arquivo("b.jpg")], d);
    expect(r).toEqual({ ok: false, erro: 'Não foi possível enviar "b.jpg". Confira a conexão e tente de novo.' });
    expect(d.descartar).toHaveBeenCalledWith(["d/c/p/0-a.jpg"]);
  });

  it("erro de rede no envio também é tratado como falha", async () => {
    const d = deps({ enviarArquivo: vi.fn().mockRejectedValue(new Error("rede")) });
    expect((await enviarMidias(alvo, [arquivo("a.jpg")], d)).ok).toBe(false);
  });
});

describe("textos e datas", () => {
  it("mostra o progresso com porcentagem", () => {
    expect(textoDoProgresso(1, 3, 0)).toBe("Enviando 1 de 3…");
    expect(textoDoProgresso(1, 3, 0.456)).toBe("Enviando 1 de 3… 46%");
    expect(textoDoProgresso(1, 1, 0.5)).toBe("Enviando… 50%");
  });

  it("converte ISO para o formato do campo de data e hora", () => {
    const iso = new Date(2026, 10, 5, 9, 7).toISOString(); // 05/11/2026 09:07 no fuso local
    expect(paraCampoDataHora(iso)).toBe("2026-11-05T09:07");
    expect(paraCampoDataHora(null)).toBe("");
  });
});
