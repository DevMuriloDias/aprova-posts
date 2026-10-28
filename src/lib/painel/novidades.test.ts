import { describe, expect, it } from "vitest";
import { dataValida, ehNova, mapearNovidades, type LinhaNovidade } from "./novidades";

const VISTO = "2026-10-28T12:00:00+00:00";

function linha(extra: Partial<LinhaNovidade> = {}): LinhaNovidade {
  return {
    id: "e1",
    action: "changes_requested",
    comment: "Trocar a foto",
    audio_path: "d/c/p/audios/a.webm",
    post_version: 2,
    created_at: "2026-10-28T13:00:00+00:00",
    posts: { id: "p1", caption: "Promoção", client_id: "c1", clients: { name: "Padaria" } },
    ...extra,
  };
}

describe("novidades", () => {
  it("é nova só a resposta que chegou depois da última visita", () => {
    expect(ehNova("2026-10-28T12:00:01Z", VISTO)).toBe(true);
    expect(ehNova("2026-10-28T12:00:00Z", VISTO)).toBe(false);
    expect(ehNova("2026-10-27T09:00:00Z", VISTO)).toBe(false);
  });

  it("monta os itens com cliente, post e áudio assinado", () => {
    const urls = new Map([["d/c/p/audios/a.webm", "https://cdn/a.webm"]]);
    expect(mapearNovidades([linha()], VISTO, urls)).toEqual([
      {
        id: "e1",
        acao: "changes_requested",
        comentario: "Trocar a foto",
        audioUrl: "https://cdn/a.webm",
        versao: 2,
        em: "2026-10-28T13:00:00+00:00",
        nova: true,
        clienteId: "c1",
        clienteNome: "Padaria",
        legenda: "Promoção",
      },
    ]);
  });

  it("aguenta post ou cliente ausentes", () => {
    const [item] = mapearNovidades([linha({ posts: null, audio_path: null })], VISTO, new Map());
    expect(item).toMatchObject({ clienteId: null, clienteNome: "Cliente", legenda: "", audioUrl: null });
  });

  it("só aceita datas válidas da URL", () => {
    expect(dataValida("2026-10-28T12:00:00.000Z")).toBe("2026-10-28T12:00:00.000Z");
    expect(dataValida("ontem")).toBeNull();
    expect(dataValida(null)).toBeNull();
  });
});
