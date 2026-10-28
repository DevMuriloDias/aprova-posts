import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarPeloResend, montarEmailDecisao, notificarDecisao, type InfoAviso } from "./email";

const SITE = "https://aprova-posts.vercel.app";

function info(extra: Partial<InfoAviso> = {}): InfoAviso {
  return {
    email: "ana@exemplo.com",
    owner_name: "Ana Souza",
    client_id: "cli-1",
    client_name: "Padaria do Bairro",
    post_id: "post-1",
    caption: "Sexta é dia de pão de fermentação natural",
    action: "changes_requested",
    comment: "Trocar a foto",
    has_audio: false,
    remaining: 3,
    total: 6,
    ...extra,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("montarEmailDecisao", () => {
  it("avisa todo pedido de ajuste, com comentário e link para o cliente no painel", () => {
    const email = montarEmailDecisao(info(), SITE)!;
    expect(email.para).toBe("ana@exemplo.com");
    expect(email.assunto).toBe("Padaria do Bairro pediu ajuste em um post");
    expect(email.texto).toContain("Oi, Ana!");
    expect(email.texto).toContain("“Sexta é dia de pão de fermentação natural”");
    expect(email.texto).toContain("Comentário: “Trocar a foto”");
    expect(email.texto).toContain(`${SITE}/painel/clientes/cli-1`);
    expect(email.html).toContain(`href="${SITE}/painel/clientes/cli-1"`);
  });

  it("menciona o áudio quando o cliente gravou um", () => {
    const email = montarEmailDecisao(info({ comment: null, has_audio: true }), SITE)!;
    expect(email.texto).toContain("O cliente também enviou um áudio");
    expect(email.texto).not.toContain("Comentário:");
  });

  it("avisa quando o cliente aprova o último post pendente", () => {
    const email = montarEmailDecisao(info({ action: "approved", comment: null, remaining: 0 }), SITE)!;
    expect(email.assunto).toBe("Padaria do Bairro aprovou todos os posts");
    expect(email.texto).toContain("aprovou os 6 posts");
  });

  it("não avisa aprovações no meio do caminho", () => {
    expect(montarEmailDecisao(info({ action: "approved", remaining: 2 }), SITE)).toBeNull();
  });

  it("sem e-mail do dono, não monta nada", () => {
    expect(montarEmailDecisao(info({ email: null }), SITE)).toBeNull();
  });

  it("escapa o texto do cliente no HTML", () => {
    const email = montarEmailDecisao(
      info({ client_name: "<b>Loja</b>", comment: '<script>alert("x")</script>' }),
      SITE,
    )!;
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<b>Loja</b>");
  });

  it("encurta legendas longas", () => {
    const email = montarEmailDecisao(info({ caption: "a".repeat(200) }), SITE)!;
    expect(email.texto).toMatch(/“a{79}…”/);
  });
});

describe("enviarPeloResend", () => {
  it("chama a API do Resend com a chave e o remetente", async () => {
    const buscar = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const email = montarEmailDecisao(info(), SITE)!;
    const ok = await enviarPeloResend({ apiKey: "re_123", remetente: "Aprova <a@b.com>" }, email, buscar);
    expect(ok).toBe(true);
    const [url, opcoes] = buscar.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opcoes.headers.Authorization).toBe("Bearer re_123");
    expect(JSON.parse(opcoes.body)).toMatchObject({
      from: "Aprova <a@b.com>",
      to: ["ana@exemplo.com"],
      subject: email.assunto,
    });
  });

  it("retorna false quando o Resend recusa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const buscar = vi.fn().mockResolvedValue(new Response("domínio não verificado", { status: 403 }));
    expect(
      await enviarPeloResend({ apiKey: "x", remetente: "y" }, montarEmailDecisao(info(), SITE)!, buscar),
    ).toBe(false);
  });
});

describe("notificarDecisao", () => {
  it("sem e-mail configurado, não faz nada", async () => {
    const buscarInfo = vi.fn();
    expect(await notificarDecisao("evt", { buscarInfo, enviar: null, siteUrl: SITE })).toBe("desligado");
    expect(buscarInfo).not.toHaveBeenCalled();
  });

  it("busca os dados do evento e envia", async () => {
    const enviar = vi.fn().mockResolvedValue(true);
    const buscarInfo = vi.fn().mockResolvedValue(info());
    expect(await notificarDecisao("evt-1", { buscarInfo, enviar, siteUrl: SITE })).toBe("enviado");
    expect(buscarInfo).toHaveBeenCalledWith("evt-1");
    expect(enviar.mock.calls[0][0].assunto).toContain("pediu ajuste");
  });

  it("não envia quando não vale avisar", async () => {
    const enviar = vi.fn();
    const buscarInfo = vi.fn().mockResolvedValue(info({ action: "approved", remaining: 1 }));
    expect(await notificarDecisao("evt", { buscarInfo, enviar, siteUrl: SITE })).toBe("sem_aviso");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("nunca lança erro (a resposta do cliente já foi gravada)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const buscarInfo = vi.fn().mockRejectedValue(new Error("banco fora do ar"));
    expect(await notificarDecisao("evt", { buscarInfo, enviar: vi.fn(), siteUrl: SITE })).toBe("falhou");
    expect(
      await notificarDecisao("evt", {
        buscarInfo: vi.fn().mockResolvedValue({ formato: "errado" }),
        enviar: vi.fn(),
        siteUrl: SITE,
      }),
    ).toBe("falhou");
  });
});
