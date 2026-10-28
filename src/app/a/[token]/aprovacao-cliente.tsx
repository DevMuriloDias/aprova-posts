"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { resumir, textoProgresso } from "@/lib/aprovacao/progresso";
import type { ClienteDaPagina, PostParaAprovar } from "@/lib/aprovacao/tipos";
import { formatarData } from "@/lib/formatacao";
import { CartaoPost, type FuncaoDecidir } from "./cartao-post";
import { GradePerfil } from "./grade-perfil";

type Props = {
  cliente: ClienteDaPagina;
  postsIniciais: PostParaAprovar[];
  expiraEm: string;
  decidir: FuncaoDecidir;
};

type Aba = "posts" | "grade";

export function AprovacaoCliente({ cliente, postsIniciais, expiraEm, decidir }: Props) {
  const [posts, setPosts] = useState(postsIniciais);
  const [aba, setAba] = useState<Aba>("posts");
  const resumo = resumir(posts);

  function abrirPost(postId: string) {
    setAba("posts");
    requestAnimationFrame(() =>
      document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-12">
      <header className="flex items-center gap-4 px-4 pb-4 pt-6">
        <Avatar nome={cliente.nome} url={cliente.avatarUrl} tamanho="g" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-zinc-900">{cliente.nome}</h1>
          {cliente.instagram && <p className="truncate text-sm text-zinc-600">@{cliente.instagram}</p>}
          <p className="mt-1 text-xs text-zinc-500">Link válido até {formatarData(expiraEm)}</p>
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-fundo/95 px-4 pb-0 pt-3 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900" id="progresso-rotulo">
            {textoProgresso(resumo)}
          </p>
          <p className="text-xs text-zinc-500">
            {[
              resumo.ajustes > 0 && `${resumo.ajustes} com ajuste`,
              resumo.pendentes > 0 && `${resumo.pendentes} aguardando`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div
          role="progressbar"
          aria-labelledby="progresso-rotulo"
          aria-valuemin={0}
          aria-valuemax={resumo.total}
          aria-valuenow={resumo.aprovados}
          className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${resumo.percentual}%` }}
          />
        </div>

        <div role="tablist" aria-label="Visualização" className="mt-3 grid grid-cols-2">
          {(
            [
              ["posts", "Posts"],
              ["grade", "Grade do perfil"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              id={`aba-${valor}`}
              aria-selected={aba === valor}
              aria-controls={`painel-${valor}`}
              onClick={() => setAba(valor)}
              className={`border-b-2 py-2.5 text-sm font-semibold transition ${
                aba === valor
                  ? "border-marca-600 text-marca-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-zinc-600">
          Nenhum post para aprovar no momento.
        </p>
      ) : aba === "posts" ? (
        <div
          role="tabpanel"
          id="painel-posts"
          aria-labelledby="aba-posts"
          className="flex flex-col gap-4 pt-4 sm:px-4"
        >
          {posts.map((post) => (
            <CartaoPost
              key={post.id}
              post={post}
              cliente={cliente}
              decidir={decidir}
              aoDecidir={(r) =>
                setPosts((atuais) =>
                  atuais.map((p) =>
                    p.id === post.id ? { ...p, status: r.status, ultimaDecisao: r.decisao } : p,
                  ),
                )
              }
            />
          ))}
        </div>
      ) : (
        <div role="tabpanel" id="painel-grade" aria-labelledby="aba-grade" className="pt-4 sm:px-4">
          <GradePerfil posts={posts} aoEscolher={abrirPost} />
        </div>
      )}
    </div>
  );
}
