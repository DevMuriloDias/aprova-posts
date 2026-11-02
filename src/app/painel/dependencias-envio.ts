"use client";

import { enviarArquivoNoNavegador } from "@/lib/painel/upload-navegador";
import type { DependenciasEnvio } from "@/lib/painel/upload";
import { acaoDescartarEnvios, acaoPrepararEnvio } from "./actions";

/** Envio de mídias pelo navegador: o servidor prepara, o navegador envia direto. */
export const dependenciasEnvio: DependenciasEnvio = {
  preparar: acaoPrepararEnvio,
  enviarArquivo: enviarArquivoNoNavegador,
  descartar: acaoDescartarEnvios,
};
