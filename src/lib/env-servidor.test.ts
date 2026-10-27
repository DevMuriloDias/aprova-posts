import { describe, expect, it } from "vitest";
import { lerEnvServidor } from "./env-servidor";

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
