import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      // Áudio do pedido de ajuste (até 4 MB, ver TAMANHO_MAXIMO_AUDIO) + folga do
      // multipart. Precisa ficar abaixo do limite de 4,5 MB por requisição da Vercel.
      bodySizeLimit: "4.4mb",
    },
  },
  async headers() {
    return [
      {
        // Página do link mágico: o token está na URL.
        source: "/a/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
