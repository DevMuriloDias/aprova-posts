import { z } from "zod";

export const STATUS_VISIVEIS = ["pending_approval", "approved", "changes_requested"] as const;
export type StatusPost = (typeof STATUS_VISIVEIS)[number] | "draft";
export type Decisao = "approved" | "changes_requested";

/** Formato do JSON devolvido por public.get_approval_page. */
export const esquemaPaginaBanco = z.discriminatedUnion("state", [
  z.object({ state: z.literal("revoked") }),
  z.object({ state: z.literal("expired") }),
  z.object({
    state: z.literal("active"),
    expires_at: z.string(),
    client: z.object({
      name: z.string(),
      instagram_handle: z.string().nullable(),
      avatar_path: z.string().nullable(),
    }),
    posts: z.array(
      z.object({
        id: z.string(),
        caption: z.string(),
        status: z.enum(STATUS_VISIVEIS),
        scheduled_for: z.string().nullable(),
        slides: z.array(
          z.object({
            position: z.number(),
            media_type: z.enum(["image", "video"]),
            storage_path: z.string(),
          }),
        ),
        last_event: z
          .object({
            action: z.enum(["approved", "changes_requested"]),
            comment: z.string().nullable(),
            created_at: z.string(),
          })
          .nullable(),
      }),
    ),
  }),
]);

export type Midia = { tipo: "image" | "video"; url: string | null };

export type UltimaDecisao = { acao: Decisao; comentario: string | null; em: string };

export type PostParaAprovar = {
  id: string;
  legenda: string;
  status: Exclude<StatusPost, "draft">;
  agendadoPara: string | null;
  midias: Midia[];
  ultimaDecisao: UltimaDecisao | null;
};

export type ClienteDaPagina = {
  nome: string;
  instagram: string | null;
  avatarUrl: string | null;
};

export type PaginaAprovacao =
  | { estado: "inexistente" }
  | { estado: "revogado" }
  | { estado: "expirado" }
  | {
      estado: "ativo";
      expiraEm: string;
      cliente: ClienteDaPagina;
      posts: PostParaAprovar[];
    };

export type ResultadoDecisao =
  | { ok: true; status: Decisao; decisao: UltimaDecisao }
  | { ok: false; erro: string };
