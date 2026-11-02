import { describe, expect, it, vi } from "vitest";
import { LIMITE_R2, LIMITE_SUPABASE } from "@/lib/armazenamento/limites";
import { descartarEnvios, prepararEnvios } from "./envio";

const DONO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENTE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const POST = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MB = 1024 * 1024;

function arm(limiteBytes = LIMITE_SUPABASE) {
  return {
    limiteBytes,
    prepararEnvio: vi.fn(async (caminho: string, tipo: string) => ({
      modo: "r2" as const,
      caminho,
      url: `https://r2/${caminho}?assinado`,
      headers: { "content-type": tipo },
    })),
  };
}

const foto = { nome: "Foto 1.JPG", tipo: "image/jpeg", tamanho: 2 * MB };
const video = { nome: "reels.mov", tipo: "video/quicktime", tamanho: 80 * MB };

describe("prepararEnvios", () => {
  it("gera caminhos na pasta do dono, na ordem do carrossel", async () => {
    const a = arm(LIMITE_R2);
    const r = await prepararEnvios(
      { destino: "post", clienteId: CLIENTE, postId: POST, arquivos: [foto, video] },
      DONO,
      a,
      () => "x1",
    );
    expect(r.ok).toBe(true);
    expect(a.prepararEnvio.mock.calls).toEqual([
      [`${DONO}/${CLIENTE}/${POST}/0-x1.jpg`, "image/jpeg", 2 * MB],
      [`${DONO}/${CLIENTE}/${POST}/1-x1.mov`, "video/quicktime", 80 * MB],
    ]);
  });

  it("no Supabase gratuito, recusa vídeo acima de 50 MB antes de enviar", async () => {
    const a = arm(LIMITE_SUPABASE);
    const r = await prepararEnvios(
      { destino: "post", clienteId: CLIENTE, postId: POST, arquivos: [video] },
      DONO,
      a,
    );
    expect(r).toEqual({
      ok: false,
      erro: '"reels.mov" passa de 50 MB. Exporte o vídeo em 1080p (no CapCut, por exemplo) para diminuir o tamanho.',
    });
    expect(a.prepararEnvio).not.toHaveBeenCalled();
  });

  it("foto de perfil: uma imagem, na pasta do cliente", async () => {
    const a = arm();
    await prepararEnvios({ destino: "avatar", clienteId: CLIENTE, arquivos: [foto] }, DONO, a, () => "x1");
    expect(a.prepararEnvio.mock.calls[0][0]).toBe(`${DONO}/${CLIENTE}/avatar-x1.jpg`);

    const r = await prepararEnvios(
      { destino: "avatar", clienteId: CLIENTE, arquivos: [{ ...video, tamanho: 1 }] },
      DONO,
      a,
    );
    expect(r).toMatchObject({ ok: false, erro: expect.stringMatching(/não é uma imagem/) });
  });

  it.each([
    [{ destino: "post", clienteId: "x", postId: POST, arquivos: [foto] }, "Envio inválido."],
    [{ destino: "post", clienteId: CLIENTE, postId: "x", arquivos: [foto] }, "Envio inválido."],
    [{ destino: "post", clienteId: CLIENTE, postId: POST, arquivos: [] }, "Adicione pelo menos uma foto ou vídeo."],
    [{ destino: "post", clienteId: CLIENTE, postId: POST, arquivos: Array(21).fill(foto) }, "Um post pode ter no máximo 20 mídias."],
    [{ destino: "avatar", clienteId: CLIENTE, arquivos: [foto, foto] }, "Escolha só uma foto de perfil."],
  ] as const)("valida o pedido %#", async (pedido, erro) => {
    const a = arm();
    expect(await prepararEnvios(pedido as never, DONO, a)).toEqual({ ok: false, erro });
    expect(a.prepararEnvio).not.toHaveBeenCalled();
  });
});

describe("descartarEnvios", () => {
  it("apaga só arquivos da pasta do dono", async () => {
    const apagar = vi.fn().mockResolvedValue(undefined);
    expect(await descartarEnvios([`${DONO}/${CLIENTE}/a.jpg`], DONO, { apagar })).toEqual({ ok: true });
    expect(apagar).toHaveBeenCalledWith([`${DONO}/${CLIENTE}/a.jpg`]);
  });

  it("recusa caminhos de outro dono ou com ..", async () => {
    const apagar = vi.fn();
    for (const caminho of ["outro/cliente/a.jpg", `${DONO}/../outro/a.jpg`]) {
      expect(await descartarEnvios([caminho], DONO, { apagar })).toEqual({ ok: false, erro: "Envio inválido." });
    }
    expect(apagar).not.toHaveBeenCalled();
  });
});
