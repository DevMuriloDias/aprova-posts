import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (_url: string, _key: string, opcoes: { cookies: { setAll: (c: unknown[], h: object) => void } }) => ({
      auth: {
        getClaims: async () => {
          // Simula a renovação da sessão gravando um cookie novo.
          opcoes.cookies.setAll(
            [{ name: "sb-token", value: "renovado", options: { path: "/" } }],
            { "Cache-Control": "private, no-store" },
          );
          return getClaims();
        },
      },
    }),
  ),
}));

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

const { atualizarSessao } = await import("./proxy");

function req(caminho: string) {
  return new NextRequest(new URL(caminho, "http://localhost:3000"));
}

const logado = { data: { claims: { sub: "user-1" } }, error: null };
const deslogado = { data: null, error: null };

describe("atualizarSessao", () => {
  beforeEach(() => getClaims.mockReset());

  it("manda quem não está logado do painel para /entrar, guardando o destino", async () => {
    getClaims.mockResolvedValue(deslogado);
    const r = await atualizarSessao(req("/painel/clientes?aba=1"));
    expect(r.status).toBe(307);
    const destino = new URL(r.headers.get("location")!);
    expect(destino.pathname).toBe("/entrar");
    expect(destino.searchParams.get("proximo")).toBe("/painel/clientes?aba=1");
  });

  it("manda quem está logado de /entrar e /cadastro para o painel", async () => {
    getClaims.mockResolvedValue(logado);
    for (const caminho of ["/entrar", "/cadastro"]) {
      const r = await atualizarSessao(req(caminho));
      expect(new URL(r.headers.get("location")!).pathname).toBe("/painel");
    }
  });

  it("deixa passar quando a rota é permitida", async () => {
    getClaims.mockResolvedValue(logado);
    expect((await atualizarSessao(req("/painel"))).headers.get("location")).toBeNull();

    getClaims.mockResolvedValue(deslogado);
    expect((await atualizarSessao(req("/"))).headers.get("location")).toBeNull();
    expect((await atualizarSessao(req("/entrar"))).headers.get("location")).toBeNull();
  });

  it("repassa os cookies renovados e os cabeçalhos anti-cache, inclusive no redirecionamento", async () => {
    getClaims.mockResolvedValue(logado);
    const normal = await atualizarSessao(req("/painel"));
    expect(normal.cookies.get("sb-token")?.value).toBe("renovado");
    expect(normal.headers.get("cache-control")).toBe("private, no-store");

    const redirect = await atualizarSessao(req("/entrar"));
    expect(redirect.cookies.get("sb-token")?.value).toBe("renovado");
    expect(redirect.headers.get("cache-control")).toBe("private, no-store");
  });
});
