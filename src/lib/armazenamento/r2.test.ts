import { describe, expect, it, vi } from "vitest";
import { lerConfigR2 } from "./config";
import { LIMITE_R2, LIMITE_SUPABASE, limiteDoModo, textoDoLimite } from "./limites";
import { criarArmazenamentoR2 } from "./r2";

const CONFIG = {
  accountId: "conta123",
  accessKeyId: "AKID",
  secretAccessKey: "segredo",
  bucket: "aprova-posts",
};

const resposta = (status = 200, corpo = "") => new Response(corpo || null, { status });

describe("configuração do R2", () => {
  it("sem nenhuma variável, usa o Supabase (null)", () => {
    expect(lerConfigR2({})).toBeNull();
    expect(lerConfigR2({ R2_BUCKET: "  " })).toBeNull();
  });

  it("com todas, devolve a configuração", () => {
    expect(
      lerConfigR2({
        R2_ACCOUNT_ID: "conta123",
        R2_ACCESS_KEY_ID: "AKID",
        R2_SECRET_ACCESS_KEY: "segredo",
        R2_BUCKET: "aprova-posts",
      }),
    ).toEqual(CONFIG);
  });

  it("meio configurado avisa o que falta", () => {
    expect(() => lerConfigR2({ R2_ACCOUNT_ID: "x", R2_BUCKET: "y" })).toThrow(
      /Defina também: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/,
    );
  });

  it("limites por destino", () => {
    expect(limiteDoModo("supabase")).toBe(LIMITE_SUPABASE);
    expect(limiteDoModo("r2")).toBe(LIMITE_R2);
    expect(textoDoLimite(LIMITE_SUPABASE)).toBe("50 MB");
    expect(textoDoLimite(LIMITE_R2)).toBe("500 MB");
  });
});

describe("armazenamento no R2", () => {
  it("links de leitura assinados e temporários, com o caminho codificado", async () => {
    const r2 = criarArmazenamentoR2(CONFIG, vi.fn());
    const urls = await r2.assinarLeitura(["dono/cli/post/0 foto.jpg"]);
    const url = new URL(urls.get("dono/cli/post/0 foto.jpg")!);
    expect(url.origin).toBe("https://conta123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/aprova-posts/dono/cli/post/0%20foto.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(/^AKID\/\d{8}\/auto\/s3\/aws4_request$/);
  });

  it("o link de envio amarra o tipo e o tamanho do arquivo na assinatura", async () => {
    const r2 = criarArmazenamentoR2(CONFIG, vi.fn());
    const destino = await r2.prepararEnvio("dono/cli/post/0-a.mp4", "video/mp4", 123456);
    expect(destino.modo).toBe("r2");
    if (destino.modo !== "r2") return;
    const url = new URL(destino.url);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("1800");
    expect(destino.headers).toEqual({ "content-type": "video/mp4" });

    // Mesmo arquivo com outro tamanho gera outra assinatura (o R2 recusaria).
    const outro = await r2.prepararEnvio("dono/cli/post/0-a.mp4", "video/mp4", 999999999);
    if (outro.modo !== "r2") return;
    expect(new URL(outro.url).searchParams.get("X-Amz-Signature")).not.toBe(
      url.searchParams.get("X-Amz-Signature"),
    );
  });

  it("envia pelo servidor com PUT assinado", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta());
    const r2 = criarArmazenamentoR2(CONFIG, buscar);
    await r2.enviar("dono/cli/post/audios/a.webm", new ArrayBuffer(3), "audio/webm");
    const pedido = buscar.mock.calls[0][0] as Request;
    expect(pedido.method).toBe("PUT");
    expect(pedido.url).toBe("https://conta123.r2.cloudflarestorage.com/aprova-posts/dono/cli/post/audios/a.webm");
    expect(pedido.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\//);
    expect(pedido.headers.get("content-type")).toBe("audio/webm");
  });

  it("falha de envio vira erro", async () => {
    const r2 = criarArmazenamentoR2(CONFIG, vi.fn().mockResolvedValue(resposta(403, "AccessDenied")));
    await expect(r2.enviar("a/b.webm", new ArrayBuffer(1), "audio/webm")).rejects.toThrow(/403/);
  });

  it("apaga cada arquivo; o que já não existe (404) não é erro", async () => {
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(resposta(204))
      .mockResolvedValueOnce(resposta(404));
    const r2 = criarArmazenamentoR2(CONFIG, buscar);
    await r2.apagar(["a/1.jpg", "a/2.jpg"]);
    expect(buscar).toHaveBeenCalledTimes(2);
    expect((buscar.mock.calls[0][0] as Request).method).toBe("DELETE");

    const falha = criarArmazenamentoR2(CONFIG, vi.fn().mockResolvedValue(resposta(500, "erro")));
    await expect(falha.apagar(["a/1.jpg"])).rejects.toThrow(/500/);
  });
});
