import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  rotulo: string;
  erro?: string;
};

export function Campo({ rotulo, erro, name, id, className = "", ...resto }: Props) {
  const idCampo = id ?? name;
  const idErro = `${idCampo}-erro`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium text-zinc-800">
        {rotulo}
      </label>
      <input
        id={idCampo}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={`h-12 w-full rounded-xl border bg-white px-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-100 ${
          erro ? "border-red-400" : "border-zinc-300"
        } ${className}`}
        {...resto}
      />
      {erro && (
        <p id={idErro} className="text-sm text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
