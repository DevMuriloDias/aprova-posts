"use client";

/* eslint-disable @next/next/no-img-element -- URLs assinadas e temporárias do Storage */

import { useRef, useState } from "react";
import type { Midia } from "@/lib/aprovacao/tipos";

export function Carrossel({ midias, rotulo }: { midias: Midia[]; rotulo: string }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const total = midias.length;

  function aoRolar() {
    const el = trilho.current;
    if (!el || el.clientWidth === 0) return;
    setAtual(Math.round(el.scrollLeft / el.clientWidth));
  }

  function irPara(indice: number) {
    const el = trilho.current;
    if (!el) return;
    const destino = Math.max(0, Math.min(total - 1, indice));
    el.scrollTo({ left: destino * el.clientWidth, behavior: "smooth" });
    setAtual(destino);
  }

  return (
    <div className="relative bg-zinc-100" aria-roledescription="carrossel" aria-label={rotulo}>
      <div
        ref={trilho}
        onScroll={aoRolar}
        className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {midias.map((midia, i) => (
          <div
            key={i}
            className="relative h-full w-full shrink-0 snap-center"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}`}
          >
            {!midia.url ? (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                Mídia indisponível
              </div>
            ) : midia.tipo === "video" ? (
              <video
                src={midia.url}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              <img
                src={midia.url}
                alt={`Imagem ${i + 1} de ${total}`}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-zinc-900/70 px-2 py-0.5 text-xs font-medium text-white">
            {atual + 1}/{total}
          </span>
          <button
            type="button"
            onClick={() => irPara(atual - 1)}
            disabled={atual === 0}
            aria-label="Mídia anterior"
            className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-800 shadow disabled:invisible sm:grid"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => irPara(atual + 1)}
            disabled={atual === total - 1}
            aria-label="Próxima mídia"
            className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-800 shadow disabled:invisible sm:grid"
          >
            ›
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {midias.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => irPara(i)}
                aria-label={`Ir para a mídia ${i + 1}`}
                aria-current={i === atual}
                className={`size-2 rounded-full transition ${
                  i === atual ? "bg-marca-600" : "bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
