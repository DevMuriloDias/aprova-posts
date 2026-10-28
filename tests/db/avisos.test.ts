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
let posts: string[];

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}

async function responder(post: string, acao: string, comentario: string | null = null) {
  await comoServidor(db);
  return umValor<string>(
    "select id from public.register_approval($1, $2, $3, $4, null)",
    [HASH, post, acao, comentario],
  );
}

type Aviso = {
  email: string;
  owner_name: string;
  client_id: string;
  client_name: string;
  post_id: string;
  caption: string;
  action: string;
  comment: string | null;
  has_audio: boolean;
  remaining: number;
  total: number;
};

async function aviso(eventoId: string) {
  await comoServidor(db);
  return umValor<Aviso | null>("select public.get_event_notification($1)", [eventoId]);
}

beforeAll(async () => {
  modelo = db = await criarBanco();
  ana = await criarUsuario(db, "ana@exemplo.com", "Ana Souza");
  bruno = await criarUsuario(db, "bruno@exemplo.com", "Bruno");
  await comoUsuario(db, ana);
  cliente = await umValor("insert into public.clients (name) values ('Padaria') returning id");
  posts = [];
  for (let i = 0; i < 2; i++) {
    const id = crypto.randomUUID();
    await db.query("select public.create_post($1, $2, $3, null, $4)", [
      id,
      cliente,
      `Legenda ${i + 1}`,
      JSON.stringify([{ media_type: "image", storage_path: `${ana}/${cliente}/${id}/0.jpg` }]),
    ]);
    posts.push(id);
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

describe("novidades no painel", () => {
  it("respostas antigas não aparecem como novas; as seguintes sim", async () => {
    await comoUsuario(db, ana);
    const vistoEm = await umValor<Date>("select events_seen_at from public.profiles");
    await responder(posts[0], "approved");

    await comoUsuario(db, ana);
    const novas = Number(
      await umValor(
        "select count(*) from public.approval_events e join public.profiles p on p.id = e.owner_id where e.created_at > p.events_seen_at",
      ),
    );
    expect(novas).toBe(1);
    expect(vistoEm).toBeInstanceOf(Date);
  });

  it("mark_events_seen atualiza só o próprio perfil", async () => {
    await responder(posts[0], "approved");
    await comoUsuario(db, ana);
    const antes = await umValor<Date>("select events_seen_at from public.profiles");
    const depois = await umValor<Date>("select public.mark_events_seen()");
    expect(depois.getTime()).toBeGreaterThan(antes.getTime());

    await comoSuperusuario(db);
    const doBruno = await umValor<Date>("select events_seen_at from public.profiles where id = $1", [
      bruno,
    ]);
    expect(doBruno.getTime()).toBeLessThan(depois.getTime());
  });

  it("o social media só altera events_seen_at e o nome, não outros perfis", async () => {
    await comoUsuario(db, bruno);
    const r = await db.query("update public.profiles set events_seen_at = now() where id = $1", [
      ana,
    ]);
    expect(r.affectedRows).toBe(0);
  });

  it("visitante não marca novidades", async () => {
    await comoAnonimo(db);
    await expect(db.query("select public.mark_events_seen()")).rejects.toThrow(/permission denied/);
  });
});

describe("get_event_notification (e-mail de aviso)", () => {
  it("traz o e-mail do social media, o cliente, o post e a resposta", async () => {
    const evento = await responder(posts[0], "changes_requested", "Trocar a foto");
    expect(await aviso(evento)).toMatchObject({
      email: "ana@exemplo.com",
      owner_name: "Ana Souza",
      client_id: cliente,
      client_name: "Padaria",
      post_id: posts[0],
      caption: "Legenda 1",
      action: "changes_requested",
      comment: "Trocar a foto",
      has_audio: false,
      remaining: 2,
      total: 2,
    });
  });

  it("conta quantos posts ainda faltam aprovar", async () => {
    await responder(posts[0], "approved");
    const ultimo = await responder(posts[1], "approved");
    expect(await aviso(ultimo)).toMatchObject({ remaining: 0, total: 2 });
  });

  it("evento inexistente devolve null", async () => {
    expect(await aviso(crypto.randomUUID())).toBeNull();
  });

  it("só o servidor consulta (o e-mail do dono não vaza)", async () => {
    const evento = await responder(posts[0], "approved");
    for (const papel of ["anon", "ana"] as const) {
      if (papel === "anon") await comoAnonimo(db);
      else await comoUsuario(db, ana);
      await expect(
        db.query("select public.get_event_notification($1)", [evento]),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
