"use client";

import type { DestinoEnvio } from "@/lib/armazenamento/tipos";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { BUCKET } from "./constantes";
import type { DependenciasEnvio } from "./upload";

/** Envia para o link assinado do R2, informando o progresso. */
function enviarParaR2(
  destino: Extract<DestinoEnvio, { modo: "r2" }>,
  arquivo: File,
  aoProgresso: (fracao: number) => void,
): Promise<boolean> {
  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", destino.url);
    for (const [nome, valor] of Object.entries(destino.headers)) xhr.setRequestHeader(nome, valor);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) aoProgresso(e.loaded / e.total);
    };
    xhr.onload = () => resolver(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolver(false);
    xhr.ontimeout = () => resolver(false);
    xhr.send(arquivo);
  });
}

export const enviarArquivoNoNavegador: DependenciasEnvio["enviarArquivo"] = async (
  destino,
  arquivo,
  aoProgresso,
) => {
  if (destino.modo === "r2") return enviarParaR2(destino, arquivo, aoProgresso);
  // Supabase: envia com a sessão do usuário (o RLS do storage limita à pasta dele).
  const { error } = await criarClienteNavegador()
    .storage.from(BUCKET)
    .upload(destino.caminho, arquivo, { contentType: arquivo.type });
  aoProgresso(1);
  return !error;
};
