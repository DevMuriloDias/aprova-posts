"use client";

import { ConfirmarExclusao } from "@/components/painel/confirmar-exclusao";
import { acaoExcluirCliente, acaoExcluirPost } from "../../actions";

export function ExcluirCliente({ clienteId, nome, totalPosts }: { clienteId: string; nome: string; totalPosts: number }) {
  return (
    <ConfirmarExclusao
      rotulo="Excluir cliente"
      titulo={`Excluir ${nome}?`}
      descricao={`Isso apaga o cliente, ${
        totalPosts === 1 ? "o post" : `os ${totalPosts} posts`
      }, as fotos, os áudios, o link de aprovação e todo o histórico de respostas. Não dá para desfazer.`}
      confirmarDigitando={nome}
      acao={() => acaoExcluirCliente(clienteId)}
    />
  );
}

export function ExcluirPost({ postId, clienteId }: { postId: string; clienteId: string }) {
  return (
    <ConfirmarExclusao
      rotulo="Excluir"
      variante="link"
      titulo="Excluir este post?"
      descricao="O post, as mídias e o histórico de respostas dele serão apagados. Não dá para desfazer."
      acao={() => acaoExcluirPost(postId, clienteId)}
    />
  );
}
