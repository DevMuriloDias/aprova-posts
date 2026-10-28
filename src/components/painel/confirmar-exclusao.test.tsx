// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmarExclusao } from "./confirmar-exclusao";

afterEach(cleanup);

describe("confirmação de exclusão", () => {
  it("exige digitar o nome do cliente antes de excluir", async () => {
    const acao = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ConfirmarExclusao
        rotulo="Excluir cliente"
        titulo="Excluir Padaria?"
        descricao="Apaga tudo."
        confirmarDigitando="Padaria"
        acao={acao}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Excluir cliente" }));
    const dialogo = screen.getByRole("alertdialog", { name: "Excluir Padaria?" });
    expect(dialogo).toBeInTheDocument();

    const excluir = screen.getByRole("button", { name: "Excluir" });
    expect(excluir).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Para confirmar/), "padari");
    expect(excluir).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Para confirmar/), "a");
    expect(excluir).toBeEnabled();

    await userEvent.click(excluir);
    expect(acao).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancelar ou Esc fecha sem excluir", async () => {
    const acao = vi.fn();
    render(<ConfirmarExclusao rotulo="Excluir" titulo="Excluir este post?" descricao="x" acao={acao} />);
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(acao).not.toHaveBeenCalled();
  });

  it("mostra o erro e continua aberto quando a exclusão falha", async () => {
    render(
      <ConfirmarExclusao
        rotulo="Excluir"
        titulo="Excluir este post?"
        descricao="x"
        acao={vi.fn().mockResolvedValue({ ok: false, erro: "Post não encontrado." })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Excluir" })[1]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Post não encontrado.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
