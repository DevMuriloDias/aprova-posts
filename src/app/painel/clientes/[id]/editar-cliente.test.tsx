// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const acaoEditarCliente = vi.fn();
const enviarMidias = vi.fn();
const descartarMidias = vi.fn();
const refresh = vi.fn();

vi.mock("../../actions", () => ({ acaoEditarCliente: (...a: unknown[]) => acaoEditarCliente(...a) }));
vi.mock("../../dependencias-envio", () => ({ dependenciasEnvio: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/painel/upload", () => ({
  enviarMidias: (...a: unknown[]) => enviarMidias(...a),
  descartarMidias: (...a: unknown[]) => descartarMidias(...a),
}));

const { EditarCliente } = await import("./editar-cliente");

const ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const comFoto: { id: string; nome: string; instagram: string | null; avatarUrl: string | null } = {
  id: ID,
  nome: "Padaria",
  instagram: "padaria",
  avatarUrl: "https://exemplo/foto.jpg",
};

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:previa");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  vi.clearAllMocks();
  acaoEditarCliente.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

async function abrir(cliente = comFoto) {
  const u = userEvent.setup();
  render(<EditarCliente cliente={cliente} limiteBytes={50 * 1024 * 1024} />);
  await u.click(screen.getByRole("button", { name: "Editar cliente" }));
  return u;
}

describe("EditarCliente", () => {
  it("troca a foto: envia a imagem e salva com o caminho novo", async () => {
    enviarMidias.mockResolvedValue({ ok: true, midias: [{ caminho: `x/${ID}/avatar-n.jpg`, tipo: "image" }] });
    const u = await abrir();
    const foto = new File(["x"], "nova.png", { type: "image/png" });
    await u.upload(screen.getByLabelText("Foto de perfil"), foto);
    expect(screen.getByAltText("Foto de perfil")).toHaveAttribute("src", "blob:previa");
    await u.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(acaoEditarCliente).toHaveBeenCalled());
    expect(enviarMidias).toHaveBeenCalledWith({ destino: "avatar", clienteId: ID }, [foto], {});
    expect(acaoEditarCliente).toHaveBeenCalledWith({
      id: ID,
      nome: "Padaria",
      instagram: "padaria",
      avatarPath: `x/${ID}/avatar-n.jpg`,
      removerFoto: false,
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Editar cliente" })).toBeInTheDocument();
  });

  it("tira a foto atual sem enviar nada", async () => {
    const u = await abrir();
    await u.click(screen.getByRole("checkbox", { name: "Tirar a foto atual" }));
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(acaoEditarCliente).toHaveBeenCalled());
    expect(enviarMidias).not.toHaveBeenCalled();
    expect(acaoEditarCliente.mock.calls[0][0]).toMatchObject({ avatarPath: undefined, removerFoto: true });
  });

  it("cliente sem foto: não mostra 'Tirar a foto atual' e salva só o nome", async () => {
    const u = await abrir({ ...comFoto, avatarUrl: null });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    const nome = screen.getByLabelText("Nome do cliente");
    await u.clear(nome);
    await u.type(nome, "Padaria Nova");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(acaoEditarCliente).toHaveBeenCalled());
    expect(acaoEditarCliente.mock.calls[0][0]).toMatchObject({ nome: "Padaria Nova", removerFoto: false });
  });

  it("recusa arquivo que não é imagem", async () => {
    const u = userEvent.setup({ applyAccept: false });
    render(<EditarCliente cliente={comFoto} limiteBytes={50 * 1024 * 1024} />);
    await u.click(screen.getByRole("button", { name: "Editar cliente" }));
    await u.upload(screen.getByLabelText("Foto de perfil"), new File(["x"], "v.mp4", { type: "video/mp4" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("se salvar falhar, descarta a foto enviada e mostra o erro", async () => {
    enviarMidias.mockResolvedValue({ ok: true, midias: [{ caminho: "x/a.jpg", tipo: "image" }] });
    acaoEditarCliente.mockResolvedValue({ ok: false, erro: "Cliente não encontrado." });
    const u = await abrir();
    await u.upload(screen.getByLabelText("Foto de perfil"), new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Cliente não encontrado.")).toBeInTheDocument();
    expect(descartarMidias).toHaveBeenCalledWith({}, [{ caminho: "x/a.jpg" }]);
    expect(refresh).not.toHaveBeenCalled();
  });
});
