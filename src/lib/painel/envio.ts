import type { Armazenamento, DestinoEnvio } from "@/lib/armazenamento/tipos";
import type { Resultado } from "./servico";
import {
  MAXIMO_MIDIAS_POR_POST,
  caminhoDaCapa,
  caminhoDaMidia,
  caminhoDoAvatar,
  problemaNoArquivo,
} from "./validacao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ArquivoParaEnviar = { nome: string; tipo: string; tamanho: number };

export type PedidoEnvio =
  | { destino: "post"; clienteId: string; postId: string; arquivos: ArquivoParaEnviar[] }
  | { destino: "capa"; clienteId: string; postId: string; arquivos: ArquivoParaEnviar[] }
  | { destino: "avatar"; clienteId: string; arquivos: ArquivoParaEnviar[] };

/**
 * Prepara o envio direto do navegador. Os caminhos ficam sempre na pasta do
 * usuário logado ("<dono>/<cliente>/..."), então ninguém grava na pasta de
 * outro. Se o cliente ou o post não forem dele, o banco recusa depois
 * (create_post / clients) e o app apaga o que subiu.
 */
export async function prepararEnvios(
  pedido: PedidoEnvio,
  donoId: string,
  arm: Pick<Armazenamento, "prepararEnvio" | "limiteBytes">,
  aleatorio: () => string = () => crypto.randomUUID().slice(0, 8),
): Promise<Resultado<{ destinos: DestinoEnvio[] }>> {
  if (!UUID.test(pedido.clienteId) || (pedido.destino !== "avatar" && !UUID.test(pedido.postId))) {
    return { ok: false, erro: "Envio inválido." };
  }
  const { arquivos } = pedido;
  const soUmaImagem = pedido.destino !== "post";
  const maximo = soUmaImagem ? 1 : MAXIMO_MIDIAS_POR_POST;
  if (arquivos.length === 0) return { ok: false, erro: "Adicione pelo menos uma foto ou vídeo." };
  if (arquivos.length > maximo) {
    return {
      ok: false,
      erro:
        pedido.destino === "avatar"
          ? "Escolha só uma foto de perfil."
          : pedido.destino === "capa"
            ? "Escolha só uma imagem para a capa."
            : `Um post pode ter no máximo ${MAXIMO_MIDIAS_POR_POST} mídias.`,
    };
  }

  for (const a of arquivos) {
    const problema = problemaNoArquivo(
      { name: a.nome, type: a.tipo, size: a.tamanho },
      { apenasImagem: soUmaImagem, limiteBytes: arm.limiteBytes },
    );
    if (problema) return { ok: false, erro: problema };
  }

  const destinos = await Promise.all(
    arquivos.map((a, i) =>
      arm.prepararEnvio(
        pedido.destino === "avatar"
          ? caminhoDoAvatar(donoId, pedido.clienteId, a.nome, aleatorio())
          : pedido.destino === "capa"
            ? caminhoDaCapa(donoId, pedido.clienteId, pedido.postId, a.nome, aleatorio())
            : caminhoDaMidia(donoId, pedido.clienteId, pedido.postId, i, a.nome, aleatorio()),
        a.tipo,
        a.tamanho,
      ),
    ),
  );
  return { ok: true, destinos };
}

/** Apaga envios que não chegaram a ser usados (ex.: o post não foi salvo). */
export async function descartarEnvios(
  caminhos: string[],
  donoId: string,
  arm: Pick<Armazenamento, "apagar">,
): Promise<Resultado> {
  const daPastaDoDono = (c: string) => c.startsWith(`${donoId}/`) && !c.includes("..");
  if (caminhos.length === 0) return { ok: true };
  if (caminhos.length > MAXIMO_MIDIAS_POR_POST || !caminhos.every(daPastaDoDono)) {
    return { ok: false, erro: "Envio inválido." };
  }
  await arm.apagar(caminhos);
  return { ok: true };
}
