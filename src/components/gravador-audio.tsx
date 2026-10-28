"use client";

import { useEffect, useRef, useState } from "react";
import { LIMITE_AUDIO_SEGUNDOS } from "@/lib/aprovacao/limites";

// Ordem de preferência; o Safari (iPhone) só grava audio/mp4.
const FORMATOS = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

/** Bitrate baixo: voz fica clara e 3 minutos cabem em menos de 1 MB. */
const BITS_POR_SEGUNDO = 32_000;

export function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function escolherFormato(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
}

type Estado =
  | { tipo: "ocioso" }
  | { tipo: "pedindo" }
  | { tipo: "gravando"; segundos: number }
  | { tipo: "gravado"; url: string; segundos: number };

type Props = {
  /** Chamado com o áudio gravado, ou null quando o áudio é apagado. */
  aoMudar: (audio: Blob | null) => void;
  desabilitado?: boolean;
};

export function GravadorAudio({ aoMudar, desabilitado = false }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: "ocioso" });
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlAtual = useRef<string | null>(null);

  function liberarMicrofone() {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
  }

  // Ao sair da tela: solta o microfone e a URL temporária.
  useEffect(
    () => () => {
      liberarMicrofone();
      if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
    },
    [],
  );

  async function iniciar() {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErro("Seu navegador não permite gravar áudio. Escreva o ajuste no campo de texto.");
      return;
    }
    setEstado({ tipo: "pedindo" });
    try {
      fluxo.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setEstado({ tipo: "ocioso" });
      setErro("Não conseguimos usar o microfone. Permita o acesso ao microfone no navegador e tente de novo.");
      return;
    }

    const formato = escolherFormato();
    const pedacos: Blob[] = [];
    const inicio = Date.now();
    const rec = new MediaRecorder(fluxo.current, {
      ...(formato ? { mimeType: formato } : {}),
      audioBitsPerSecond: BITS_POR_SEGUNDO,
    });
    gravador.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    rec.onstop = () => {
      liberarMicrofone();
      const segundos = Math.round((Date.now() - inicio) / 1000);
      const audio = new Blob(pedacos, { type: rec.mimeType || formato || "audio/webm" });
      if (audio.size === 0) {
        setEstado({ tipo: "ocioso" });
        setErro("A gravação ficou vazia. Tente de novo.");
        return;
      }
      if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
      urlAtual.current = URL.createObjectURL(audio);
      setEstado({ tipo: "gravado", url: urlAtual.current, segundos });
      aoMudar(audio);
    };

    rec.start();
    setEstado({ tipo: "gravando", segundos: 0 });
    relogio.current = setInterval(() => {
      const segundos = Math.floor((Date.now() - inicio) / 1000);
      if (segundos >= LIMITE_AUDIO_SEGUNDOS) {
        parar();
        return;
      }
      setEstado({ tipo: "gravando", segundos });
    }, 250);
  }

  function parar() {
    if (gravador.current?.state === "recording") gravador.current.stop();
  }

  function apagar() {
    if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
    urlAtual.current = null;
    setEstado({ tipo: "ocioso" });
    aoMudar(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {estado.tipo === "gravado" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-medium text-zinc-800">
            Áudio gravado ({formatarDuracao(estado.segundos)})
          </p>
          <audio src={estado.url} controls preload="metadata" className="w-full" />
          <button
            type="button"
            onClick={apagar}
            disabled={desabilitado}
            className="self-start text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            Apagar áudio
          </button>
        </div>
      ) : estado.tipo === "gravando" ? (
        <button
          type="button"
          onClick={parar}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 font-semibold text-white"
        >
          <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-white" />
          Parar gravação · {formatarDuracao(estado.segundos)} / {formatarDuracao(LIMITE_AUDIO_SEGUNDOS)}
        </button>
      ) : (
        <button
          type="button"
          onClick={iniciar}
          disabled={desabilitado || estado.tipo === "pedindo"}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          <span aria-hidden>🎙️</span>
          {estado.tipo === "pedindo" ? "Liberando o microfone…" : "Gravar áudio"}
        </button>
      )}
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
