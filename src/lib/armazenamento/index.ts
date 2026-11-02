import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { configR2 } from "./config";
import { limiteDoModo } from "./limites";
import { criarArmazenamentoR2 } from "./r2";
import { criarArmazenamentoSupabase } from "./supabase";
import type { Armazenamento } from "./tipos";

/** R2 se as variáveis R2_* estiverem definidas; senão, Supabase Storage. */
export function armazenamento(): Armazenamento {
  const r2 = configR2();
  return r2 ? criarArmazenamentoR2(r2) : criarArmazenamentoSupabase(criarClienteAdmin());
}

export type { Armazenamento, DestinoEnvio } from "./tipos";

/** Limite por arquivo para mostrar no formulário (sem criar clientes). */
export function limiteDeEnvio(): number {
  return limiteDoModo(configR2() ? "r2" : "supabase");
}
