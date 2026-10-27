import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ROTA_CADASTRO } from "@/lib/auth/rotas";
import { FormularioEntrar } from "./formulario-entrar";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaEntrar() {
  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900">Entrar</h1>
      <p className="mt-1 text-sm text-zinc-600">Acesse sua conta de social media.</p>
      <div className="mt-6">
        {/* O formulário lê a URL (?proximo, ?erro), por isso fica em Suspense. */}
        <Suspense>
          <FormularioEntrar />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Ainda não tem conta?{" "}
        <Link href={ROTA_CADASTRO} className="font-semibold text-fuchsia-700 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </>
  );
}
