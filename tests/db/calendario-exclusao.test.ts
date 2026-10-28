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
let padaria: string;
let academia: string;
let postPadaria: string;
let outroPostPadaria: string;
let postAcademia: string;
let audio: string;

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}

async function contar(sql: string, params: unknown[] = []) {
  await comoSuperusuario(db);
  return Number(await umValor(sql, params));
}

async function criarPost(cliente: string, n = 1) {
  const id = crypto.randomUUID();
  await db.query("select public.create_post($1, $2, 'Legenda', '2026-11-05T12:00:00Z', $3)", [
    id,
    cliente,
    JSON.stringify(
      Array.from({ length: n }, (_, i) => ({
        media_type: "image",
        storage_path: `${ana}/${cliente}/${id}/${i}.jpg`,
      })),
    ),
  ]);
  return id;
}

beforeAll(async () => {
  modelo = db = await criarBanco();
  ana = await criarUsuario(db, "ana@exemplo.com", "Ana");
  bruno = await criarUsuario(db, "bruno@exemplo.com", "Bruno");
  await comoUsuario(db, ana);
  padaria = await umValor(
    "insert into public.clients (name, avatar_path) values ('Padaria', $1) returning id",
    [`${ana}/x/avatar.jpg`],
  );
  await comoSuperusuario(db);
  // O avatar fica na pasta do cliente (o id só existe depois do insert).
  await db.query("update public.clients set avatar_path = $1 where id = $2", [
    `${ana}/${padaria}/avatar.jpg`,
    padaria,
  ]);
  await comoUsuario(db, ana);
  academia = await umValor("insert into public.clients (name) values ('Academia') returning id");
  postPadaria = await criarPost(padaria, 2);
  outroPostPadaria = await criarPost(padaria);
  postAcademia = await criarPost(academia);
  await db.query("select public.create_approval_link($1, $2)", [padaria, HASH]);

  // Um pedido de ajuste com áudio no primeiro post da padaria.
  await comoServidor(db);
  const pasta = await umValor<string>("select public.get_audio_upload_folder($1, $2)", [
    HASH,
    postPadaria,
  ]);
  audio = `${pasta}a.webm`;
  await comoSuperusuario(db);
  await db.query("insert into storage.objects (bucket_id, name) values ('post-media', $1)", [audio]);
  await comoServidor(db);
  await db.query("select public.register_approval($1, $2, 'changes_requested', null, $3)", [
    HASH,
    postPadaria,
    audio,
  ]);
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

describe("reschedule_post", () => {
  it("muda só a data: sem nova versão e sem mudar o status", async () => {
    await comoUsuario(db, ana);
    await db.query("select public.reschedule_post($1, '2026-11-20T18:30:00Z')", [postPadaria]);
    const { rows } = await db.query<{ scheduled_for: Date; version: number; status: string }>(
      "select scheduled_for, version, status from public.posts where id = $1",
      [postPadaria],
    );
    expect(rows[0].scheduled_for.toISOString()).toBe("2026-11-20T18:30:00.000Z");
    expect(rows[0].version).toBe(1);
    expect(rows[0].status).toBe("changes_requested");
  });

  it("aceita tirar a data (null)", async () => {
    await comoUsuario(db, ana);
    await db.query("select public.reschedule_post($1, null)", [postAcademia]);
    expect(
      await umValor("select scheduled_for from public.posts where id = $1", [postAcademia]),
    ).toBeNull();
  });

  it("outro social media e visitantes não reagendam", async () => {
    await comoUsuario(db, bruno);
    await expect(
      db.query("select public.reschedule_post($1, now())", [postPadaria]),
    ).rejects.toThrow(/post_nao_encontrado/);
    await comoAnonimo(db);
    await expect(
      db.query("select public.reschedule_post($1, now())", [postPadaria]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("delete_post", () => {
  it("apaga o post, mídias e histórico, e devolve os arquivos (mídias e áudio)", async () => {
    await comoUsuario(db, ana);
    const arquivos = await umValor<string[]>("select public.delete_post($1)", [postPadaria]);
    expect([...arquivos].sort()).toEqual(
      [`${ana}/${padaria}/${postPadaria}/0.jpg`, `${ana}/${padaria}/${postPadaria}/1.jpg`, audio].sort(),
    );
    expect(await contar("select count(*) from public.posts where id = $1", [postPadaria])).toBe(0);
    expect(await contar("select count(*) from public.post_slides where post_id = $1", [postPadaria])).toBe(0);
    expect(await contar("select count(*) from public.approval_events where post_id = $1", [postPadaria])).toBe(0);
    // Os outros posts do cliente continuam.
    expect(await contar("select count(*) from public.posts where client_id = $1", [padaria])).toBe(1);
  });

  it("não apaga post de outro social media", async () => {
    await comoUsuario(db, bruno);
    await expect(db.query("select public.delete_post($1)", [postPadaria])).rejects.toThrow(
      /post_nao_encontrado/,
    );
    expect(await contar("select count(*) from public.posts where id = $1", [postPadaria])).toBe(1);
  });
});

describe("delete_client", () => {
  it("apaga o cliente com tudo e devolve todos os arquivos dele", async () => {
    await comoUsuario(db, ana);
    const arquivos = await umValor<string[]>("select public.delete_client($1)", [padaria]);
    expect([...arquivos].sort()).toEqual(
      [
        `${ana}/${padaria}/avatar.jpg`,
        `${ana}/${padaria}/${postPadaria}/0.jpg`,
        `${ana}/${padaria}/${postPadaria}/1.jpg`,
        `${ana}/${padaria}/${outroPostPadaria}/0.jpg`,
        audio,
      ].sort(),
    );
    for (const sql of [
      "select count(*) from public.clients where id = $1",
      "select count(*) from public.posts where client_id = $1",
      "select count(*) from public.approval_links where client_id = $1",
    ]) {
      expect(await contar(sql, [padaria]), sql).toBe(0);
    }
    expect(await contar("select count(*) from public.approval_events")).toBe(0);
    // O outro cliente fica intacto.
    expect(await contar("select count(*) from public.posts where client_id = $1", [academia])).toBe(1);
  });

  it("o link do cliente apagado deixa de funcionar", async () => {
    await comoUsuario(db, ana);
    await db.query("select public.delete_client($1)", [padaria]);
    await comoServidor(db);
    expect(await umValor("select public.get_approval_page($1)", [HASH])).toBeNull();
  });

  it("não apaga cliente de outro social media", async () => {
    await comoUsuario(db, bruno);
    await expect(db.query("select public.delete_client($1)", [padaria])).rejects.toThrow(
      /cliente_nao_encontrado/,
    );
    expect(await contar("select count(*) from public.clients where id = $1", [padaria])).toBe(1);
  });

  it("visitante não apaga nada", async () => {
    await comoAnonimo(db);
    for (const sql of ["select public.delete_client($1)", "select public.delete_post($1)"]) {
      await expect(db.query(sql, [padaria])).rejects.toThrow(/permission denied/);
    }
  });
});
