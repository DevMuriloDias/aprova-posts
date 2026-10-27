import { describe, expect, it, vi } from "vitest";
import { processarCadastro, processarEntrada, type AuthCliente } from "./servico";

function form(campos: Record<string, string>) {
  const fd = new FormData();
  Object.entries(campos).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

function authFalso(respostas: {
  entrar?: { error: unknown };
  cadastrar?: { data: { session: unknown }; error: unknown };
}) {
  return {
    signInWithPassword: vi.fn().mockResolvedValue(respostas.entrar ?? { data: {}, error: null }),
    signUp: vi
      .fn()
      .mockResolvedValue(respostas.cadastrar ?? { data: { session: null, user: {} }, error: null }),
  } as unknown as AuthCliente & {
    signInWithPassword: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
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
