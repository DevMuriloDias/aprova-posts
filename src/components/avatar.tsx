/* eslint-disable @next/next/no-img-element -- URLs assinadas e temporárias do Storage */

type Props = { nome: string; url: string | null; tamanho?: "p" | "m" | "g" };

const TAMANHOS = { p: "size-8 text-xs", m: "size-10 text-sm", g: "size-16 text-xl" };

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export function Avatar({ nome, url, tamanho = "m" }: Props) {
  const classe = `${TAMANHOS[tamanho]} shrink-0 rounded-full border border-zinc-200`;
  if (url) {
    return <img src={url} alt={`Foto de perfil de ${nome}`} className={`${classe} object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`${classe} grid place-items-center bg-marca-50 font-semibold text-marca-700`}
    >
      {iniciais(nome)}
    </span>
  );
}
