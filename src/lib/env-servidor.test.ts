import { describe, expect, it } from "vitest";
import { REMETENTE_PADRAO, lerConfigEmail, lerEnvServidor } from "./env-servidor";

describe("lerEnvServidor", () => {
  it("aceita a chave secreta", () => {
    expect(lerEnvServidor({ SUPABASE_SECRET_KEY: "sb_secret_x" })).toEqual({
      SUPABASE_SECRET_KEY: "sb_secret_x",
    });
  });

  it("explica em pt-BR quando falta", () => {
    expect(() => lerEnvServidor({})).toThrow(/SUPABASE_SECRET_KEY não foi definida/);
    expect(() => lerEnvServidor({ SUPABASE_SECRET_KEY: "" })).toThrow(/Confira o \.env\.local/);
  });
});

describe("lerConfigEmail", () => {
  it("sem RESEND_API_KEY, os avisos por e-mail ficam desligados", () => {
    expect(lerConfigEmail({})).toBeNull();
    expect(lerConfigEmail({ RESEND_API_KEY: "  " })).toBeNull();
  });

  it("usa o remetente padrão do Resend quando não há EMAIL_REMETENTE", () => {
    expect(lerConfigEmail({ RESEND_API_KEY: "re_1" })).toEqual({
      apiKey: "re_1",
      remetente: REMETENTE_PADRAO,
    });
    expect(
      lerConfigEmail({ RESEND_API_KEY: "re_1", EMAIL_REMETENTE: "Avisos <avisos@meusite.com>" })
        ?.remetente,
    ).toBe("Avisos <avisos@meusite.com>");
  });
});
