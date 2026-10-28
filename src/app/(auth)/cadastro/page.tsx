import type { Metadata } from "next";
import Link from "next/link";
import { ROTA_ENTRAR } from "@/lib/auth/rotas";
import { FormularioCadastro } from "./formulario-cadastro";

export const metadata: Metadata = { title: "Criar conta" };

export default function PaginaCadastro() {
  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900">Criar conta</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Envie posts para seus clientes aprovarem em poucos cliques.
      </p>
      <div className="mt-6">
        <FormularioCadastro />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Já tem conta?{" "}
        <Link href={ROTA_ENTRAR} className="font-semibold text-marca-700 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
