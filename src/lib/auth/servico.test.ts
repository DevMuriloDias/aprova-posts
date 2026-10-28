import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MENSAGEM_REENVIO,
  processarCadastro,
  processarEntrada,
  processarReenvio,
  type AuthCliente,
} from "./servico";

function form(campos: Record<string, string>) {
  const fd = new FormData();
  Object.entries(campos).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

function authFalso(respostas: {
  entrar?: { error: unknown };
  cadastrar?: { data: { session: unknown }; error: unknown };
  reenviar?: { data: unknown; error: unknown };
}) {
  return {
    signInWithPassword: vi.fn().mockResolvedValue(respostas.entrar ?? { data: {}, error: null }),
    resend: vi.fn().mockResolvedValue(respostas.reenviar ?? { data: {}, error: null }),
    signUp: vi
      .fn()
      .mockResolvedValue(respostas.cadastrar ?? { data: { session: null, user: {} }, error: null }),
  } as unknown as AuthCliente & {
    signInWithPassword: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    resend: ReturnType<typeof vi.fn>;
  };
}

describe("processarEntrada", () => {
  it("não chama o Supabase se o formulário for inválido", async () => {
    const auth = authFalso({});
    const r = await processarEntrada(auth, form({ email: "x", senha: "" }));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(r).toMatchObject({ tipo: "estado", estado: { erros: { email: expect.any(String) } } });
  });

  it("redireciona para o painel após entrar", async () => {
    const auth = authFalso({});
    const r = await processarEntrada(auth, form({ email: "Ana@Exemplo.com", senha: "segredo123" }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@exemplo.com",
      password: "segredo123",
    });
    expect(r).toEqual({ tipo: "redirecionar", destino: "/painel" });
  });

  it("respeita o ?proximo interno e ignora destino externo", async () => {
    const interno = await processarEntrada(
      authFalso({}),
      form({ email: "a@b.com", senha: "x", proximo: "/painel/clientes" }),
    );
    expect(interno).toEqual({ tipo: "redirecionar", destino: "/painel/clientes" });

    const externo = await processarEntrada(
      authFalso({}),
      form({ email: "a@b.com", senha: "x", proximo: "https://malicioso.com" }),
    );
    expect(externo).toEqual({ tipo: "redirecionar", destino: "/painel" });
  });

  it("mostra erro traduzido e mantém o e-mail (sem a senha)", async () => {
    const auth = authFalso({ entrar: { error: { code: "invalid_credentials" } } });
    const r = await processarEntrada(auth, form({ email: "a@b.com", senha: "errada" }));
    expect(r).toEqual({
      tipo: "estado",
      estado: { erro: "E-mail ou senha incorretos.", valores: { email: "a@b.com" } },
    });
  });
});

describe("processarCadastro", () => {
  const valido = {
    nome: "Ana Souza",
    email: "ana@exemplo.com",
    senha: "senhaforte1",
    confirmacao: "senhaforte1",
  };
  const site = "https://app.exemplo.com";

  it("cadastra com nome nos metadados e link de confirmação do próprio site", async () => {
    const auth = authFalso({});
    const r = await processarCadastro(auth, form(valido), site);
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "ana@exemplo.com",
      password: "senhaforte1",
      options: {
        data: { full_name: "Ana Souza" },
        emailRedirectTo: "https://app.exemplo.com/auth/confirm?proximo=%2Fpainel",
      },
    });
    expect(r).toMatchObject({
      tipo: "estado",
      estado: { sucesso: expect.stringContaining("ana@exemplo.com") },
    });
  });

  it("vai direto ao painel quando o Supabase já devolve a sessão", async () => {
    const auth = authFalso({ cadastrar: { data: { session: { access_token: "x" } }, error: null } });
    expect(await processarCadastro(auth, form(valido), site)).toEqual({
      tipo: "redirecionar",
      destino: "/painel",
    });
  });

  it("valida antes de chamar o Supabase", async () => {
    const auth = authFalso({});
    const r = await processarCadastro(auth, form({ ...valido, confirmacao: "outra" }), site);
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(r).toEqual({
      tipo: "estado",
      estado: {
        erros: { confirmacao: "As senhas não conferem." },
        valores: { nome: "Ana Souza", email: "ana@exemplo.com" },
      },
    });
  });

  it("traduz erros do Supabase", async () => {
    const auth = authFalso({
      cadastrar: { data: { session: null }, error: { code: "user_already_exists" } },
    });
    const r = await processarCadastro(auth, form(valido), site);
    expect(r).toMatchObject({ estado: { erro: "Já existe uma conta com este e-mail." } });
  });
});

describe("registro de erros no terminal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mostra o código e a mensagem do Supabase, sem senha nem e-mail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authFalso({
      cadastrar: {
        data: { session: null },
        error: { code: "unexpected_failure", status: 500, message: "Error sending confirmation email" },
      },
    });
    await processarCadastro(
      auth,
      form({ nome: "Ana", email: "ana@exemplo.com", senha: "senhaforte1", confirmacao: "senhaforte1" }),
      "https://app.exemplo.com",
    );

    expect(log).toHaveBeenCalledOnce();
    const saida = JSON.stringify(log.mock.calls[0]);
    expect(saida).toContain("unexpected_failure");
    expect(saida).toContain("Error sending confirmation email");
    expect(saida).not.toContain("senhaforte1");
    expect(saida).not.toContain("ana@exemplo.com");
  });

  it("também registra falhas ao entrar", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authFalso({ entrar: { error: { code: "invalid_credentials", message: "x" } } });
    await processarEntrada(auth, form({ email: "a@b.com", senha: "errada123" }));
    expect(log.mock.calls[0][0]).toBe("[auth] Falha ao entrar:");
    expect(JSON.stringify(log.mock.calls[0])).not.toContain("errada123");
  });
});

describe("e-mail não confirmado e reenvio", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ao entrar com e-mail não confirmado, oferece o reenvio", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authFalso({ entrar: { error: { code: "email_not_confirmed" } } });
    const r = await processarEntrada(auth, form({ email: "ana@exemplo.com", senha: "x" }));
    expect(r).toMatchObject({ estado: { precisaConfirmar: true, valores: { email: "ana@exemplo.com" } } });
  });

  it("senha errada não oferece reenvio", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authFalso({ entrar: { error: { code: "invalid_credentials" } } });
    const r = await processarEntrada(auth, form({ email: "a@b.com", senha: "x" }));
    expect(r.tipo === "estado" && r.estado.precisaConfirmar).toBeFalsy();
  });

  it("reenvia o e-mail de cadastro com o link de confirmação do site", async () => {
    const auth = authFalso({});
    const r = await processarReenvio(auth, form({ email: " Ana@Exemplo.com " }), "https://app.exemplo.com");
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ana@exemplo.com",
      options: { emailRedirectTo: "https://app.exemplo.com/auth/confirm?proximo=%2Fpainel" },
    });
    expect(r).toEqual({ sucesso: MENSAGEM_REENVIO, valores: { email: "ana@exemplo.com" } });
  });

  it("valida o e-mail antes de chamar o Supabase", async () => {
    const auth = authFalso({});
    const r = await processarReenvio(auth, form({ email: "ana" }), "https://a.com");
    expect(auth.resend).not.toHaveBeenCalled();
    expect(r.erros?.email).toBe("Informe um e-mail válido.");
  });

  it("não revela se o e-mail existe: erros comuns viram a resposta neutra", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authFalso({ reenviar: { data: null, error: { code: "user_not_found" } } });
    const r = await processarReenvio(auth, form({ email: "nao@existe.com" }), "https://a.com");
    expect(r.sucesso).toBe(MENSAGEM_REENVIO);
  });

  it("avisa quando passou do limite de envios", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authFalso({ reenviar: { data: null, error: { code: "over_email_send_rate_limit" } } });
    const r = await processarReenvio(auth, form({ email: "a@b.com" }), "https://a.com");
    expect(r.erro).toMatch(/Aguarde alguns minutos/);
  });
});
