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

const TABELAS = [
  "profiles",
  "clients",
  "posts",
  "post_slides",
  "approval_links",
  "approval_events",
] as const;

type Dados = {
  ana: string;
  bruno: string;
  clienteDaAna: string;
  postDaAna: string;
  slideDaAna: string;
  linkDaAna: string;
  eventoDaAna: string;
};

let db: PGliteInterface;
let d: Dados;

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}

async function contar(tabela: string): Promise<number> {
  return Number(await umValor<number>(`select count(*) from public.${tabela}`));
}

/** Ana tem um cliente com um post, um slide, um link e um evento. Bruno não tem nada. */
async function popular(): Promise<Dados> {
  const ana = await criarUsuario(db, "ana@exemplo.com", "Ana Souza");
  const bruno = await criarUsuario(db, "bruno@exemplo.com", "Bruno Lima");

  await comoUsuario(db, ana);
  const clienteDaAna = await umValor<string>(
    "insert into public.clients (name, instagram_handle) values ('Padaria Pão Quente', 'paoquente') returning id",
  );
  // Posts e mídias só são criados pela função create_post.
  const postDaAna = crypto.randomUUID();
  await db.query("select public.create_post($1, $2, 'Promoção de sexta!', null, $3)", [
    postDaAna,
    clienteDaAna,
    JSON.stringify([{ media_type: "image", storage_path: `${ana}/${clienteDaAna}/${postDaAna}/1.jpg` }]),
  ]);
  const slideDaAna = await umValor<string>("select id from public.post_slides");
  const linkDaAna = await umValor<string>(
    "insert into public.approval_links (client_id, token_hash, expires_at) values ($1, $2, now() + interval '7 days') returning id",
    [clienteDaAna, hashFalso("a1")],
  );

  // Eventos são gravados pelo servidor (fluxo do link mágico).
  await comoServidor(db);
  const eventoDaAna = await umValor<string>(
    "insert into public.approval_events (owner_id, post_id, approval_link_id, action) values ($1, $2, $3, 'approved') returning id",
    [ana, postDaAna, linkDaAna],
  );

  await comoSuperusuario(db);
  return { ana, bruno, clienteDaAna, postDaAna, slideDaAna, linkDaAna, eventoDaAna };
}

// Monta o banco uma vez e entrega uma cópia limpa para cada teste.
let modelo: PGliteInterface;

beforeAll(async () => {
  modelo = db = await criarBanco();
  d = await popular();
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

describe("estrutura", () => {
  it("todas as tabelas de public têm RLS habilitado", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABELAS].sort());
    for (const linha of rows) {
      expect(linha.relrowsecurity, `RLS desligado em ${linha.relname}`).toBe(true);
    }
  });

  it("cria o profile automaticamente no cadastro, com o nome informado", async () => {
    await comoUsuario(db, d.ana);
    const nome = await umValor<string>("select full_name from public.profiles");
    expect(nome).toBe("Ana Souza");
  });
});

describe("dono dos dados", () => {
  it("a Ana vê os próprios dados", async () => {
    await comoUsuario(db, d.ana);
    for (const tabela of TABELAS) {
      expect(await contar(tabela), tabela).toBe(1);
    }
  });

  it("owner_id é preenchido com o usuário logado", async () => {
    await comoUsuario(db, d.ana);
    const dono = await umValor<string>("select owner_id from public.clients");
    expect(dono).toBe(d.ana);
  });

  it("a Ana edita o próprio nome no perfil", async () => {
    await comoUsuario(db, d.ana);
    await db.query("update public.profiles set full_name = 'Ana S.'");
    expect(await umValor("select full_name from public.profiles")).toBe("Ana S.");
  });
});

describe("isolamento entre social medias", () => {
  it("o Bruno não vê nada da Ana", async () => {
    await comoUsuario(db, d.bruno);
    expect(await contar("profiles")).toBe(1); // só o próprio perfil
    for (const tabela of TABELAS.filter((t) => t !== "profiles")) {
      expect(await contar(tabela), tabela).toBe(0);
    }
  });

  it("o Bruno não consegue editar nem apagar dados da Ana", async () => {
    await comoUsuario(db, d.bruno);
    const alteracoes = [
      await db.query("update public.profiles set full_name = 'hack' where id = $1", [d.ana]),
      await db.query("update public.clients set name = 'hack' where id = $1", [d.clienteDaAna]),
      await db.query("update public.approval_links set revoked_at = now() where id = $1", [d.linkDaAna]),
      await db.query("delete from public.posts where id = $1", [d.postDaAna]),
      await db.query("delete from public.approval_links where id = $1", [d.linkDaAna]),
      await db.query("delete from public.clients where id = $1", [d.clienteDaAna]),
    ];
    for (const resultado of alteracoes) {
      expect(resultado.affectedRows).toBe(0);
    }

    await comoUsuario(db, d.ana);
    for (const tabela of TABELAS) {
      expect(await contar(tabela), tabela).toBe(1);
    }
    expect(await umValor("select name from public.clients")).toBe("Padaria Pão Quente");
  });

  it("o Bruno não consegue criar registros em nome da Ana", async () => {
    await comoUsuario(db, d.bruno);
    await expect(
      db.query("insert into public.clients (owner_id, name) values ($1, 'X')", [d.ana]),
    ).rejects.toThrow(/row-level security/);
  });

  it("o Bruno não consegue criar post nem link no cliente da Ana", async () => {
    await comoUsuario(db, d.bruno);
    // create_post grava sempre com o owner_id de quem chamou: a FK composta bloqueia.
    await expect(
      db.query("select public.create_post($1, $2, '', null, $3)", [
        crypto.randomUUID(),
        d.clienteDaAna,
        JSON.stringify([{ media_type: "image", storage_path: `${d.bruno}/x.jpg` }]),
      ]),
    ).rejects.toThrow(/foreign key/);
    await expect(
      db.query(
        "insert into public.approval_links (client_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')",
        [d.clienteDaAna, hashFalso("b1")],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("o Bruno não consegue editar o post da Ana pela update_post", async () => {
    await comoUsuario(db, d.bruno);
    await expect(
      db.query("select public.update_post($1, 'hack', null)", [d.postDaAna]),
    ).rejects.toThrow(/post_nao_encontrado/);
    await comoUsuario(db, d.ana);
    expect(await umValor("select caption from public.posts")).toBe("Promoção de sexta!");
  });

  it("a Ana não consegue transferir um cliente para o Bruno", async () => {
    await comoUsuario(db, d.ana);
    await expect(
      db.query("update public.clients set owner_id = $1", [d.bruno]),
    ).rejects.toThrow(/row-level security/);
  });

  it("slide só aponta para arquivos na pasta do próprio dono", async () => {
    await comoUsuario(db, d.ana);
    await expect(
      db.query("select public.update_post($1, '', null, $2)", [
        d.postDaAna,
        JSON.stringify([{ media_type: "image", storage_path: `${d.bruno}/arquivo.jpg` }]),
      ]),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("integridade do status (só o cliente aprova)", () => {
  it("o social media não altera posts nem mídias direto na tabela", async () => {
    await comoUsuario(db, d.ana);
    for (const sql of [
      "update public.posts set status = 'approved'",
      "update public.posts set caption = 'trocada sem reenviar'",
      "update public.post_slides set storage_path = storage_path",
      "delete from public.post_slides",
    ]) {
      await expect(db.query(sql), sql).rejects.toThrow(/permission denied/);
    }
    await expect(
      db.query("insert into public.posts (client_id, status) values ($1, 'approved')", [
        d.clienteDaAna,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it("o social media ainda pode apagar o próprio post (as mídias vão junto)", async () => {
    await comoUsuario(db, d.ana);
    await db.query("delete from public.posts where id = $1", [d.postDaAna]);
    expect(await contar("posts")).toBe(0);
    expect(await contar("post_slides")).toBe(0);
  });
});

describe("visitante sem login (anon)", () => {
  it("não tem acesso a nenhuma tabela", async () => {
    await comoAnonimo(db);
    for (const tabela of TABELAS) {
      await expect(contar(tabela), tabela).rejects.toThrow(/permission denied/);
    }
  });

  it("não consegue inserir", async () => {
    await comoAnonimo(db);
    await expect(
      db.query("insert into public.clients (owner_id, name) values ($1, 'X')", [d.ana]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("approval_links", () => {
  it("o social media só pode alterar revoked_at", async () => {
    await comoUsuario(db, d.ana);
    await db.query("update public.approval_links set revoked_at = now()");
    expect(await umValor("select revoked_at is not null from public.approval_links")).toBe(true);

    for (const coluna of ["token_hash = $1", "expires_at = now() + interval '1 year'"]) {
      await expect(
        db.query(
          `update public.approval_links set ${coluna}`,
          coluna.includes("$1") ? [hashFalso("ff")] : [],
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("exige expiração no futuro e hash SHA-256 válido", async () => {
    await comoUsuario(db, d.ana);
    await expect(
      db.query(
        "insert into public.approval_links (client_id, token_hash, expires_at) values ($1, $2, now() - interval '1 minute')",
        [d.clienteDaAna, hashFalso("c1")],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        "insert into public.approval_links (client_id, token_hash, expires_at) values ($1, 'token-em-texto-puro', now() + interval '1 day')",
        [d.clienteDaAna],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("approval_events", () => {
  it("o social media não consegue gravar, editar nem apagar eventos", async () => {
    await comoUsuario(db, d.ana);
    await expect(
      db.query(
        "insert into public.approval_events (owner_id, post_id, action) values ($1, $2, 'approved')",
        [d.ana, d.postDaAna],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("update public.approval_events set action = 'changes_requested'"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query("delete from public.approval_events")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("o histórico não pode ser alterado nem pelo servidor", async () => {
    await comoServidor(db);
    await expect(
      db.query("update public.approval_events set comment = 'editado' where id = $1", [
        d.eventoDaAna,
      ]),
    ).rejects.toThrow(/não pode ser alterado/);
  });

  it("registra data e hora automaticamente", async () => {
    await comoUsuario(db, d.ana);
    const criadoEm = await umValor<Date>("select created_at from public.approval_events");
    expect(criadoEm).toBeInstanceOf(Date);
  });

  it("pedido de ajuste exige comentário", async () => {
    await comoServidor(db);
    await expect(
      db.query(
        "insert into public.approval_events (owner_id, post_id, action, comment) values ($1, $2, 'changes_requested', '  ')",
        [d.ana, d.postDaAna],
      ),
    ).rejects.toThrow(/check constraint/);
    await db.query(
      "insert into public.approval_events (owner_id, post_id, action, comment) values ($1, $2, 'changes_requested', 'Trocar a foto')",
      [d.ana, d.postDaAna],
    );
  });

  it("o evento precisa ser do mesmo dono do post e do link", async () => {
    await comoServidor(db);
    await expect(
      db.query(
        "insert into public.approval_events (owner_id, post_id, action) values ($1, $2, 'approved')",
        [d.bruno, d.postDaAna],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("o histórico continua ao apagar o link (perde só a referência)", async () => {
    await comoUsuario(db, d.ana);
    await db.query("delete from public.approval_links where id = $1", [d.linkDaAna]);
    expect(await contar("approval_events")).toBe(1);
    expect(await umValor("select approval_link_id from public.approval_events")).toBeNull();
  });
});

describe("storage (bucket post-media)", () => {
  it("o bucket é privado", async () => {
    expect(await umValor("select public from storage.buckets where id = 'post-media'")).toBe(
      false,
    );
  });

  it("cada social media só envia e lê arquivos na própria pasta", async () => {
    await comoUsuario(db, d.ana);
    await db.query(
      "insert into storage.objects (bucket_id, name) values ('post-media', $1)",
      [`${d.ana}/${d.clienteDaAna}/foto.jpg`],
    );
    await expect(
      db.query("insert into storage.objects (bucket_id, name) values ('post-media', $1)", [
        `${d.bruno}/foto.jpg`,
      ]),
    ).rejects.toThrow(/row-level security/);
    expect(Number(await umValor("select count(*) from storage.objects"))).toBe(1);

    await comoUsuario(db, d.bruno);
    expect(Number(await umValor("select count(*) from storage.objects"))).toBe(0);
    const apagados = await db.query("delete from storage.objects");
    expect(apagados.affectedRows).toBe(0);
  });
});
