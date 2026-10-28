// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PostParaAprovar, ResultadoDecisao, UltimaDecisao } from "@/lib/aprovacao/tipos";
import { AprovacaoCliente } from "./aprovacao-cliente";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Campos enviados na chamada `n` de decidir (FormData). */
function enviado(decidir: ReturnType<typeof vi.fn>, n = 0) {
  const dados = decidir.mock.calls[n][0] as FormData;
  return Object.fromEntries(dados.entries());
}

function decisao(extra: Partial<UltimaDecisao> = {}): UltimaDecisao {
  return {
    acao: "approved",
    comentario: null,
    audioUrl: null,
    versao: 1,
    em: "2026-10-27T18:00:00Z",
    ...extra,
  };
}

const cliente = { nome: "Padaria do Bairro", instagram: "padariadobairro", avatarUrl: null };

function post(id: string, extra: Partial<PostParaAprovar> = {}): PostParaAprovar {
  return {
    id,
    legenda: `Legenda do post ${id}`,
    status: "pending_approval",
    agendadoPara: null,
    versao: 1,
    reenviadoEm: null,
    midias: [{ tipo: "image", url: `https://cdn/${id}.jpg` }],
    ultimaDecisao: null,
    ...extra,
  };
}

const posts = [
  post("p1", {
    midias: [
      { tipo: "image", url: "https://cdn/p1-a.jpg" },
      { tipo: "image", url: "https://cdn/p1-b.jpg" },
      { tipo: "video", url: "https://cdn/p1-c.mp4" },
    ],
    agendadoPara: "2026-11-05T15:00:00Z",
  }),
  post("p2", { status: "approved", ultimaDecisao: decisao({ em: "2026-10-27T17:32:00Z" }) }),
  post("p3"),
];

function renderizar(
  decidir = vi.fn<(dados: FormData) => Promise<ResultadoDecisao>>(),
  postsIniciais = posts,
) {
  render(
    <AprovacaoCliente
      cliente={cliente}
      postsIniciais={postsIniciais}
      expiraEm="2026-11-26T12:00:00Z"
      decidir={decidir}
    />,
  );
  return decidir;
}

function cartao(indice: number) {
  return screen.getAllByRole("article")[indice];
}

describe("página de aprovação do cliente", () => {
  it("mostra o perfil, a validade do link e o progresso", () => {
    renderizar();
    expect(screen.getByRole("heading", { name: "Padaria do Bairro" })).toBeInTheDocument();
    expect(screen.getByText("@padariadobairro")).toBeInTheDocument();
    expect(screen.getByText("Link válido até 26/11/2026")).toBeInTheDocument();
    expect(screen.getByText("1 de 3 posts aprovados")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("cada post simula o feed: perfil, mídias deslizáveis e legenda", () => {
    renderizar();
    const primeiro = cartao(0);
    expect(within(primeiro).getAllByText("padariadobairro")).not.toHaveLength(0);
    expect(within(primeiro).getByText(/Previsto: 05 de nov/)).toBeInTheDocument();
    expect(within(primeiro).getAllByRole("img")).toHaveLength(2);
    expect(primeiro.querySelector("video")).not.toBeNull();
    expect(within(primeiro).getByText("1/3")).toBeInTheDocument();
    expect(within(primeiro).getByRole("button", { name: "Ir para a mídia 3" })).toBeInTheDocument();
    expect(within(primeiro).getByText(/Legenda do post p1/)).toBeInTheDocument();
  });

  it("aprovar registra e atualiza o status e a barra de progresso", async () => {
    const decidir = renderizar(
      vi.fn().mockResolvedValue({
        ok: true,
        status: "approved",
        decisao: decisao(),
      }),
    );
    await userEvent.click(within(cartao(0)).getByRole("button", { name: "Aprovar" }));

    expect(enviado(decidir)).toEqual({ postId: "p1", acao: "approved" });
    expect(await screen.findByText("2 de 3 posts aprovados")).toBeInTheDocument();
    expect(within(cartao(0)).getByText("Você aprovou em 27/10/2026 às 15:00")).toBeInTheDocument();
    expect(within(cartao(0)).getByRole("button", { name: "Aprovado ✓" })).toBeDisabled();
  });

  it("pedir ajuste exige texto ou áudio e envia o comentário", async () => {
    const decidir = renderizar(
      vi.fn().mockResolvedValue({
        ok: true,
        status: "changes_requested",
        decisao: decisao({ acao: "changes_requested", comentario: "Trocar a foto" }),
      }),
    );
    const terceiro = cartao(2);
    await userEvent.click(within(terceiro).getByRole("button", { name: "Pedir ajuste" }));
    await userEvent.click(within(terceiro).getByRole("button", { name: "Enviar ajuste" }));
    expect(within(terceiro).getByRole("alert")).toHaveTextContent(
      "Escreva o que precisa ajustar ou grave um áudio.",
    );
    expect(decidir).not.toHaveBeenCalled();

    await userEvent.type(within(terceiro).getByLabelText(/O que precisa ajustar/), "Trocar a foto");
    await userEvent.click(within(terceiro).getByRole("button", { name: "Enviar ajuste" }));

    expect(enviado(decidir)).toEqual({
      postId: "p3",
      acao: "changes_requested",
      comentario: "Trocar a foto",
    });
    expect(await within(terceiro).findByText("Ajuste pedido")).toBeInTheDocument();
    expect(within(terceiro).getByText("“Trocar a foto”")).toBeInTheDocument();
    expect(screen.getByText("1 com ajuste · 1 aguardando")).toBeInTheDocument();
  });

  it("mostra o erro quando o link deixou de valer", async () => {
    renderizar(vi.fn().mockResolvedValue({ ok: false, erro: "Este link não está mais ativo." }));
    await userEvent.click(within(cartao(0)).getByRole("button", { name: "Aprovar" }));
    expect(await within(cartao(0)).findByRole("alert")).toHaveTextContent(
      "Este link não está mais ativo.",
    );
    expect(screen.getByText("1 de 3 posts aprovados")).toBeInTheDocument();
  });

  it("aba Grade do perfil mostra os posts em 3 colunas, o mais recente primeiro", async () => {
    renderizar();
    await userEvent.click(screen.getByRole("tab", { name: "Grade do perfil" }));
    expect(screen.getByRole("tab", { name: "Grade do perfil" })).toHaveAttribute("aria-selected", "true");

    const [grade, legenda] = screen.getAllByRole("list");
    expect(legenda).toHaveTextContent("AprovadoAjuste pedidoAguardando aprovação");
    expect(grade).toHaveClass("grid-cols-3");
    const itens = within(grade).getAllByRole("button");
    expect(itens.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Abrir post 1 (Aguardando aprovação)",
      "Abrir post 2 (Aprovado)",
      "Abrir post 3 (Aguardando aprovação)",
    ]);
    expect(itens[2]).toHaveTextContent("carrossel");

    await userEvent.click(itens[2]);
    expect(screen.getByRole("tab", { name: "Posts" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("áudio no pedido de ajuste", () => {
  class GravadorFalso {
    static isTypeSupported = (tipo: string) => tipo === "audio/webm;codecs=opus";
    state = "inactive";
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(_fluxo: unknown, opcoes: { mimeType?: string }) {
      this.mimeType = opcoes.mimeType ?? "";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["voz"], { type: this.mimeType }) });
      this.onstop?.();
    }
  }

  function liberarMicrofone(permitir = true) {
    const parar = vi.fn();
    vi.stubGlobal("MediaRecorder", GravadorFalso);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: permitir
          ? vi.fn().mockResolvedValue({ getTracks: () => [{ stop: parar }] })
          : vi.fn().mockRejectedValue(new Error("NotAllowedError")),
      },
    });
    URL.createObjectURL = vi.fn(() => "blob:audio");
    URL.revokeObjectURL = vi.fn();
    return parar;
  }

  it("grava, mostra para ouvir e envia o áudio sem precisar escrever", async () => {
    const pararMicrofone = liberarMicrofone();
    const decidir = renderizar(
      vi.fn().mockResolvedValue({
        ok: true,
        status: "changes_requested",
        decisao: decisao({ acao: "changes_requested", audioUrl: "https://cdn/audio.webm" }),
      }),
    );
    const terceiro = cartao(2);
    await userEvent.click(within(terceiro).getByRole("button", { name: "Pedir ajuste" }));
    await userEvent.click(within(terceiro).getByRole("button", { name: "Gravar áudio" }));
    const parar = await within(terceiro).findByRole("button", { name: /Parar gravação/ });
    await act(async () => userEvent.click(parar));

    expect(pararMicrofone).toHaveBeenCalled();
    expect(within(terceiro).getByText(/Áudio gravado/)).toBeInTheDocument();
    expect(terceiro.querySelector("audio")).toHaveAttribute("src", "blob:audio");

    await userEvent.click(within(terceiro).getByRole("button", { name: "Enviar ajuste" }));
    const campos = enviado(decidir);
    expect(campos).toMatchObject({ postId: "p3", acao: "changes_requested" });
    expect(campos.comentario).toBeUndefined();
    expect(campos.audio).toBeInstanceOf(Blob);
    expect((campos.audio as Blob).type).toBe("audio/webm;codecs=opus");

    expect(await within(terceiro).findByText("Ajuste pedido")).toBeInTheDocument();
    expect(within(terceiro).getByLabelText("Áudio do pedido de ajuste")).toHaveAttribute(
      "src",
      "https://cdn/audio.webm",
    );
  });

  it("apagar o áudio volta a exigir texto ou áudio", async () => {
    liberarMicrofone();
    const decidir = renderizar(vi.fn());
    const terceiro = cartao(2);
    await userEvent.click(within(terceiro).getByRole("button", { name: "Pedir ajuste" }));
    await userEvent.click(within(terceiro).getByRole("button", { name: "Gravar áudio" }));
    await act(async () =>
      userEvent.click(await within(terceiro).findByRole("button", { name: /Parar gravação/ })),
    );
    await userEvent.click(within(terceiro).getByRole("button", { name: "Apagar áudio" }));
    await userEvent.click(within(terceiro).getByRole("button", { name: "Enviar ajuste" }));
    expect(decidir).not.toHaveBeenCalled();
    expect(within(terceiro).getByRole("alert")).toHaveTextContent(/grave um áudio/);
  });

  it("explica quando o microfone é bloqueado", async () => {
    liberarMicrofone(false);
    renderizar();
    const terceiro = cartao(2);
    await userEvent.click(within(terceiro).getByRole("button", { name: "Pedir ajuste" }));
    await userEvent.click(within(terceiro).getByRole("button", { name: "Gravar áudio" }));
    expect(await within(terceiro).findByRole("alert")).toHaveTextContent(
      /Permita o acesso ao microfone/,
    );
  });
});

describe("post ajustado e reenviado", () => {
  it("mostra que o pedido foi atendido, com o que o cliente tinha pedido", () => {
    renderizar(vi.fn(), [
      post("p1", {
        versao: 2,
        reenviadoEm: "2026-10-28T13:00:00Z",
        ultimaDecisao: decisao({
          acao: "changes_requested",
          comentario: "Trocar a foto",
          audioUrl: "https://cdn/a.webm",
          versao: 1,
        }),
      }),
    ]);
    const aviso = within(cartao(0)).getByRole("status");
    expect(aviso).toHaveTextContent("Post ajustado em 28/10/2026 às 10:00. Confira a nova versão.");
    expect(aviso).toHaveTextContent("Você tinha pedido: “Trocar a foto”");
    expect(aviso.querySelector("audio")).toHaveAttribute("src", "https://cdn/a.webm");
    expect(within(cartao(0)).getByRole("button", { name: "Aprovar" })).toBeEnabled();
  });

  it("avisa quando um post aprovado foi alterado", () => {
    renderizar(vi.fn(), [
      post("p1", {
        versao: 2,
        reenviadoEm: "2026-10-28T13:00:00Z",
        ultimaDecisao: decisao({ acao: "approved", versao: 1 }),
      }),
    ]);
    expect(within(cartao(0)).getByRole("status")).toHaveTextContent(
      "Este post foi alterado em 28/10/2026 às 10:00, depois da sua aprovação. Confira de novo.",
    );
  });
});
