import { describe, expect, it, vi } from "vitest";
import { gerarToken, hashDoToken } from "@/lib/links/token";
import { TAMANHO_MAXIMO_AUDIO } from "./limites";
import { MENSAGENS, registrarDecisao, type DependenciasDecisao, type EventoRegistrado } from "./servico";

const POST_ID = "11111111-1111-4111-8111-111111111111";
const PASTA = "dono/cliente/post/audios/";

type Audio = { type: string; size: number };

function evento(extra: Partial<EventoRegistrado> = {}): EventoRegistrado {
  return {
    id: "evt-1",
    action: "approved",
    comment: null,
    audio_path: null,
    post_version: 1,
    created_at: "2026-10-27T12:00:00+00:00",
    ...extra,
  };
}

function deps(extra: Partial<DependenciasDecisao<Audio>> = {}) {
  const base = {
    pastaDoAudio: vi.fn<DependenciasDecisao<Audio>["pastaDoAudio"]>().mockResolvedValue({ ok: true, pasta: PASTA }),
    enviarAudio: vi.fn<DependenciasDecisao<Audio>["enviarAudio"]>().mockResolvedValue(true),
    removerAudio: vi.fn<DependenciasDecisao<Audio>["removerAudio"]>().mockResolvedValue(),
    registrar: vi
      .fn<DependenciasDecisao<Audio>["registrar"]>()
      .mockImplementation(async (a) =>
        ({ ok: true, evento: evento({ action: a.acao, comment: a.comentario, audio_path: a.audioPath }) }),
      ),
    assinar: vi.fn<DependenciasDecisao<Audio>["assinar"]>().mockImplementation(async (c) => `https://cdn/${c}`),
    idAleatorio: () => "abc",
  };
  return { ...base, ...extra } as typeof base;
}

const audio = (type = "audio/webm;codecs=opus", size = 50_000): Audio => ({ type, size });

describe("registrarDecisao", () => {
  it("aprova enviando o hash do token, sem áudio", async () => {
    const token = gerarToken();
    const d = deps();
    const r = await registrarDecisao({ token, postId: POST_ID, acao: "approved" }, d);
    expect(d.registrar).toHaveBeenCalledWith({
      tokenHash: hashDoToken(token),
      postId: POST_ID,
      acao: "approved",
      comentario: null,
      audioPath: null,
    });
    expect(d.pastaDoAudio).not.toHaveBeenCalled();
    expect(r).toEqual({
      ok: true,
      status: "approved",
      decisao: {
        acao: "approved",
        comentario: null,
        audioUrl: null,
        versao: 1,
        em: "2026-10-27T12:00:00+00:00",
      },
    });
  });

  it("pede ajuste com o comentário sem espaços extras", async () => {
    const d = deps();
    await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", comentario: "  Trocar foto " },
      d,
    );
    expect(d.registrar.mock.calls[0][0].comentario).toBe("Trocar foto");
  });

  it("pedido de ajuste sem comentário e sem áudio nem vai ao banco", async () => {
    const d = deps();
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", comentario: "   " },
      d,
    );
    expect(r).toEqual({ ok: false, erro: MENSAGENS.semComentario });
    expect(d.registrar).not.toHaveBeenCalled();
  });

  it("recusa comentário longo demais", async () => {
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", comentario: "x".repeat(2001) },
      deps(),
    );
    expect(r).toEqual({ ok: false, erro: MENSAGENS.comentarioLongo });
  });

  it.each([
    [{ token: "malformado", postId: POST_ID, acao: "approved" }, MENSAGENS.linkInvalido],
    [{ token: gerarToken(), postId: "nao-e-uuid", acao: "approved" }, MENSAGENS.postInvalido],
    [{ token: gerarToken(), postId: POST_ID, acao: "deleted" }, MENSAGENS.postInvalido],
  ])("recusa entrada inválida %#", async (entrada, erro) => {
    const d = deps();
    expect(await registrarDecisao(entrada, d)).toEqual({ ok: false, erro });
    expect(d.registrar).not.toHaveBeenCalled();
  });

  it.each([
    ["link_invalido", MENSAGENS.linkInvalido],
    ["post_invalido", MENSAGENS.postInvalido],
    ["connection refused", MENSAGENS.generico],
  ])("traduz o erro do banco %s", async (mensagem, erro) => {
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "approved" },
      deps({ registrar: vi.fn().mockResolvedValue({ ok: false, mensagem }) }),
    );
    expect(r).toEqual({ ok: false, erro });
  });
});

describe("registrarDecisao com áudio", () => {
  it("valida o link, envia o áudio na pasta do post e registra o caminho", async () => {
    const token = gerarToken();
    const d = deps();
    const a = audio();
    const r = await registrarDecisao(
      { token, postId: POST_ID, acao: "changes_requested", audio: a },
      d,
    );

    expect(d.pastaDoAudio).toHaveBeenCalledWith(hashDoToken(token), POST_ID);
    expect(d.enviarAudio).toHaveBeenCalledWith(`${PASTA}abc.webm`, a, "audio/webm");
    expect(d.registrar.mock.calls[0][0]).toMatchObject({
      acao: "changes_requested",
      comentario: null,
      audioPath: `${PASTA}abc.webm`,
    });
    expect(r).toMatchObject({
      ok: true,
      decisao: { audioUrl: `https://cdn/${PASTA}abc.webm` },
    });
  });

  it("usa a extensão certa para o áudio do iPhone (mp4)", async () => {
    const d = deps();
    await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", audio: audio("audio/mp4") },
      d,
    );
    expect(d.enviarAudio.mock.calls[0][0]).toBe(`${PASTA}abc.m4a`);
  });

  it("aceita comentário e áudio juntos", async () => {
    const d = deps();
    await registrarDecisao(
      {
        token: gerarToken(),
        postId: POST_ID,
        acao: "changes_requested",
        comentario: "Veja o áudio",
        audio: audio(),
      },
      d,
    );
    expect(d.registrar.mock.calls[0][0]).toMatchObject({
      comentario: "Veja o áudio",
      audioPath: `${PASTA}abc.webm`,
    });
  });

  it("ignora áudio na aprovação", async () => {
    const d = deps();
    await registrarDecisao({ token: gerarToken(), postId: POST_ID, acao: "approved", audio: audio() }, d);
    expect(d.enviarAudio).not.toHaveBeenCalled();
    expect(d.registrar.mock.calls[0][0].audioPath).toBeNull();
  });

  it.each([
    [audio("audio/wav"), MENSAGENS.audioFormato],
    [audio("text/plain"), MENSAGENS.audioFormato],
    [audio("audio/webm", 0), MENSAGENS.audioFormato],
    [audio("audio/webm", TAMANHO_MAXIMO_AUDIO + 1), MENSAGENS.audioGrande],
  ])("recusa áudio inválido %#, sem enviar nada", async (a, erro) => {
    const d = deps();
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", audio: a },
      d,
    );
    expect(r).toEqual({ ok: false, erro });
    expect(d.pastaDoAudio).not.toHaveBeenCalled();
    expect(d.enviarAudio).not.toHaveBeenCalled();
  });

  it("link inválido: não envia o áudio", async () => {
    const d = deps({ pastaDoAudio: vi.fn().mockResolvedValue({ ok: false, mensagem: "link_invalido" }) });
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", audio: audio() },
      d,
    );
    expect(r).toEqual({ ok: false, erro: MENSAGENS.linkInvalido });
    expect(d.enviarAudio).not.toHaveBeenCalled();
  });

  it("falha no upload: não registra", async () => {
    const d = deps({ enviarAudio: vi.fn().mockResolvedValue(false) });
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", audio: audio() },
      d,
    );
    expect(r).toEqual({ ok: false, erro: MENSAGENS.audioFalhou });
    expect(d.registrar).not.toHaveBeenCalled();
  });

  it("falha ao registrar: apaga o áudio que já tinha subido", async () => {
    const d = deps({ registrar: vi.fn().mockResolvedValue({ ok: false, mensagem: "link_invalido" }) });
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", audio: audio() },
      d,
    );
    expect(r).toEqual({ ok: false, erro: MENSAGENS.linkInvalido });
    expect(d.removerAudio).toHaveBeenCalledWith(`${PASTA}abc.webm`);
  });
});

describe("aviso ao social media", () => {
  it("chama aposRegistrar com o id do evento gravado", async () => {
    const aposRegistrar = vi.fn();
    await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "approved" },
      deps({ aposRegistrar }),
    );
    expect(aposRegistrar).toHaveBeenCalledWith("evt-1");
  });

  it("não avisa quando a resposta não foi gravada", async () => {
    const aposRegistrar = vi.fn();
    await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "approved" },
      deps({ aposRegistrar, registrar: vi.fn().mockResolvedValue({ ok: false, mensagem: "link_invalido" }) }),
    );
    expect(aposRegistrar).not.toHaveBeenCalled();
  });
});
