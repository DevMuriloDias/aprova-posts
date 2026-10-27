import { describe, expect, it } from "vitest";
import { errosPorCampo, esquemaCadastro, esquemaEntrar, traduzirErroAuth } from "./validacao";

const cadastroValido = {
  nome: "Ana Souza",
  email: "ana@exemplo.com",
  senha: "senhaforte1",
  confirmacao: "senhaforte1",
};

describe("esquemaEntrar", () => {
  it("normaliza o e-mail", () => {
    const r = esquemaEntrar.parse({ email: "  Ana@Exemplo.COM ", senha: "x" });
    expect(r.email).toBe("ana@exemplo.com");
  });

  it("exige e-mail válido e senha", () => {
    const r = esquemaEntrar.safeParse({ email: "ana", senha: "" });
    expect(r.success).toBe(false);
    expect(errosPorCampo(r.error!)).toEqual({
      email: "Informe um e-mail válido.",
      senha: "Informe sua senha.",
    });
  });

  it("pede o e-mail quando vazio", () => {
    const r = esquemaEntrar.safeParse({ email: "", senha: "x" });
    expect(errosPorCampo(r.error!).email).toBe("Informe seu e-mail.");
  });
});

describe("esquemaCadastro", () => {
  it("aceita dados válidos", () => {
    expect(esquemaCadastro.safeParse(cadastroValido).success).toBe(true);
  });

  it("exige senha com pelo menos 8 caracteres", () => {
    const r = esquemaCadastro.safeParse({ ...cadastroValido, senha: "1234567", confirmacao: "1234567" });
    expect(errosPorCampo(r.error!).senha).toBe("A senha precisa ter pelo menos 8 caracteres.");
  });

  it("exige que as senhas confiram", () => {
    const r = esquemaCadastro.safeParse({ ...cadastroValido, confirmacao: "outrasenha" });
    expect(errosPorCampo(r.error!)).toEqual({ confirmacao: "As senhas não conferem." });
  });

  it("exige nome", () => {
    const r = esquemaCadastro.safeParse({ ...cadastroValido, nome: " " });
    expect(errosPorCampo(r.error!).nome).toBe("Informe seu nome.");
  });
});

describe("traduzirErroAuth", () => {
  it("traduz códigos conhecidos", () => {
    expect(traduzirErroAuth({ code: "invalid_credentials" })).toBe("E-mail ou senha incorretos.");
    expect(traduzirErroAuth({ code: "email_not_confirmed" })).toMatch(/Confirme seu e-mail/);
  });

  it("usa mensagem genérica em pt-BR para o resto", () => {
    expect(traduzirErroAuth({ code: "algo_novo", message: "Something failed" })).toBe(
      "Não foi possível concluir agora. Tente novamente em instantes.",
    );
    expect(traduzirErroAuth(null)).toMatch(/Tente novamente/);
  });
});
