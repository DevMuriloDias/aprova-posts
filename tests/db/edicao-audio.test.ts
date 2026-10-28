import type { PGliteInterface } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  comoAnonimo,
  comoServidor,
  comoSuperusuario,
  comoUsuario,
  criarBanco,
  criarUsuario,
  hashFalso,
} from "./helpers";

const HASH = hashFalso("a1");

let modelo: PGliteInterface;
let db: PGliteInterface;
let ana: string;
let bruno: string;
let cliente: string;
let post: string;
let outroPost: string;

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}

const slides = (...caminhos: string[]) =>
  JSON.stringify(caminhos.map((storage_path) => ({ media_type: "image", storage_path })));

async function editar(id: string, legenda: string, novas: string | null = null) {
  return umValor<string[]>("select public.update_post($1, $2, null, $3)", [id, legenda, novas]);
}

async function pasta(postId = post) {
  await comoServidor(db);
  return umValor<string>("select public.get_audio_upload_folder($1, $2)", [HASH, postId]);
}

/** Simula o upload do arquivo no storage (feito pelo servidor). */
async function enviarArquivo(caminho: string) {
  await comoSuperusuario(db);
  await db.query("insert into storage.objects (bucket_id, name) values ('post-media', $1)", [
    caminho,
  ]);
}

async function registrar(acao: string, comentario: string | null, audio: string | null = null) {
  await comoServidor(db);
  return db.query<{ post_version: number; audio_path: string | null }>(
    "select * from public.register_approval($1, $2, $3, $4, $5)",
    [HASH, post, acao, comentario, audio],
  );
}

type Pagina = {
  posts: {
    id: string;
    status: string;
    version: number;
    resubmitted_at: string | null;
    last_event: { action: string; audio_path: string | null; post_version: number } | null;
  }[];
};

async function pagina() {
  await comoServidor(db);
  return umValor<Pagina>("select public.get_approval_page($1)", [HASH]);
}

beforeAll(async () => {
  modelo = db = await criarBanco();
  ana = await criarUsuario(db, "ana@exemplo.com", "Ana");
  bruno = await criarUsuario(db, "bruno@exemplo.com", "Bruno");
  await comoUsuario(db, ana);
  cliente = await umValor("insert into public.clients (name) values ('Padaria') returning id");
  post = crypto.randomUUID();
  outroPost = crypto.randomUUID();
  for (const id of [post, outroPost]) {
    await db.query("select public.create_post($1, $2, 'Original', null, $3)", [
      id,
      cliente,
      slides(`${ana}/${cliente}/${id}/0.jpg`, `${ana}/${cliente}/${id}/1.jpg`),
    ]);
  }
  await db.query("select public.create_approval_link($1, $2)", [cliente, HASH]);
  await comoSuperusuario(db);
});

beforeEach(async () => {
  db = await modelo.clone();
});

afterEach(async () => {
  await db.close();
});

afterAll(async () => {
  await modelo.close();
});

describe("update_post (editar e reenviar)", () => {
  it("depois de um pedido de ajuste, editar devolve o post para aprovação como nova versão", async () => {
    await registrar("changes_requested", "Trocar a foto");
    await comoUsuario(db, ana);
    await editar(post, "Legenda corrigida");

    const { rows } = await db.query<{
      caption: string;
      status: string;
      version: number;
      resubmitted_at: Date | null;
    }>("select caption, status, version, resubmitted_at from public.posts where id = $1", [post]);
    expect(rows[0]).toMatchObject({
      caption: "Legenda corrigida",
      status: "pending_approval",
      version: 2,
    });
    expect(rows[0].resubmitted_at).toBeInstanceOf(Date);
  });

  it("o cliente vê a versão nova e o pedido anterior ligado à versão 1", async () => {
    await registrar("changes_requested", "Trocar a foto");
    await comoUsuario(db, ana);
    await editar(post, "Legenda corrigida");

    const p = (await pagina()).posts.find((x) => x.id === post)!;
    expect(p).toMatchObject({ status: "pending_approval", version: 2 });
    expect(p.resubmitted_at).not.toBeNull();
    expect(p.last_event).toMatchObject({ action: "changes_requested", post_version: 1 });
  });

  it("a decisão seguinte fica registrada na versão 2", async () => {
    await registrar("changes_requested", "Trocar a foto");
    await comoUsuario(db, ana);
    await editar(post, "Legenda corrigida");
    const { rows } = await registrar("approved", null);
    expect(rows[0].post_version).toBe(2);
  });

  it("editar um post aprovado também exige nova aprovação", async () => {
    await registrar("approved", null);
    await comoUsuario(db, ana);
    await editar(post, "Mudei depois de aprovado");
    expect(await umValor("select status from public.posts where id = $1", [post])).toBe(
      "pending_approval",
    );
  });

  it("sem novas mídias, mantém as atuais e não remove nada", async () => {
    await comoUsuario(db, ana);
    expect(await editar(post, "Só a legenda")).toEqual([]);
    expect(
      Number(await umValor("select count(*) from public.post_slides where post_id = $1", [post])),
    ).toBe(2);
  });

  it("troca as mídias e devolve só os arquivos que saíram", async () => {
    await comoUsuario(db, ana);
    const mantida = `${ana}/${cliente}/${post}/1.jpg`;
    const nova = `${ana}/${cliente}/${post}/2-novo.jpg`;
    const removidos = await editar(post, "Com fotos novas", slides(nova, mantida));
    expect(removidos).toEqual([`${ana}/${cliente}/${post}/0.jpg`]);

    const { rows } = await db.query<{ storage_path: string }>(
      "select storage_path from public.post_slides where post_id = $1 order by position",
      [post],
    );
    expect(rows.map((r) => r.storage_path)).toEqual([nova, mantida]);
  });

  it("valida a quantidade de mídias", async () => {
    await comoUsuario(db, ana);
    await expect(editar(post, "x", "[]")).rejects.toThrow(/slides_invalidos/);
  });

  it("outro social media e visitantes não editam", async () => {
    await comoUsuario(db, bruno);
    await expect(editar(post, "hack")).rejects.toThrow(/post_nao_encontrado/);
    await comoAnonimo(db);
    await expect(editar(post, "hack")).rejects.toThrow(/permission denied/);
  });
});

describe("áudio no pedido de ajuste", () => {
  it("o servidor recebe a pasta do áudio só para link e post válidos", async () => {
    expect(await pasta()).toBe(`${ana}/${cliente}/${post}/audios/`);
    await expect(pasta(crypto.randomUUID())).rejects.toThrow(/post_invalido/);

    await comoServidor(db);
    await expect(
      db.query("select public.get_audio_upload_folder($1, $2)", [hashFalso("ff"), post]),
    ).rejects.toThrow(/link_invalido/);
  });

  it("pedido de ajuste só com áudio é aceito e aparece na página", async () => {
    const caminho = `${await pasta()}x1.webm`;
    await enviarArquivo(caminho);
    const { rows } = await registrar("changes_requested", null, caminho);
    expect(rows[0].audio_path).toBe(caminho);

    const p = (await pagina()).posts.find((x) => x.id === post)!;
    expect(p.status).toBe("changes_requested");
    expect(p.last_event?.audio_path).toBe(caminho);
  });

  it("sem comentário e sem áudio continua recusado", async () => {
    await expect(registrar("changes_requested", "  ", null)).rejects.toThrow(/check constraint/);
  });

  it("recusa áudio fora da pasta do post, inexistente ou com ..", async () => {
    const daqui = await pasta();
    const deOutroPost = await pasta(outroPost);
    const casos = [
      `${deOutroPost}a.webm`, // de outro post
      `${bruno}/${cliente}/${post}/audios/a.webm`, // de outro dono
      `${daqui}../../0.jpg`, // tentativa de sair da pasta
      `${daqui}nao-enviado.webm`, // não existe no storage
    ];
    for (const caminho of casos.slice(0, 3)) await enviarArquivo(caminho);
    for (const caminho of casos) {
      await expect(registrar("changes_requested", null, caminho), caminho).rejects.toThrow(
        /audio_invalido/,
      );
    }
  });

  it("só o servidor descobre a pasta do áudio", async () => {
    for (const papel of ["anon", "ana"] as const) {
      if (papel === "anon") await comoAnonimo(db);
      else await comoUsuario(db, ana);
      await expect(
        db.query("select public.get_audio_upload_folder($1, $2)", [HASH, post]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select public.register_approval($1, $2, 'approved', null, null)", [HASH, post]),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("o bucket aceita os formatos gravados pelos navegadores", async () => {
    const tipos = await umValor<string[]>(
      "select allowed_mime_types from storage.buckets where id = 'post-media'",
    );
    expect(tipos).toEqual(expect.arrayContaining(["audio/webm", "audio/mp4", "audio/ogg"]));
  });

  it("o social media ouve o áudio dos próprios posts pelo storage", async () => {
    const caminho = `${await pasta()}x1.webm`;
    await enviarArquivo(caminho);
    await comoUsuario(db, ana);
    expect(
      Number(await umValor("select count(*) from storage.objects where name = $1", [caminho])),
    ).toBe(1);
    await comoUsuario(db, bruno);
    expect(
      Number(await umValor("select count(*) from storage.objects where name = $1", [caminho])),
    ).toBe(0);
  });
});
