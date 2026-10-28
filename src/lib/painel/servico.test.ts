import { afterEach, describe, expect, it, vi } from "vitest";
import { hashDoToken } from "@/lib/links/token";
import {
  criarCliente,
  criarPost,
  editarPost,
  excluirCliente,
  excluirPost,
  gerarLink,
  reagendarPost,
} from "./servico";

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

describe("excluir cliente e post", () => {
  afterEach(() => vi.restoreAllMocks());

  it("exclui e apaga do storage os arquivos devolvidos, em lotes de 100", async () => {
    const arquivos = Array.from({ length: 150 }, (_, i) => `${DONO}/${CLIENTE}/${i}.jpg`);
    const rpc = vi.fn().mockResolvedValue({ data: arquivos, error: null });
    const apagar = vi.fn().mockResolvedValue(undefined);
    expect(await excluirCliente(CLIENTE, rpc, apagar)).toEqual({ ok: true, arquivos: 150 });
    expect(rpc).toHaveBeenCalledWith({ p_id: CLIENTE });
    expect(apagar.mock.calls.map((c) => c[0].length)).toEqual([100, 50]);
  });

  it("sem arquivos, não chama o storage", async () => {
    const apagar = vi.fn();
    await excluirPost(POST, vi.fn().mockResolvedValue({ data: [], error: null }), apagar);
    expect(apagar).not.toHaveBeenCalled();
  });

  it("se o storage falhar, a exclusão continua valendo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await excluirPost(
      POST,
      vi.fn().mockResolvedValue({ data: ["a.jpg"], error: null }),
      vi.fn().mockRejectedValue(new Error("storage fora do ar")),
    );
    expect(r).toEqual({ ok: true, arquivos: 1 });
  });

  it("traduz o que não foi encontrado e recusa id inválido", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "cliente_nao_encontrado" } });
    expect(await excluirCliente(CLIENTE, rpc, vi.fn())).toEqual({ ok: false, erro: "Cliente não encontrado." });
    const naoChamado = vi.fn();
    expect(await excluirPost("nao-e-uuid", naoChamado, vi.fn())).toEqual({
      ok: false,
      erro: "Post não encontrado.",
    });
    expect(naoChamado).not.toHaveBeenCalled();
  });
});

describe("reagendarPost", () => {
  it("envia a nova data em ISO", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    expect(await reagendarPost(POST, "2026-11-20T18:30:00.000Z", rpc)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith({ p_id: POST, p_scheduled_for: "2026-11-20T18:30:00.000Z" });
  });

  it("aceita tirar a data", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await reagendarPost(POST, null, rpc);
    expect(rpc).toHaveBeenCalledWith({ p_id: POST, p_scheduled_for: null });
  });

  it("valida a data e o post", async () => {
    const rpc = vi.fn();
    expect(await reagendarPost(POST, "amanhã", rpc)).toEqual({ ok: false, erro: "Data de publicação inválida." });
    expect(rpc).not.toHaveBeenCalled();
    const outro = vi.fn().mockResolvedValue({ error: { message: "post_nao_encontrado" } });
    expect(await reagendarPost(POST, null, outro)).toEqual({ ok: false, erro: "Post não encontrado." });
  });
});
