import type { Metadata } from "next";
import { Suspense } from "react";
import { dependenciasPagina } from "@/lib/aprovacao/dependencias";
import { carregarPaginaAprovacao } from "@/lib/aprovacao/pagina";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { decidir } from "./actions";
import { AprovacaoCliente } from "./aprovacao-cliente";

export const metadata: Metadata = {
  title: "Aprovação de posts",
  robots: { index: false, follow: false },
  // O token está na URL: não pode vazar no cabeçalho Referer das imagens.
  referrer: "no-referrer",
};

export default function PaginaLink({ params }: PageProps<"/a/[token]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params }: { params: PageProps<"/a/[token]">["params"] }) {
  const { token } = await params;
  const pagina = await carregarPaginaAprovacao(token, dependenciasPagina(criarClienteAdmin()));

  if (pagina.estado !== "ativo") {
    return <LinkIndisponivel estado={pagina.estado} />;
  }

  return (
    <AprovacaoCliente
      cliente={pagina.cliente}
      postsIniciais={pagina.posts}
      expiraEm={pagina.expiraEm}
      decidir={decidir.bind(null, token)}
    />
  );
}

const TEXTOS = {
  inexistente: {
    titulo: "Link não encontrado",
    texto: "Confira se o endereço foi copiado inteiro ou peça um novo link a quem enviou os posts.",
  },
  expirado: {
    titulo: "Este link expirou",
    texto: "Os links de aprovação valem por 30 dias. Peça um novo link a quem enviou os posts.",
  },
  revogado: {
    titulo: "Este link não está mais ativo",
    texto: "Um link mais novo pode ter sido enviado. Peça o link atualizado a quem enviou os posts.",
  },
} as const;

function LinkIndisponivel({ estado }: { estado: keyof typeof TEXTOS }) {
  const { titulo, texto } = TEXTOS[estado];
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-zinc-200 text-2xl">
        🔒
      </span>
      <h1 className="mt-4 text-xl font-bold text-zinc-900">{titulo}</h1>
      <p className="mt-2 text-sm text-zinc-600">{texto}</p>
    </div>
  );
}

function Carregando() {
  return (
    <div className="mx-auto w-full max-w-lg animate-pulse px-4 pt-6" aria-label="Carregando posts">
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-zinc-200" />
        <div className="h-5 w-40 rounded bg-zinc-200" />
      </div>
      <div className="mt-6 h-2 rounded-full bg-zinc-200" />
      <div className="mt-6 aspect-[4/5] rounded-2xl bg-zinc-200" />
    </div>
  );
}
