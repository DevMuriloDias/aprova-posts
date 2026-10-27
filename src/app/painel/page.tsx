import type { Metadata } from "next";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth/usuario";

export const metadata: Metadata = { title: "Painel" };

export default function PaginaPainel() {
  return (
    <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />}>
      <BoasVindas />
    </Suspense>
  );
}

async function BoasVindas() {
  const usuario = await exigirUsuario();
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
        {primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!"}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        Você entrou como <span className="font-medium">{usuario.email}</span>.
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        Em breve: cadastre seus clientes, envie posts e acompanhe as aprovações por aqui.
      </p>
    </section>
  );
}
