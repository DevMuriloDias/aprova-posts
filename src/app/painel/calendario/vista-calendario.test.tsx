// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostNoCalendario } from "@/lib/painel/consultas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/painel/calendario",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../actions", () => ({ acaoReagendarPost: vi.fn() }));
vi.mock("../clientes/[id]/formulario-post", () => ({
  FormularioPost: (p: { agendadoInicial?: string; clientes?: { nome: string }[] }) => (
    <div data-testid="novo-post" data-agendado={p.agendadoInicial} data-clientes={p.clientes?.length} />
  ),
}));

const { VistaCalendario } = await import("./vista-calendario");

afterEach(cleanup);

const PADARIA = "11111111-1111-4111-8111-111111111111";
const ACADEMIA = "22222222-2222-4222-8222-222222222222";

function post(id: string, extra: Partial<PostNoCalendario> = {}): PostNoCalendario {
  return {
    id,
    clienteId: PADARIA,
    clienteNome: "Padaria",
    legenda: `Legenda ${id}`,
    status: "pending_approval",
    agendadoPara: "2026-11-05T13:00:00Z", // 10:00 em Brasília
    capaUrl: null,
    capaTipo: null,
    totalMidias: 1,
    ...extra,
  };
}

function renderizar(extra: Partial<Parameters<typeof VistaCalendario>[0]> = {}) {
  render(
    <VistaCalendario
      mes={{ ano: 2026, mes: 11 }}
      hoje="2026-11-03"
      diaSelecionado="2026-11-05"
      clienteId={null}
      donoId="dono"
      clientes={[
        { id: ACADEMIA, nome: "Academia" },
        { id: PADARIA, nome: "Padaria" },
      ]}
      agendados={[
        post("p1"),
        post("p2", {
          clienteId: ACADEMIA,
          clienteNome: "Academia",
          agendadoPara: "2026-11-06T01:30:00Z", // 22:30 do dia 5 em Brasília
          status: "approved",
        }),
        post("p3", { agendadoPara: "2026-11-20T15:00:00Z" }),
      ]}
      semData={[post("p4", { agendadoPara: null, legenda: "Ideia sem data" })]}
      {...extra}
    />,
  );
}

describe("calendário", () => {
  it("mostra o mês, os dias da semana e quantos posts há em cada dia", () => {
    renderizar();
    expect(screen.getByRole("heading", { name: "Novembro de 2026" })).toBeInTheDocument();
    for (const d of ["Dom", "Seg", "Sáb"]) expect(screen.getByText(d)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quinta, 5 de novembro: 2 posts" })).toHaveAttribute(
      "aria-current",
      "date",
    );
    expect(screen.getByRole("link", { name: "Sexta, 20 de novembro: 1 post" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sábado, 21 de novembro: nenhum post" })).toBeInTheDocument();
  });

  it("os links dos dias mantêm o mês e o filtro de cliente", () => {
    renderizar({ clienteId: PADARIA });
    expect(screen.getByRole("link", { name: /Sexta, 20 de novembro/ })).toHaveAttribute(
      "href",
      `/painel/calendario?mes=2026-11&dia=2026-11-20&cliente=${PADARIA}`,
    );
    expect(screen.getByRole("link", { name: /Próximo mês/ })).toHaveAttribute(
      "href",
      `/painel/calendario?mes=2026-12&cliente=${PADARIA}`,
    );
  });

  it("a agenda do dia lista os posts em ordem de horário (no fuso de Brasília)", () => {
    renderizar();
    const agenda = screen.getByRole("region", { name: "Quinta, 5 de novembro" });
    const itens = within(agenda).getAllByRole("listitem");
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent("10:00");
    expect(itens[0]).toHaveTextContent("Padaria");
    expect(itens[1]).toHaveTextContent("22:30");
    expect(itens[1]).toHaveTextContent("Academia");
    expect(within(itens[1]).getByText("Aprovado")).toBeInTheDocument();
    expect(within(itens[0]).getByRole("button", { name: "Mudar data" })).toBeInTheDocument();
  });

  it("novo post já vem com o dia escolhido às 10:00", () => {
    renderizar();
    expect(screen.getByTestId("novo-post")).toHaveAttribute("data-agendado", "2026-11-05T10:00");
  });

  it("com filtro, o novo post só oferece aquele cliente", () => {
    renderizar({ clienteId: PADARIA });
    expect(screen.getByTestId("novo-post")).toHaveAttribute("data-clientes", "1");
  });

  it("lista os posts sem data, com a opção de definir", () => {
    renderizar();
    const semData = screen.getByRole("region", { name: "Sem data definida (1)" });
    expect(within(semData).getByText("Ideia sem data")).toBeInTheDocument();
    expect(within(semData).getByRole("button", { name: "Definir data" })).toBeInTheDocument();
  });

  it("legenda de cores dos clientes e atalho para voltar a hoje", () => {
    renderizar({ mes: { ano: 2026, mes: 12 }, diaSelecionado: "2026-12-01", agendados: [] });
    expect(screen.getByRole("list", { name: "Cores dos clientes" })).toHaveTextContent("AcademiaPadaria");
    expect(screen.getByRole("link", { name: "Voltar para hoje" })).toBeInTheDocument();
  });
});
