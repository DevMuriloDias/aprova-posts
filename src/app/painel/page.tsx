import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { textoProgresso } from "@/lib/aprovacao/progresso";
import { exigirUsuario } from "@/lib/auth/usuario";
import { listarClientes } from "@/lib/painel/consultas";
import { FormularioCliente } from "./formulario-cliente";

export const metadata: Metadata = { title: "Painel" };

export default function PaginaPainel() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  const usuario = await exigirUsuario();
  const clientes = await listarClientes();
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
            {primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">Seus clientes e o andamento das aprovações.</p>
        </div>
        <FormularioCliente donoId={usuario.id} />
      </div>

      {clientes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
          Você ainda não tem clientes. Cadastre o primeiro para começar a enviar posts.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/painel/clientes/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300"
              >
                <Avatar nome={c.nome} url={c.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-900">{c.nome}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {c.resumo.total === 0 ? "Nenhum post enviado" : textoProgresso(c.resumo)}
                  </p>
                  {c.resumo.total > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${c.resumo.percentual}%` }}
                      />
                    </div>
                  )}
                </div>
                {c.resumo.ajustes > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                    {c.resumo.ajustes} {c.resumo.ajustes === 1 ? "ajuste" : "ajustes"}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
