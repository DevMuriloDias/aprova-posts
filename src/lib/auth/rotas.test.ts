import { describe, expect, it } from "vitest";
import { caminhoSeguro, rotaProtegida, rotaSoDeslogado } from "./rotas";

describe("caminhoSeguro", () => {
  it.each([
    ["/painel", "/painel"],
    ["/painel/clientes?aba=1", "/painel/clientes?aba=1"],
    ["/painel#topo", "/painel#topo"],
  ])("aceita caminho interno %s", (entrada, esperado) => {
    expect(caminhoSeguro(entrada)).toBe(esperado);
  });

  it.each([
    null,
    undefined,
    "",
    "painel",
    "https://malicioso.com",
    "//malicioso.com",
    "/\\malicioso.com",
    "javascript:alert(1)",
  ])("recusa %s e usa o padrão", (entrada) => {
    expect(caminhoSeguro(entrada)).toBe("/painel");
  });

  it("permite outro padrão", () => {
    expect(caminhoSeguro("https://x.com", "/")).toBe("/");
  });
});

describe("rotas", () => {
  it("protege o painel e suas subpáginas", () => {
    expect(rotaProtegida("/painel")).toBe(true);
    expect(rotaProtegida("/painel/clientes")).toBe(true);
    expect(rotaProtegida("/painelx")).toBe(false);
    expect(rotaProtegida("/")).toBe(false);
    expect(rotaProtegida("/entrar")).toBe(false);
  });

  it("identifica telas só para deslogados", () => {
    expect(rotaSoDeslogado("/entrar")).toBe(true);
    expect(rotaSoDeslogado("/cadastro")).toBe(true);
    expect(rotaSoDeslogado("/painel")).toBe(false);
  });
});
