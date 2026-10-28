/* eslint-disable @next/next/no-img-element -- URLs assinadas e temporárias do Storage */

import Link from "next/link";
import { StatusPostSelo } from "@/components/status-post";
import {
  DIAS_DA_SEMANA,
  agruparPorDia,
  campoDataHoraDoDia,
  chaveDoMes,
  coresPorCliente,
  type CorCliente,
  gradeDoMes,
  horaDe,
  mesDaUrl,
  somarMeses,
  textoDoDia,
  textoDoMes,
  type Mes,
} from "@/lib/calendario/calendario";
import type { PostNoCalendario } from "@/lib/painel/consultas";
import { FormularioPost } from "../clientes/[id]/formulario-post";
import { FiltroCliente } from "./filtro-cliente";
import { Reagendar } from "./reagendar";

/** Monta o link mantendo mês, dia e cliente. */
function linkPara(mes: Mes, dia: string | null, clienteId: string | null) {
  const p = new URLSearchParams({ mes: chaveDoMes(mes) });
  if (dia) p.set("dia", dia);
  if (clienteId) p.set("cliente", clienteId);
  return `/painel/calendario?${p.toString()}`;
}

export type PropsVistaCalendario = {
  mes: Mes;
  hoje: string;
  diaSelecionado: string;
  clienteId: string | null;
  donoId: string;
  clientes: { id: string; nome: string }[];
  agendados: PostNoCalendario[];
  semData: PostNoCalendario[];
};

export function VistaCalendario({
  mes,
  hoje,
  diaSelecionado,
  clienteId,
  donoId,
  clientes,
  agendados,
  semData,
}: PropsVistaCalendario) {
  const chaveMes = chaveDoMes(mes);
  const porDia = agruparPorDia(
    agendados.filter((p): p is PostNoCalendario & { agendadoPara: string } => !!p.agendadoPara),
  );
  const doDia = porDia.get(diaSelecionado) ?? [];
  const corDe = coresPorCliente(clientes.map((c) => c.id));
  const anterior = somarMeses(mes, -1);
  const proximo = somarMeses(mes, 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-tinta sm:text-2xl">Calendário</h1>
          <p className="mt-1 text-sm text-zinc-600">Organize os posts de todos os clientes por dia e horário.</p>
        </div>
        {clientes.length > 0 && <FiltroCliente clientes={clientes} />}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label={`Calendário de ${textoDoMes(mes)}`} className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link
              href={linkPara(anterior, null, clienteId)}
              scroll={false}
              aria-label={`Mês anterior (${textoDoMes(anterior)})`}
              className="grid size-10 place-items-center rounded-xl text-xl text-zinc-700 hover:bg-marca-50"
            >
              ‹
            </Link>
            <div className="text-center">
              <h2 className="text-base font-bold text-tinta sm:text-lg">{textoDoMes(mes)}</h2>
              {!hoje.startsWith(chaveMes) && (
                <Link
                  href={linkPara(mesDaUrl(hoje.slice(0, 7)), hoje, clienteId)}
                  scroll={false}
                  className="text-xs font-semibold text-marca-700 hover:underline"
                >
                  Voltar para hoje
                </Link>
              )}
            </div>
            <Link
              href={linkPara(proximo, null, clienteId)}
              scroll={false}
              aria-label={`Próximo mês (${textoDoMes(proximo)})`}
              className="grid size-10 place-items-center rounded-xl text-xl text-zinc-700 hover:bg-marca-50"
            >
              ›
            </Link>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {DIAS_DA_SEMANA.map((d) => (
              <div key={d} className="pb-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {gradeDoMes(mes)
              .flat()
              .map((dia) => {
                const posts = porDia.get(dia.chave) ?? [];
                const selecionado = dia.chave === diaSelecionado;
                const ehHoje = dia.chave === hoje;
                return (
                  <Link
                    key={dia.chave}
                    href={linkPara(mes, dia.chave, clienteId)}
                    scroll={false}
                    aria-current={selecionado ? "date" : undefined}
                    aria-label={`${textoDoDia(dia.chave)}: ${
                      posts.length === 0 ? "nenhum post" : posts.length === 1 ? "1 post" : `${posts.length} posts`
                    }`}
                    className={`flex min-h-16 flex-col gap-1 rounded-xl border p-1.5 text-left transition sm:min-h-24 ${
                      selecionado
                        ? "border-marca-600 bg-marca-50"
                        : "border-transparent hover:border-zinc-200 hover:bg-zinc-50"
                    } ${dia.doMes ? "" : "opacity-40"}`}
                  >
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                        ehHoje ? "bg-marca-600 text-white" : "text-zinc-800"
                      }`}
                    >
                      {dia.dia}
                    </span>

                    {/* Celular: pontinhos com a cor de cada cliente */}
                    <span className="flex flex-wrap gap-0.5 sm:hidden">
                      {posts.slice(0, 4).map((p) => (
                        <span key={p.id} aria-hidden className={`size-1.5 rounded-full ${corDe(p.clienteId).ponto}`} />
                      ))}
                    </span>

                    {/* Telas maiores: horário e cliente */}
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {posts.slice(0, 3).map((p) => {
                        const cor = corDe(p.clienteId);
                        return (
                          <span
                            key={p.id}
                            className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cor.fundo} ${cor.texto}`}
                          >
                            {horaDe(p.agendadoPara)} {p.clienteNome}
                          </span>
                        );
                      })}
                      {posts.length > 3 && (
                        <span className="px-1 text-[11px] font-semibold text-zinc-500">+{posts.length - 3} mais</span>
                      )}
                    </span>
                  </Link>
                );
              })}
          </div>

          {clientes.length > 1 && !clienteId && (
            <ul aria-label="Cores dos clientes" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-100 pt-3">
              {clientes.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <span aria-hidden className={`size-2.5 rounded-full ${corDe(c.id).ponto}`} />
                  {c.nome}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="agenda-titulo" className="flex flex-col gap-3">
            <div>
              <h2 id="agenda-titulo" className="text-base font-bold text-tinta">
                {textoDoDia(diaSelecionado)}
              </h2>
              <p className="text-xs text-zinc-500">
                {doDia.length === 0 ? "Nenhum post neste dia." : doDia.length === 1 ? "1 post" : `${doDia.length} posts`}
              </p>
            </div>

            {doDia.length > 0 && (
              <ul className="flex flex-col gap-2">
                {doDia.map((p) => (
                  <ItemAgenda key={p.id} post={p} cor={corDe(p.clienteId)} />
                ))}
              </ul>
            )}

            {clientes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
                Cadastre um cliente em{" "}
                <Link href="/painel" className="font-semibold text-marca-700 hover:underline">
                  Clientes
                </Link>{" "}
                para começar a programar posts.
              </p>
            ) : (
              <FormularioPost
                key={diaSelecionado}
                donoId={donoId}
                clientes={clienteId ? clientes.filter((c) => c.id === clienteId) : clientes}
                agendadoInicial={campoDataHoraDoDia(diaSelecionado)}
                rotulo="+ Novo post neste dia"
              />
            )}
          </section>

          {semData.length > 0 && (
            <section aria-labelledby="sem-data-titulo" className="flex flex-col gap-2">
              <h2 id="sem-data-titulo" className="text-base font-bold text-tinta">
                Sem data definida ({semData.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {semData.map((p) => (
                  <ItemAgenda key={p.id} post={p} cor={corDe(p.clienteId)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemAgenda({ post, cor }: { post: PostNoCalendario; cor: CorCliente }) {
  return (
    <li className="flex flex-wrap gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {post.capaUrl && post.capaTipo === "image" && (
          <img src={post.capaUrl} alt="" className="h-full w-full object-cover" />
        )}
        {post.capaUrl && post.capaTipo === "video" && (
          <video src={post.capaUrl} muted preload="metadata" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {post.agendadoPara && (
            <span className="text-sm font-bold text-tinta">{horaDe(post.agendadoPara)}</span>
          )}
          <span className={`inline-flex items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-semibold ${cor.fundo} ${cor.texto}`}>
            {post.clienteNome}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-zinc-700">{post.legenda || "Sem legenda"}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusPostSelo status={post.status} />
          <Link href={`/painel/clientes/${post.clienteId}`} className="text-sm font-semibold text-zinc-600 hover:underline">
            Abrir
          </Link>
          <Reagendar postId={post.id} agendadoPara={post.agendadoPara} />
        </div>
      </div>
    </li>
  );
}
