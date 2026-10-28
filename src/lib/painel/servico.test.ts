import { describe, expect, it, vi } from "vitest";
import { hashDoToken } from "@/lib/links/token";
import { criarCliente, criarPost, editarPost, gerarLink } from "./servico";

const DONO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUTRO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLIENTE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const POST = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const ok = () => vi.fn().mockResolvedValue({ error: null });

describe("criarCliente", () => {
  it("normaliza o @ e grava", async () => {
    const inserir = ok();
    const r = await criarCliente(
      { id: CLIENTE, nome: "  Padaria  ", instagram: "@padaria.bairro", avatarPath: `${DONO}/${CLIENTE}/avatar-1.jpg` },
      DONO,
      inserir,
    );
    expect(r).toEqual({ ok: true, id: CLIENTE });
    expect(inserir).toHaveBeenCalledWith({
      id: CLIENTE,
      name: "Padaria",
      instagram_handle: "padaria.bairro",
      avatar_path: `${DONO}/${CLIENTE}/avatar-1.jpg`,
    });
  });

  it("@ vazio vira null", async () => {
    const inserir = ok();
    await criarCliente({ id: CLIENTE, nome: "Padaria", instagram: "" }, DONO, inserir);
    expect(inserir.mock.calls[0][0]).toMatchObject({ instagram_handle: null, avatar_path: null });
  });

  it.each([
    [{ id: CLIENTE, nome: "", instagram: "" }, "Informe o nome do cliente."],
    [{ id: CLIENTE, nome: "X", instagram: "com espaço" }, "Use só letras, números, ponto e _ (até 30 caracteres)."],
    [{ id: CLIENTE, nome: "X", instagram: "", avatarPath: `${OUTRO}/${CLIENTE}/a.jpg` }, "Foto de perfil inválida."],
  ])("valida %#", async (entrada, erro) => {
    const inserir = ok();
    expect(await criarCliente(entrada, DONO, inserir)).toEqual({ ok: false, erro });
    expect(inserir).not.toHaveBeenCalled();
  });
});

describe("criarPost", () => {
  const midia = { caminho: `${DONO}/${CLIENTE}/${POST}/0-abc.jpg`, tipo: "image" as const };

  it("chama create_post com as mídias na ordem", async () => {
    const rpc = ok();
    const r = await criarPost(
      {
        id: POST,
        clienteId: CLIENTE,
        legenda: "Oi",
        agendadoPara: "2026-11-05T15:00:00.000Z",
        midias: [midia, { ...midia, caminho: midia.caminho.replace("0-", "1-"), tipo: "video" }],
      },
      DONO,
      rpc,
    );
    expect(r).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith({
      p_id: POST,
      p_client_id: CLIENTE,
      p_caption: "Oi",
      p_scheduled_for: "2026-11-05T15:00:00.000Z",
      p_slides: [
        { storage_path: midia.caminho, media_type: "image" },
        { storage_path: midia.caminho.replace("0-", "1-"), media_type: "video" },
      ],
    });
  });

  it.each([
    [{ midias: [] }, "Adicione pelo menos uma foto ou vídeo."],
    [{ midias: [{ ...midia, caminho: `${OUTRO}/${CLIENTE}/${POST}/0.jpg` }] }, "Mídia inválida."],
    [{ midias: [{ ...midia, caminho: `${DONO}/outro-cliente/${POST}/0.jpg` }] }, "Mídia inválida."],
    [{ midias: Array(21).fill(midia) }, "Um post pode ter no máximo 20 mídias."],
    [{ agendadoPara: "amanhã" }, "Data de publicação inválida."],
  ])("valida %#", async (alteracao, erro) => {
    const rpc = ok();
    const r = await criarPost(
      { id: POST, clienteId: CLIENTE, legenda: "", midias: [midia], ...alteracao },
      DONO,
      rpc,
    );
    expect(r).toEqual({ ok: false, erro });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("gerarLink", () => {
  it("grava só o hash e devolve a URL com o token", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { expires_at: "2026-11-26T12:00:00Z" }, error: null });
    const r = await gerarLink(CLIENTE, "https://app.exemplo.com", rpc, "TOKEN");
    expect(rpc).toHaveBeenCalledWith({ p_client_id: CLIENTE, p_token_hash: hashDoToken("TOKEN") });
    expect(r).toEqual({
      ok: true,
      url: "https://app.exemplo.com/a/TOKEN",
      expiraEm: "2026-11-26T12:00:00Z",
    });
  });

  it("gera um token novo a cada chamada", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { expires_at: "x" }, error: null });
    await gerarLink(CLIENTE, "https://a.com", rpc);
    await gerarLink(CLIENTE, "https://a.com", rpc);
    const [a, b] = rpc.mock.calls.map((c) => c[0].p_token_hash);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it("traduz cliente de outro social media", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "cliente_nao_encontrado" } });
    expect(await gerarLink(CLIENTE, "https://a.com", rpc)).toEqual({
      ok: false,
      erro: "Cliente não encontrado.",
    });
  });
});

describe("editarPost", () => {
  const midia = { caminho: `${DONO}/${CLIENTE}/${POST}/0-novo.jpg`, tipo: "image" as const };
  const rpcOk = (removidos: string[] = []) => vi.fn().mockResolvedValue({ data: removidos, error: null });

  it("sem mídias novas, mantém as atuais (p_slides null)", async () => {
    const rpc = rpcOk();
    const r = await editarPost(
      { id: POST, clienteId: CLIENTE, legenda: "Corrigida", agendadoPara: "2026-11-05T15:00:00.000Z" },
      DONO,
      rpc,
    );
    expect(r).toEqual({ ok: true, removidos: [] });
    expect(rpc).toHaveBeenCalledWith({
      p_id: POST,
      p_caption: "Corrigida",
      p_scheduled_for: "2026-11-05T15:00:00.000Z",
      p_slides: null,
    });
  });

  it("com mídias novas, envia a lista e devolve as que saíram", async () => {
    const rpc = rpcOk([`${DONO}/${CLIENTE}/${POST}/0-velha.jpg`]);
    const r = await editarPost(
      { id: POST, clienteId: CLIENTE, legenda: "", midias: [midia] },
      DONO,
      rpc,
    );
    expect(rpc.mock.calls[0][0].p_slides).toEqual([
      { storage_path: midia.caminho, media_type: "image" },
    ]);
    expect(r).toEqual({ ok: true, removidos: [`${DONO}/${CLIENTE}/${POST}/0-velha.jpg`] });
  });

  it.each([
    [{ midias: [] }, "Adicione pelo menos uma foto ou vídeo."],
    [{ midias: [{ ...midia, caminho: `${OUTRO}/${CLIENTE}/${POST}/0.jpg` }] }, "Mídia inválida."],
    [{ legenda: "x".repeat(2201) }, "A legenda pode ter no máximo 2.200 caracteres."],
  ])("valida %#", async (alteracao, erro) => {
    const rpc = rpcOk();
    const r = await editarPost({ id: POST, clienteId: CLIENTE, legenda: "", ...alteracao }, DONO, rpc);
    expect(r).toEqual({ ok: false, erro });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduz post de outro social media", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "post_nao_encontrado" } });
    expect(await editarPost({ id: POST, clienteId: CLIENTE, legenda: "" }, DONO, rpc)).toEqual({
      ok: false,
      erro: "Post não encontrado.",
    });
  });
});
