import type { StatusPost } from "./tipos";

export type Resumo = {
  total: number;
  aprovados: number;
  ajustes: number;
  pendentes: number;
  /** 0 a 100, arredondado. */
  percentual: number;
};

export function resumir(posts: { status: StatusPost }[]): Resumo {
  const visiveis = posts.filter((p) => p.status !== "draft");
  const total = visiveis.length;
  const aprovados = visiveis.filter((p) => p.status === "approved").length;
  const ajustes = visiveis.filter((p) => p.status === "changes_requested").length;
  return {
    total,
    aprovados,
    ajustes,
    pendentes: total - aprovados - ajustes,
    percentual: total === 0 ? 0 : Math.round((aprovados / total) * 100),
  };
}

/** "2 de 6 posts aprovados" / "1 de 1 post aprovado" */
export function textoProgresso({ aprovados, total }: Pick<Resumo, "aprovados" | "total">): string {
  return total === 1
    ? `${aprovados} de 1 post aprovado`
    : `${aprovados} de ${total} posts aprovados`;
}
