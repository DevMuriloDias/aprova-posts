import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { comoAnonimo, comoSuperusuario, comoUsuario, criarBanco, criarUsuario } from "./helpers";

// Editar cliente (nome, @ e foto) é um UPDATE direto em clients, protegido pelo RLS
// e pela regra de que a foto fica na pasta do dono.

let db: PGlite;
let ana: string;
let bruno: string;
let padaria: string;

async function clienteNoBanco() {
  await comoSuperusuario(db);
  const { rows } = await db.query<{ name: string; instagram_handle: string | null; avatar_path: string | null }>(
    "select name, instagram_handle, avatar_path from public.clients where id = $1",
    [padaria],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await criarBanco();
  ana = await criarUsuario(db, "ana@exemplo.com", "Ana");
  bruno = await criarUsuario(db, "bruno@exemplo.com", "Bruno");
  await comoUsuario(db, ana);
  const { rows } = await db.query<{ id: string }>(
    "insert into public.clients (name) values ('Padaria') returning id",
  );
  padaria = rows[0].id;
});

describe("editar cliente", () => {
  it("o dono troca nome, @ e foto", async () => {
    await comoUsuario(db, ana);
    const r = await db.query(
      "update public.clients set name = 'Padaria Nova', instagram_handle = 'padarianova', avatar_path = $1 where id = $2",
      [`${ana}/${padaria}/avatar-1.jpg`, padaria],
    );
    expect(r.affectedRows).toBe(1);
    expect(await clienteNoBanco()).toEqual({
      name: "Padaria Nova",
      instagram_handle: "padarianova",
      avatar_path: `${ana}/${padaria}/avatar-1.jpg`,
    });
  });

  it("o dono tira a foto", async () => {
    await comoUsuario(db, ana);
    await db.query("update public.clients set avatar_path = null where id = $1", [padaria]);
    expect((await clienteNoBanco()).avatar_path).toBeNull();
  });

  it("foto na pasta de outro social media é recusada", async () => {
    await comoUsuario(db, ana);
    await expect(
      db.query("update public.clients set avatar_path = $1 where id = $2", [`${bruno}/${padaria}/a.jpg`, padaria]),
    ).rejects.toThrow(/check/);
  });

  it("outro social media não edita nem lê a foto", async () => {
    await comoUsuario(db, bruno);
    const leitura = await db.query("select avatar_path from public.clients where id = $1", [padaria]);
    expect(leitura.rows).toHaveLength(0);
    const r = await db.query("update public.clients set name = 'hack' where id = $1", [padaria]);
    expect(r.affectedRows).toBe(0);
    expect((await clienteNoBanco()).name).toBe("Padaria Nova");
  });

  it("anônimo não edita", async () => {
    await comoAnonimo(db);
    await expect(db.query("update public.clients set name = 'hack' where id = $1", [padaria])).rejects.toThrow(
      /permission denied/,
    );
  });
});
