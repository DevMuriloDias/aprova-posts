import { describe, expect, it, vi } from "vitest";
import { gerarToken, hashDoToken } from "@/lib/links/token";
import { carregarPaginaAprovacao, type DependenciasPagina } from "./pagina";

const POST_ID = "11111111-1111-4111-8111-111111111111";

const paginaAtiva = {
  state: "active",
  expires_at: "2026-11-26T12:00:00+00:00",
  client: { name: "Padaria", instagram_handle: "padaria", avatar_path: "dono/cli/avatar.jpg" },
  posts: [
    {
      id: POST_ID,
      caption: "Promoção!",
      status: "changes_requested",
      scheduled_for: null,
      version: 2,
      resubmitted_at: "2026-10-28T09:00:00+00:00",
      slides: [
        { position: 0, media_type: "image", storage_path: "dono/cli/p/0.jpg" },
        { position: 1, media_type: "video", storage_path: "dono/cli/p/1.mp4" },
      ],
      last_event: {
        action: "changes_requested",
        comment: "Trocar a foto",
        audio_path: "dono/cli/p/audios/a.webm",
        post_version: 1,
        created_at: "2026-10-27T12:00:00+00:00",
      },
    },
  ],
};

function deps(resposta: unknown): DependenciasPagina & {
  buscarPagina: ReturnType<typeof vi.fn>;
  assinarUrls: ReturnType<typeof vi.fn>;
} {
  return {
    buscarPagina: vi.fn().mockResolvedValue(resposta),
    assinarUrls: vi
      .fn()
      .mockImplementation(async (caminhos: string[]) => new Map(caminhos.map((c) => [c, `https://cdn/${c}?assinado`]))),
  };
}

describe("carregarPaginaAprovacao", () => {
  it("token malformado nem chega ao banco", async () => {
    const d = deps(null);
    expect(await carregarPaginaAprovacao("abc", d)).toEqual({ estado: "inexistente" });
    expect(d.buscarPagina).not.toHaveBeenCalled();
  });

  it("consulta o banco pelo hash, nunca pelo token", async () => {
    const token = gerarToken();
    const d = deps(null);
    expect(await carregarPaginaAprovacao(token, d)).toEqual({ estado: "inexistente" });
    expect(d.buscarPagina).toHaveBeenCalledWith(hashDoToken(token));
  });

  it.each([
    ["revoked", "revogado"],
    ["expired", "expirado"],
  ])("link %s vira estado %s, sem assinar mídias", async (state, estado) => {
    const d = deps({ state });
    expect(await carregarPaginaAprovacao(gerarToken(), d)).toEqual({ estado });
    expect(d.assinarUrls).not.toHaveBeenCalled();
  });

  it("monta a página com URLs assinadas para a foto de perfil e as mídias", async () => {
    const d = deps(paginaAtiva);
    const pagina = await carregarPaginaAprovacao(gerarToken(), d);
    expect(d.assinarUrls).toHaveBeenCalledWith([
      "dono/cli/avatar.jpg",
      "dono/cli/p/0.jpg",
      "dono/cli/p/1.mp4",
      "dono/cli/p/audios/a.webm",
    ]);
    expect(pagina).toEqual({
      estado: "ativo",
      expiraEm: "2026-11-26T12:00:00+00:00",
      cliente: {
        nome: "Padaria",
        instagram: "padaria",
        avatarUrl: "https://cdn/dono/cli/avatar.jpg?assinado",
      },
      posts: [
        {
          id: POST_ID,
          legenda: "Promoção!",
          status: "changes_requested",
          agendadoPara: null,
          versao: 2,
          reenviadoEm: "2026-10-28T09:00:00+00:00",
          midias: [
            { tipo: "image", url: "https://cdn/dono/cli/p/0.jpg?assinado" },
            { tipo: "video", url: "https://cdn/dono/cli/p/1.mp4?assinado" },
          ],
          ultimaDecisao: {
            acao: "changes_requested",
            comentario: "Trocar a foto",
            audioUrl: "https://cdn/dono/cli/p/audios/a.webm?assinado",
            versao: 1,
            em: "2026-10-27T12:00:00+00:00",
          },
        },
      ],
    });
  });

  it("não falha se uma mídia não puder ser assinada", async () => {
    const d = deps({ ...paginaAtiva, client: { ...paginaAtiva.client, avatar_path: null } });
    d.assinarUrls.mockResolvedValue(new Map());
    const pagina = await carregarPaginaAprovacao(gerarToken(), d);
    expect(pagina.estado === "ativo" && pagina.posts[0].midias[0].url).toBeNull();
    expect(pagina.estado === "ativo" && pagina.cliente.avatarUrl).toBeNull();
  });

  it("recusa resposta fora do formato esperado", async () => {
    await expect(carregarPaginaAprovacao(gerarToken(), deps({ state: "???" }))).rejects.toThrow();
  });
});
