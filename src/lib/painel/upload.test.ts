import { describe, expect, it, vi } from "vitest";
import { enviarMidias, paraCampoDataHora } from "./upload";

function storageFalso(falharNo?: number) {
  const upload = vi.fn();
  const remove = vi.fn().mockResolvedValue({ error: null });
  let chamadas = 0;
  upload.mockImplementation(async () => {
    chamadas += 1;
    return { error: chamadas === falharNo ? { message: "falhou" } : null };
  });
  return {
    upload,
    remove,
    cliente: { storage: { from: () => ({ upload, remove }) } } as never,
  };
}

const arquivo = (nome: string, tipo = "image/jpeg") => new File(["x"], nome, { type: tipo });
const pasta = { donoId: "d", clienteId: "c", postId: "p" };

describe("enviarMidias", () => {
  it("envia na ordem, dentro da pasta do post, e informa o progresso", async () => {
    const s = storageFalso();
    const progresso = vi.fn();
    const r = await enviarMidias(
      s.cliente,
      pasta,
      [arquivo("a.jpg"), arquivo("b.mp4", "video/mp4")],
      progresso,
    );
    expect(r.ok).toBe(true);
    const midias = r.ok ? r.midias : [];
    expect(midias.map((m) => m.tipo)).toEqual(["image", "video"]);
    expect(midias[0].caminho).toMatch(/^d\/c\/p\/0-[0-9a-f]{8}\.jpg$/);
    expect(midias[1].caminho).toMatch(/^d\/c\/p\/1-[0-9a-f]{8}\.mp4$/);
    expect(progresso.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("se um arquivo falhar, apaga os que já tinham subido", async () => {
    const s = storageFalso(2);
    const r = await enviarMidias(s.cliente, pasta, [arquivo("a.jpg"), arquivo("b.jpg")]);
    expect(r).toEqual({ ok: false, erro: 'Não foi possível enviar "b.jpg". Tente novamente.' });
    expect(s.remove).toHaveBeenCalledWith([expect.stringMatching(/^d\/c\/p\/0-/)]);
  });
});

describe("paraCampoDataHora", () => {
  it("converte ISO para o formato do campo de data e hora", () => {
    const iso = new Date(2026, 10, 5, 9, 7).toISOString(); // 05/11/2026 09:07 no fuso local
    expect(paraCampoDataHora(iso)).toBe("2026-11-05T09:07");
    expect(paraCampoDataHora(null)).toBe("");
  });
});
