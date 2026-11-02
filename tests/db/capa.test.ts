import type { PGliteInterface } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { comoServidor, comoSuperusuario, comoUsuario, criarBanco, criarUsuario, hashFalso } from "./helpers";

const HASH = hashFalso("a1");

let modelo: PGliteInterface;
let db: PGliteInterface;
let ana: string;
let bruno: string;
let cliente: string;
let post: string;

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}

const pasta = () => `${ana}/${cliente}/${post}`;
const slides = (...caminhos: string[]) =>
  JSON.stringify(caminhos.map((storage_path) => ({ media_type: "image", storage_path })));

async function capaAtual() {
  await comoSuperusuario(db);
  return umValor<string | null>("select cover_path from public.posts where id = $1", [post]);
}

beforeAll(async () => {
  modelo = db = await criarBanco();
  ana = await criarUsuario(db, "ana@exemplo.com", "Ana");
  bruno = await criarUsuario(db, "bruno@exemplo.com", "Bruno");
  await comoUsuario(db, ana);
  cliente = await umValor("insert into public.clients (name) values ('Padaria') returning id");
  post = crypto.randomUUID();
  await db.query("select public.create_post($1, $2, 'Legenda', null, $3, $4)", [
    post,
    cliente,
    slides(`${ana}/${cliente}/${post}/0.mp4`),
    `${ana}/${cliente}/${post}/capa-1.jpg`,
  ]);
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

describe("capa do post", () => {
  it("create_post grava a capa", async () => {
    expect(await capaAtual()).toBe(`${pasta()}/capa-1.jpg`);
  });

  it("a capa continua opcional (chamada antiga, sem o parâmetro)", async () => {
    await comoUsuario(db, ana);
    const outro = crypto.randomUUID();
    await db.query("select public.create_post($1, $2, '', null, $3)", [
      outro,
      cliente,
      slides(`${ana}/${cliente}/${outro}/0.jpg`),
    ]);
    await comoSuperusuario(db);
    expect(await umValor("select cover_path from public.posts where id = $1", [outro])).toBeNull();
  });

  it("não aceita capa na pasta de outro social media", async () => {
    await comoUsuario(db, ana);
    const outro = crypto.randomUUID();
    await expect(
      db.query("select public.create_post($1, $2, '', null, $3, $4)", [
        outro,
        cliente,
        slides(`${ana}/${cliente}/${outro}/0.jpg`),
        `${bruno}/capa.jpg`,
      ]),
    ).rejects.toThrow(/check constraint/);
  });

  it("o cliente recebe a capa na página do link", async () => {
    await comoServidor(db);
    const pagina = await umValor<{ posts: { cover_path: string | null }[] }>(
      "select public.get_approval_page($1)",
      [HASH],
    );
    expect(pagina.posts[0].cover_path).toBe(`${pasta()}/capa-1.jpg`);
  });
});

describe("update_post e a capa", () => {
  async function editar(capa: string | null, remover = false) {
    await comoUsuario(db, ana);
    return umValor<string[]>("select public.update_post($1, 'Nova', null, null, $2, $3)", [post, capa, remover]);
  }

  it("sem capa nova, mantém a atual e não remove nada", async () => {
    await comoUsuario(db, ana);
    const removidos = await umValor<string[]>("select public.update_post($1, 'Nova', null)", [post]);
    expect(removidos).toEqual([]);
    expect(await capaAtual()).toBe(`${pasta()}/capa-1.jpg`);
  });

  it("trocar a capa devolve a antiga para apagar", async () => {
    expect(await editar(`${pasta()}/capa-2.jpg`)).toEqual([`${pasta()}/capa-1.jpg`]);
    expect(await capaAtual()).toBe(`${pasta()}/capa-2.jpg`);
  });

  it("remover a capa", async () => {
    expect(await editar(null, true)).toEqual([`${pasta()}/capa-1.jpg`]);
    expect(await capaAtual()).toBeNull();
  });

  it("trocar a capa gera nova versão e volta para aprovação", async () => {
    await comoServidor(db);
    await db.query("select public.register_approval($1, $2, 'approved')", [HASH, post]);
    await editar(`${pasta()}/capa-2.jpg`);
    await comoSuperusuario(db);
    const { rows } = await db.query<{ status: string; version: number }>(
      "select status, version from public.posts where id = $1",
      [post],
    );
    expect(rows[0]).toEqual({ status: "pending_approval", version: 2 });
  });
});

describe("exclusão devolve a capa", () => {
  it("delete_post", async () => {
    await comoUsuario(db, ana);
    const arquivos = await umValor<string[]>("select public.delete_post($1)", [post]);
    expect([...arquivos].sort()).toEqual([`${pasta()}/0.mp4`, `${pasta()}/capa-1.jpg`].sort());
  });

  it("delete_client", async () => {
    await comoUsuario(db, ana);
    const arquivos = await umValor<string[]>("select public.delete_client($1)", [cliente]);
    expect(arquivos).toContain(`${pasta()}/capa-1.jpg`);
  });
});
