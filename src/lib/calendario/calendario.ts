// Calendário do social media. Tudo no horário de Brasília, igual ao resto do app
// (o Brasil não tem horário de verão desde 2019, então o fuso é fixo em -03:00).

const FUSO = "America/Sao_Paulo";
const DESLOCAMENTO = "-03:00";

export const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export type Mes = { ano: number; mes: number }; // mes: 1 a 12

export type DiaDaGrade = {
  /** "2026-11-05" */
  chave: string;
  dia: number;
  doMes: boolean;
};

const partesData = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partesHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
});

const p2 = (n: number) => String(n).padStart(2, "0");

/** Dia (em Brasília) de um instante: "2026-11-05". */
export function chaveDoDia(iso: string | Date): string {
  return partesData.format(new Date(iso));
}

/** "14:30" em Brasília. */
export function horaDe(iso: string | Date): string {
  return partesHora.format(new Date(iso));
}

export function chaveDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${p2(mes)}-${p2(dia)}`;
}

/** Lê ?mes=2026-11; se ausente ou inválido, usa o mês de `hoje`. */
export function mesDaUrl(valor: string | null | undefined, hoje: Date = new Date()): Mes {
  const m = /^(\d{4})-(\d{2})$/.exec(valor ?? "");
  if (m) {
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    if (mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100) return { ano, mes };
  }
  const [ano, mes] = chaveDoDia(hoje).split("-").map(Number);
  return { ano, mes };
}

/** Lê ?dia=2026-11-05; só aceita datas reais. */
export function diaDaUrl(valor: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor ?? "");
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? chaveDe(ano, mes, dia) : null;
}

/** "Novembro de 2026" */
export function textoDoMes({ ano, mes }: Mes): string {
  const nome = MESES[mes - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`;
}

export function chaveDoMes({ ano, mes }: Mes): string {
  return `${ano}-${p2(mes)}`;
}

export function somarMeses({ ano, mes }: Mes, quantidade: number): Mes {
  const total = ano * 12 + (mes - 1) + quantidade;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/** Semanas do mês, de domingo a sábado, incluindo os dias vizinhos. */
export function gradeDoMes({ ano, mes }: Mes): DiaDaGrade[][] {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const inicio = new Date(primeiro);
  inicio.setUTCDate(1 - primeiro.getUTCDay());
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const totalCelulas = Math.ceil((primeiro.getUTCDay() + diasNoMes) / 7) * 7;

  const semanas: DiaDaGrade[][] = [];
  for (let i = 0; i < totalCelulas; i++) {
    const d = new Date(inicio);
    d.setUTCDate(inicio.getUTCDate() + i);
    if (i % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1].push({
      chave: chaveDe(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      dia: d.getUTCDate(),
      doMes: d.getUTCMonth() === mes - 1,
    });
  }
  return semanas;
}

/** Intervalo [inicio, fim) em ISO cobrindo toda a grade do mês, para a consulta. */
export function intervaloDaGrade(mes: Mes): { inicio: string; fim: string } {
  const semanas = gradeDoMes(mes);
  const primeiro = semanas[0][0].chave;
  const ultimo = semanas[semanas.length - 1][6].chave;
  const depois = new Date(`${ultimo}T00:00:00${DESLOCAMENTO}`);
  depois.setUTCDate(depois.getUTCDate() + 1);
  return {
    inicio: new Date(`${primeiro}T00:00:00${DESLOCAMENTO}`).toISOString(),
    fim: depois.toISOString(),
  };
}

/** "Quinta, 5 de novembro" */
export function textoDoDia(chave: string): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return `${nomes[semana]}, ${dia} de ${MESES[mes - 1]}`;
}

/** Agrupa por dia (Brasília), em ordem de horário. */
export function agruparPorDia<T extends { agendadoPara: string }>(itens: T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of [...itens].sort((a, b) => a.agendadoPara.localeCompare(b.agendadoPara))) {
    const chave = chaveDoDia(item.agendadoPara);
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  return grupos;
}

// Cores para diferenciar os clientes no calendário (bem distintas entre si e
// nenhuma do Instagram). A ordem importa: as primeiras são as mais contrastantes.
export const CORES_CLIENTES = [
  { fundo: "bg-sky-100", texto: "text-sky-900", ponto: "bg-sky-500" },
  { fundo: "bg-lime-100", texto: "text-lime-900", ponto: "bg-lime-500" },
  { fundo: "bg-amber-100", texto: "text-amber-900", ponto: "bg-amber-500" },
  { fundo: "bg-violet-100", texto: "text-violet-900", ponto: "bg-violet-500" },
  { fundo: "bg-rose-100", texto: "text-rose-900", ponto: "bg-rose-500" },
  { fundo: "bg-slate-200", texto: "text-slate-900", ponto: "bg-slate-500" },
  { fundo: "bg-orange-100", texto: "text-orange-900", ponto: "bg-orange-500" },
  { fundo: "bg-teal-100", texto: "text-teal-900", ponto: "bg-teal-500" },
] as const;

export type CorCliente = (typeof CORES_CLIENTES)[number];

/** Cor pelo id (usada só quando o cliente não está na lista). */
export function corDoCliente(clienteId: string): CorCliente {
  // FNV-1a: espalha bem até ids parecidos.
  let h = 0x811c9dc5;
  for (const c of clienteId) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return CORES_CLIENTES[h % CORES_CLIENTES.length];
}

/**
 * Cores pela ordem dos clientes: até 8 clientes nunca repetem cor
 * (por sorteio, dois clientes podiam cair em tons parecidos).
 */
export function coresPorCliente(ids: string[]): (clienteId: string) => CorCliente {
  const mapa = new Map(ids.map((id, i) => [id, CORES_CLIENTES[i % CORES_CLIENTES.length]]));
  return (clienteId) => mapa.get(clienteId) ?? corDoCliente(clienteId);
}

/** Valor padrão do campo de data/hora para um dia: 10:00 daquele dia. */
export function campoDataHoraDoDia(chave: string, hora = "10:00"): string {
  return `${chave}T${hora}`;
}
