import { describe, expect, it, vi } from "vitest";
import { gerarToken, hashDoToken } from "@/lib/links/token";
import { MENSAGENS, registrarDecisao, type RegistrarNoBanco } from "./servico";

const POST_ID = "11111111-1111-4111-8111-111111111111";

function banco(resposta?: Awaited<ReturnType<RegistrarNoBanco>>) {
  return vi.fn<RegistrarNoBanco>().mockResolvedValue(
    resposta ?? {
      ok: true,
      evento: { action: "approved", comment: null, created_at: "2026-10-27T12:00:00+00:00" },
    },
  );
}

describe("registrarDecisao", () => {
  it("aprova enviando o hash do token", async () => {
    const token = gerarToken();
    const registrar = banco();
    const r = await registrarDecisao({ token, postId: POST_ID, acao: "approved" }, registrar);
    expect(registrar).toHaveBeenCalledWith({
      tokenHash: hashDoToken(token),
      postId: POST_ID,
      acao: "approved",
      comentario: null,
    });
    expect(r).toEqual({
      ok: true,
      status: "approved",
      decisao: { acao: "approved", comentario: null, em: "2026-10-27T12:00:00+00:00" },
    });
  });

  it("pede ajuste com o comentário sem espaços extras", async () => {
    const registrar = banco({
      ok: true,
      evento: { action: "changes_requested", comment: "Trocar foto", created_at: "2026-10-27T12:00:00Z" },
    });
    await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", comentario: "  Trocar foto " },
      registrar,
    );
    expect(registrar.mock.calls[0][0].comentario).toBe("Trocar foto");
  });

  it("pedido de ajuste sem comentário nem vai ao banco", async () => {
    const registrar = banco();
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", comentario: "   " },
      registrar,
    );
    expect(r).toEqual({ ok: false, erro: MENSAGENS.semComentario });
    expect(registrar).not.toHaveBeenCalled();
  });

  it("recusa comentário longo demais", async () => {
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "changes_requested", comentario: "x".repeat(2001) },
      banco(),
    );
    expect(r).toEqual({ ok: false, erro: MENSAGENS.comentarioLongo });
  });

  it.each([
    [{ token: "malformado", postId: POST_ID, acao: "approved" }, MENSAGENS.linkInvalido],
    [{ token: gerarToken(), postId: "nao-e-uuid", acao: "approved" }, MENSAGENS.postInvalido],
    [{ token: gerarToken(), postId: POST_ID, acao: "deleted" }, MENSAGENS.postInvalido],
  ])("recusa entrada inválida %#", async (entrada, erro) => {
    const registrar = banco();
    expect(await registrarDecisao(entrada, registrar)).toEqual({ ok: false, erro });
    expect(registrar).not.toHaveBeenCalled();
  });

  it.each([
    ["link_invalido", MENSAGENS.linkInvalido],
    ["post_invalido", MENSAGENS.postInvalido],
    ["connection refused", MENSAGENS.generico],
  ])("traduz o erro do banco %s", async (mensagem, erro) => {
    const r = await registrarDecisao(
      { token: gerarToken(), postId: POST_ID, acao: "approved" },
      banco({ ok: false, mensagem }),
    );
    expect(r).toEqual({ ok: false, erro });
  });
});
