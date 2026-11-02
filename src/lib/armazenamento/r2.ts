import { AwsClient } from "aws4fetch";
import type { ConfigR2 } from "./config";
import { LIMITE_R2 } from "./limites";
import { VALIDADE_URL_SEGUNDOS, type Armazenamento } from "./tipos";

/** Codifica cada parte do caminho (os "/" continuam separando pastas). */
function codificar(caminho: string): string {
  return caminho.split("/").map(encodeURIComponent).join("/");
}

/** Validade do link de envio: suficiente para um vídeo grande no 4G. */
const VALIDADE_ENVIO_SEGUNDOS = 30 * 60;

export function criarArmazenamentoR2(
  config: ConfigR2,
  buscar: typeof fetch = fetch,
  /** Outro endereço compatível com S3 (usado nos testes). */
  endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`,
): Armazenamento {
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const base = `${endpoint}/${config.bucket}`;
  const url = (caminho: string, validade?: number) => {
    const u = new URL(`${base}/${codificar(caminho)}`);
    if (validade) u.searchParams.set("X-Amz-Expires", String(validade));
    return u.toString();
  };

  async function exigirOk(resposta: Response, acao: string) {
    if (!resposta.ok) {
      throw new Error(`R2 recusou ${acao} (${resposta.status}): ${await resposta.text()}`);
    }
  }

  return {
    modo: "r2",
    limiteBytes: LIMITE_R2,

    async assinarLeitura(caminhos) {
      const urls = new Map<string, string>();
      await Promise.all(
        caminhos.map(async (caminho) => {
          const assinado = await aws.sign(url(caminho, VALIDADE_URL_SEGUNDOS), {
            method: "GET",
            aws: { signQuery: true },
          });
          urls.set(caminho, assinado.url);
        }),
      );
      return urls;
    },

    async prepararEnvio(caminho, tipo, tamanho) {
      // Tipo e tamanho entram na assinatura: o R2 recusa o envio se o
      // navegador mandar outro arquivo (maior ou de outro tipo).
      const headers = { "content-type": tipo, "content-length": String(tamanho) };
      const assinado = await aws.sign(url(caminho, VALIDADE_ENVIO_SEGUNDOS), {
        method: "PUT",
        headers,
        aws: { signQuery: true, allHeaders: true },
      });
      return { modo: "r2", caminho, url: assinado.url, headers: { "content-type": tipo } };
    },

    async enviar(caminho, bytes, tipo) {
      const pedido = await aws.sign(url(caminho), {
        method: "PUT",
        body: bytes,
        headers: { "content-type": tipo },
      });
      await exigirOk(await buscar(pedido), "o envio");
    },

    async apagar(caminhos) {
      // Em lotes, para não abrir centenas de conexões de uma vez.
      for (let i = 0; i < caminhos.length; i += 20) {
        await Promise.all(
          caminhos.slice(i, i + 20).map(async (caminho) => {
            const pedido = await aws.sign(url(caminho), { method: "DELETE" });
            const resposta = await buscar(pedido);
            // 404: já não existia, tudo certo.
            if (resposta.status !== 404) await exigirOk(resposta, "a exclusão");
          }),
        );
      }
    },
  };
}
