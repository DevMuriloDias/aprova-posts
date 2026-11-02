// Copia as mídias do Supabase Storage (bucket post-media) para o Cloudflare R2,
// mantendo os mesmos caminhos. Não apaga nada do Supabase e pode ser rodado de
// novo: o que já está no R2 com o mesmo tamanho é pulado.
//
// Uso (na pasta do projeto, com o .env.local preenchido, inclusive as R2_*):
//   node --env-file=.env.local scripts/migrar-midias-para-r2.mjs

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const BUCKET_SUPABASE = "post-media";

/** Lista todos os arquivos do bucket, entrando nas pastas. */
export async function listarTudo(listar, prefixo = "") {
  const arquivos = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await listar(prefixo, { limit: 1000, offset });
    if (error) throw new Error(`Falha ao listar "${prefixo}": ${error.message}`);
    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      if (item.id === null) {
        arquivos.push(...(await listarTudo(listar, caminho)));
      } else {
        arquivos.push({
          caminho,
          tamanho: item.metadata?.size ?? null,
          tipo: item.metadata?.mimetype ?? "application/octet-stream",
        });
      }
    }
    if (data.length < 1000) return arquivos;
  }
}

/** Copia cada arquivo que ainda não está no destino. */
export async function copiarTudo({ arquivos, tamanhoNoDestino, baixar, enviar, log = () => {} }) {
  const resumo = { copiados: 0, pulados: 0, falhas: [] };
  for (const [i, a] of arquivos.entries()) {
    const prefixo = `[${i + 1}/${arquivos.length}]`;
    try {
      const existente = await tamanhoNoDestino(a.caminho);
      if (existente !== null && (a.tamanho === null || existente === a.tamanho)) {
        resumo.pulados += 1;
        log(`${prefixo} já está no R2: ${a.caminho}`);
        continue;
      }
      const bytes = await baixar(a.caminho);
      await enviar(a.caminho, bytes, a.tipo);
      resumo.copiados += 1;
      log(`${prefixo} copiado: ${a.caminho}`);
    } catch (erro) {
      resumo.falhas.push({ caminho: a.caminho, erro: String(erro?.message ?? erro) });
      log(`${prefixo} FALHOU: ${a.caminho} (${erro?.message ?? erro})`);
    }
  }
  return resumo;
}

function exigir(nome) {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    console.error(`Falta a variável ${nome} no .env.local.`);
    process.exit(1);
  }
  return valor;
}

async function principal() {
  const supabase = createClient(exigir("NEXT_PUBLIC_SUPABASE_URL"), exigir("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false },
  });
  const bucket = supabase.storage.from(BUCKET_SUPABASE);
  const aws = new AwsClient({
    accessKeyId: exigir("R2_ACCESS_KEY_ID"),
    secretAccessKey: exigir("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const base = `https://${exigir("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${exigir("R2_BUCKET")}`;
  const urlR2 = (caminho) => `${base}/${caminho.split("/").map(encodeURIComponent).join("/")}`;

  console.log("Listando os arquivos do Supabase…");
  const arquivos = await listarTudo((prefixo, opcoes) => bucket.list(prefixo, opcoes));
  console.log(`${arquivos.length} arquivo(s) encontrados.\n`);

  const resumo = await copiarTudo({
    arquivos,
    log: console.log,
    async tamanhoNoDestino(caminho) {
      const r = await aws.fetch(urlR2(caminho), { method: "HEAD" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`R2 respondeu ${r.status} ao conferir o arquivo`);
      return Number(r.headers.get("content-length"));
    },
    async baixar(caminho) {
      const { data, error } = await bucket.download(caminho);
      if (error) throw new Error(`download: ${error.message}`);
      return await data.arrayBuffer();
    },
    async enviar(caminho, bytes, tipo) {
      const r = await aws.fetch(urlR2(caminho), {
        method: "PUT",
        body: bytes,
        headers: { "content-type": tipo },
      });
      if (!r.ok) throw new Error(`R2 respondeu ${r.status}: ${await r.text()}`);
    },
  });

  console.log(
    `\nPronto: ${resumo.copiados} copiado(s), ${resumo.pulados} já estavam no R2, ${resumo.falhas.length} falha(s).`,
  );
  if (resumo.falhas.length > 0) {
    console.log("Rode o script de novo para tentar as que falharam.");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro) => {
    console.error("Erro:", erro.message ?? erro);
    process.exit(1);
  });
}
