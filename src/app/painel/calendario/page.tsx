import type { Metadata } from "next";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth/usuario";
import { chaveDoDia, chaveDoMes, diaDaUrl, intervaloDaGrade, mesDaUrl } from "@/lib/calendario/calendario";
import { listarCalendario } from "@/lib/painel/consultas";
import { VistaCalendario } from "./vista-calendario";

export const metadata: Metadata = { title: "Calendário" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Busca = PageProps<"/painel/calendario">["searchParams"];

export default function PaginaCalendario({ searchParams }: PageProps<"/painel/calendario">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />}>
      <Calendario searchParams={searchParams} />
    </Suspense>
  );
}

function texto(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : null;
}

async function Calendario({ searchParams }: { searchParams: Busca }) {
  const usuario = await exigirUsuario();
  const busca = await searchParams;
  const mes = mesDaUrl(texto(busca.mes));
  const filtroCliente = texto(busca.cliente);
  const clienteId = filtroCliente && UUID.test(filtroCliente) ? filtroCliente : null;
  const hoje = chaveDoDia(new Date());

  const dados = await listarCalendario({ ...intervaloDaGrade(mes), clienteId });

  // Dia aberto na agenda: o da URL, senão hoje (se estiver neste mês), senão o dia 1.
  const chaveMes = chaveDoMes(mes);
  const diaSelecionado =
    diaDaUrl(texto(busca.dia)) ?? (hoje.startsWith(chaveMes) ? hoje : `${chaveMes}-01`);

  return (
    <VistaCalendario
      {...dados}
      mes={mes}
      hoje={hoje}
      diaSelecionado={diaSelecionado}
      clienteId={clienteId}
      donoId={usuario.id}
    />
  );
}
