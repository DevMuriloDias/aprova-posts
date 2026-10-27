// Fuso fixo para que o servidor e o navegador mostrem a mesma hora.
const FUSO = "America/Sao_Paulo";

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "short",
});

const data = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "27/10/2026 às 14:32" */
export function formatarDataHora(iso: string | Date): string {
  const partes = dataHora.formatToParts(new Date(iso));
  const v = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value;
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;
}

/** "05 de nov." */
export function formatarDataCurta(iso: string | Date): string {
  return dataCurta.format(new Date(iso));
}

/** "26/11/2026" */
export function formatarData(iso: string | Date): string {
  return data.format(new Date(iso));
}
