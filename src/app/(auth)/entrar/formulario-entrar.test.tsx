// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const parametros = vi.hoisted(() => ({ valor: new URLSearchParams() }));
const acoes = vi.hoisted(() => ({ entrar: vi.fn(), reenviarConfirmacao: vi.fn() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => parametros.valor }));
vi.mock("../actions", () => acoes);

const { FormularioEntrar } = await import("./formulario-entrar");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  parametros.valor = new URLSearchParams();
});

const formularioReenvio = () => screen.getByRole("form", { name: "Reenviar e-mail de confirmação" });

describe("tela de entrar", () => {
  it("e-mail não confirmado: já mostra o reenvio com o e-mail preenchido", async () => {
    acoes.entrar.mockResolvedValue({
      erro: "Confirme seu e-mail antes de entrar.",
      valores: { email: "ana@exemplo.com" },
      precisaConfirmar: true,
    });
    acoes.reenviarConfirmacao.mockResolvedValue({
      sucesso: "Enviamos um novo link.",
      valores: { email: "ana@exemplo.com" },
    });
    render(<FormularioEntrar />);

    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const reenvio = await screen.findByRole("form", { name: "Reenviar e-mail de confirmação" });
    expect(within(reenvio).getByLabelText("E-mail do cadastro")).toHaveValue("ana@exemplo.com");

    await userEvent.click(within(reenvio).getByRole("button", { name: "Enviar novo link" }));
    expect(await within(formularioReenvio()).findByRole("status")).toHaveTextContent(
      "Enviamos um novo link.",
    );
    const enviado = acoes.reenviarConfirmacao.mock.calls[0][1] as FormData;
    expect(enviado.get("email")).toBe("ana@exemplo.com");
  });

  it("link de confirmação que falhou: explica e oferece um novo link", async () => {
    parametros.valor = new URLSearchParams("erro=link-invalido");
    render(<FormularioEntrar />);
    expect(screen.getByRole("alert")).toHaveTextContent(/seu e-mail pode já estar confirmado/);
    await userEvent.click(screen.getByRole("button", { name: "Reenviar e-mail de confirmação" }));
    expect(formularioReenvio()).toBeInTheDocument();
  });

  it("login normal não mostra o reenvio", () => {
    render(<FormularioEntrar />);
    expect(screen.queryByText("Reenviar e-mail de confirmação")).not.toBeInTheDocument();
  });
});
