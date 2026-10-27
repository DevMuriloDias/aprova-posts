import type { StatusPost } from "@/lib/aprovacao/tipos";

export const ROTULOS_STATUS: Record<StatusPost, string> = {
  draft: "Rascunho",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  changes_requested: "Ajuste pedido",
};

const ESTILOS: Record<StatusPost, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  pending_approval: "bg-sky-50 text-sky-800",
  approved: "bg-emerald-50 text-emerald-800",
  changes_requested: "bg-amber-50 text-amber-900",
};

export const CORES_PONTO: Record<StatusPost, string> = {
  draft: "bg-zinc-400",
  pending_approval: "bg-sky-500",
  approved: "bg-emerald-500",
  changes_requested: "bg-amber-500",
};

export function StatusPostSelo({ status }: { status: StatusPost }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ESTILOS[status]}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${CORES_PONTO[status]}`} />
      {ROTULOS_STATUS[status]}
    </span>
  );
}
