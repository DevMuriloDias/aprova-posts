import { describe, expect, it } from "vitest";
import { lerEnvPublico } from "./env";

const valido = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("lerEnvPublico", () => {
  it("aceita variáveis válidas", () => {
    expect(lerEnvPublico(valido)).toEqual(valido);
  });

  it("explica em pt-BR o que está faltando", () => {
    expect(() =>
      lerEnvPublico({ ...valido, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined }),
    ).toThrow(/Copie \.env\.example para \.env\.local/);
    expect(() => lerEnvPublico({ ...valido, NEXT_PUBLIC_SUPABASE_URL: "nao-e-url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida/,
    );
  });

  it("recusa a URL do Supabase com caminho no final (ex.: /rest/v1/)", () => {
    for (const url of ["https://abc.supabase.co/rest/v1/", "https://abc.supabase.co/rest/v1"]) {
      expect(() => lerEnvPublico({ ...valido, NEXT_PUBLIC_SUPABASE_URL: url })).toThrow(
        /sem nada depois do domínio/,
      );
    }
  });

  it("aceita a URL base com ou sem barra final", () => {
    expect(
      lerEnvPublico({ ...valido, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/" })
        .NEXT_PUBLIC_SUPABASE_URL,
    ).toBe("https://abc.supabase.co/");
  });
});
