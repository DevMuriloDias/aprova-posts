/* eslint-disable @next/next/no-img-element -- URLs assinadas e temporárias do Storage */

import { CORES_PONTO, ROTULOS_STATUS } from "@/components/status-post";
import type { PostParaAprovar } from "@/lib/aprovacao/tipos";

type Props = {
  posts: PostParaAprovar[];
  aoEscolher: (postId: string) => void;
};

/** Ordem do perfil: o último a ser publicado aparece primeiro. */
export function ordemDaGrade(posts: PostParaAprovar[]): PostParaAprovar[] {
  return [...posts].reverse();
}

export function GradePerfil({ posts, aoEscolher }: Props) {
  const ordenados = ordemDaGrade(posts);
  return (
    <div>
      <p className="px-4 pb-3 text-sm text-zinc-600 sm:px-0">
        Prévia de como o perfil vai ficar com os próximos posts (o mais recente primeiro).
      </p>
      <ul className="grid grid-cols-3 gap-0.5">
        {ordenados.map((post, i) => {
          const capa = post.midias[0];
          return (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => aoEscolher(post.id)}
                aria-label={`Abrir post ${i + 1} (${ROTULOS_STATUS[post.status]})`}
                className="relative block aspect-[3/4] w-full overflow-hidden bg-zinc-200"
              >
                {capa?.url && capa.tipo === "image" && (
                  <img src={capa.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
                {capa?.url && capa.tipo === "video" && (
                  <video src={capa.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                )}
                {post.midias.length > 1 && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-zinc-900/70 px-1.5 text-[10px] font-semibold text-white">
                    carrossel
                  </span>
                )}
                {capa?.tipo === "video" && post.midias.length === 1 && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-zinc-900/70 px-1.5 text-[10px] font-semibold text-white">
                    vídeo
                  </span>
                )}
                <span
                  aria-hidden
                  className={`absolute bottom-1.5 left-1.5 size-3 rounded-full ring-2 ring-white ${CORES_PONTO[post.status]}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-zinc-600 sm:px-0">
        {(["approved", "changes_requested", "pending_approval"] as const).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2.5 rounded-full ${CORES_PONTO[status]}`} />
            {ROTULOS_STATUS[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}
