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
});
