import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite, type PGliteInterface } from "@electric-sql/pglite";

const raiz = path.resolve(__dirname, "../..");
const pastaMigrations = path.join(raiz, "supabase/migrations");

/** Cria um Postgres em memória com o stub do Supabase e todas as migrations. */
export async function criarBanco(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));

  const arquivos = readdirSync(pastaMigrations)
    .filter((nome) => nome.endsWith(".sql"))
    .sort();
  for (const arquivo of arquivos) {
    await db.exec(readFileSync(path.join(pastaMigrations, arquivo), "utf8"));
  }
  return db;
}

/** Cadastra um usuário em auth.users (o trigger cria o profile). */
export async function criarUsuario(
  db: PGliteInterface,
  email: string,
  nome = "",
): Promise<string> {
  await comoSuperusuario(db);
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify({ full_name: nome })],
  );
  return rows[0].id;
}

/** Executa os próximos comandos como o usuário logado `userId`. */
export async function comoUsuario(db: PGliteInterface, userId: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await db.exec("set role authenticated");
}

/** Executa os próximos comandos como visitante sem login. */
export async function comoAnonimo(db: PGliteInterface) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
  await db.exec("set role anon");
}

/** Executa os próximos comandos como o servidor (chave secreta). */
export async function comoServidor(db: PGliteInterface) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
  await db.exec("set role service_role");
}

export async function comoSuperusuario(db: PGliteInterface) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
}

/** Hash SHA-256 (hex) fictício, só para os testes. */
export function hashFalso(seed: string): string {
  return seed.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a");
}
