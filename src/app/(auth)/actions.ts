"use server";

import { redirect } from "next/navigation";
import { ROTA_ENTRAR } from "@/lib/auth/rotas";
import {
  processarCadastro,
  processarEntrada,
  processarReenvio,
  type EstadoFormulario,
  type Resultado,
} from "@/lib/auth/servico";
import { envPublico } from "@/lib/env";
import { criarClienteSupabase } from "@/lib/supabase/server";

function concluir(resultado: Resultado): EstadoFormulario {
  if (resultado.tipo === "redirecionar") {
    redirect(resultado.destino);
  }
  return resultado.estado;
}

export async function entrar(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteSupabase();
  return concluir(await processarEntrada(supabase.auth, formData));
}

export async function cadastrar(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteSupabase();
  return concluir(
    await processarCadastro(supabase.auth, formData, envPublico().NEXT_PUBLIC_SITE_URL),
  );
}

export async function reenviarConfirmacao(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteSupabase();
  return processarReenvio(supabase.auth, formData, envPublico().NEXT_PUBLIC_SITE_URL);
}

export async function sair() {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  redirect(ROTA_ENTRAR);
}
