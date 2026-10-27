import { describe, expect, it } from "vitest";
import { ordemDePublicacao } from "./ordem";
import { caminhoDaMidia, caminhoDoAvatar, problemaNoArquivo } from "./validacao";

describe("caminhos no storage", () => {
  it("mídia fica em <dono>/<cliente>/<post>/ com extensão limpa", () => {
    expect(caminhoDaMidia("d", "c", "p", 2, "Foto Final.JPG", "x1")).toBe("d/c/p/2-x1.jpg");
    expect(caminhoDaMidia("d", "c", "p", 0, "../../etc/pa$$wd", "x1")).toBe("d/c/p/0-x1.etcpawd");
  });

  it("avatar fica em <dono>/<cliente>/", () => {
    expect(caminhoDoAvatar("d", "c", "perfil.png", "x1")).toBe("d/c/avatar-x1.png");
  });
});

describe("problemaNoArquivo", () => {
  it("aceita imagens e vídeos suportados", () => {
    expect(problemaNoArquivo({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(problemaNoArquivo({ name: "a.mp4", type: "video/mp4", size: 1000 })).toBeNull();
  });

  it("recusa formato e tamanho", () => {
    expect(problemaNoArquivo({ name: "a.gif", type: "image/gif", size: 1 })).toMatch(/formato/);
    expect(problemaNoArquivo({ name: "a.jpg", type: "image/jpeg", size: 101 * 1024 * 1024 })).toMatch(
      /100 MB/,
    );
  });

  it("foto de perfil só aceita imagem", () => {
    expect(
      problemaNoArquivo({ name: "a.mp4", type: "video/mp4", size: 1 }, { apenasImagem: true }),
    ).toMatch(/não é uma imagem/);
  });
});

describe("ordemDePublicacao", () => {
  it("data prevista primeiro, sem data por último, empate pela criação", () => {
    const posts = [
      { id: "sem-data-2", scheduled_for: null, created_at: "2026-10-02" },
      { id: "dia-10", scheduled_for: "2026-11-10", created_at: "2026-10-01" },
      { id: "sem-data-1", scheduled_for: null, created_at: "2026-10-01" },
      { id: "dia-05", scheduled_for: "2026-11-05", created_at: "2026-10-03" },
    ];
    expect([...posts].sort(ordemDePublicacao).map((p) => p.id)).toEqual([
      "dia-05",
      "dia-10",
      "sem-data-1",
      "sem-data-2",
    ]);
  });
});
