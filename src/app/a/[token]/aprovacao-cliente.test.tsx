// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PostParaAprovar, ResultadoDecisao } from "@/lib/aprovacao/tipos";
import { AprovacaoCliente } from "./aprovacao-cliente";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});
afterEach(cleanup);

const cliente = { nome: "Padaria do Bairro", instagram: "padariadobairro", avatarUrl: null };

function post(id: string, extra: Partial<PostParaAprovar> = {}): PostParaAprovar {
  return {
    id,
    legenda: `Legenda do post ${id}`,
    status: "pending_approval",
    agendadoPara: null,
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
  post("p2", { status: "approved", ultimaDecisao: { acao: "approved", comentario: null, em: "2026-10-27T17:32:00Z" } }),
  post("p3"),
];

function renderizar(decidir = vi.fn<(...a: unknown[]) => Promise<ResultadoDecisao>>()) {
  render(
    <AprovacaoCliente
      cliente={cliente}
      postsIniciais={posts}
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
        decisao: { acao: "approved", comentario: null, em: "2026-10-27T18:00:00Z" },
      }),
    );
    await userEvent.click(within(cartao(0)).getByRole("button", { name: "Aprovar" }));

    expect(decidir).toHaveBeenCalledWith("p1", "approved", undefined);
    expect(await screen.findByText("2 de 3 posts aprovados")).toBeInTheDocument();
    expect(within(cartao(0)).getByText("Você aprovou em 27/10/2026 às 15:00")).toBeInTheDocument();
    expect(within(cartao(0)).getByRole("button", { name: "Aprovado ✓" })).toBeDisabled();
  });

  it("pedir ajuste exige o texto e envia o comentário", async () => {
    const decidir = renderizar(
      vi.fn().mockResolvedValue({
        ok: true,
        status: "changes_requested",
        decisao: { acao: "changes_requested", comentario: "Trocar a foto", em: "2026-10-27T18:00:00Z" },
      }),
    );
    const terceiro = cartao(2);
    await userEvent.click(within(terceiro).getByRole("button", { name: "Pedir ajuste" }));
    await userEvent.click(within(terceiro).getByRole("button", { name: "Enviar ajuste" }));
    expect(within(terceiro).getByRole("alert")).toHaveTextContent("Conte o que precisa ser ajustado.");
    expect(decidir).not.toHaveBeenCalled();

    await userEvent.type(within(terceiro).getByLabelText("O que precisa ajustar?"), "Trocar a foto");
    await userEvent.click(within(terceiro).getByRole("button", { name: "Enviar ajuste" }));

    expect(decidir).toHaveBeenCalledWith("p3", "changes_requested", "Trocar a foto");
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
