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

type Pagina = {
  state: string;
  expires_at: string;
  client: { name: string; instagram_handle: string | null; avatar_path: string | null };
  posts: {
    id: string;
    caption: string;
    status: string;
    slides: { position: number; media_type: string; storage_path: string }[];
    last_event: { action: string; comment: string | null; created_at: string } | null;
  }[];
};

const HASH_ANA = hashFalso("a1");
const HASH_BRUNO = hashFalso("b1");

let modelo: PGliteInterface;
let db: PGliteInterface;
let ana: string;
let bruno: string;
let padaria: string;
let academia: string;
let clienteBruno: string;
let postAgendado: string;
let postSemData: string;
let rascunho: string;
let postAcademia: string;
let postBruno: string;

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0])[0];
}

function slides(dono: string, cliente: string, post: string, n = 1) {
  return JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      media_type: "image",
      storage_path: `${dono}/${cliente}/${post}/${i}.jpg`,
    })),
  );
}

async function criarPost(
  dono: string,
  cliente: string,
  agendado: string | null,
  n = 1,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.query("select public.create_post($1, $2, $3, $4, $5)", [
    id,
    cliente,
    `Legenda ${id.slice(0, 4)}`,
    agendado,
    slides(dono, cliente, id, n),
  ]);
  return id;
}

async function pagina(hash: string): Promise<Pagina | null> {
  await comoServidor(db);
  return umValor<Pagina | null>("select public.get_approval_page($1)", [hash]);
}

async function registrar(hash: string, post: string, acao: string, comentario?: string) {
  await comoServidor(db);
  return db.query<{ id: string; action: string; created_at: Date }>(
    "select * from public.register_approval($1, $2, $3, $4)",
    [hash, post, acao, comentario ?? null],
  );
}

beforeAll(async () => {
  modelo = db = await criarBanco();
  ana = await criarUsuario(db, "ana@exemplo.com", "Ana");
  bruno = await criarUsuario(db, "bruno@exemplo.com", "Bruno");

  await comoUsuario(db, ana);
  padaria = await umValor(
    "insert into public.clients (name, instagram_handle) values ('Padaria', 'padaria') returning id",
  );
  academia = await umValor(
    "insert into public.clients (name) values ('Academia') returning id",
  );
  // Criados fora de ordem para testar a ordenação por data agendada.
  postSemData = await criarPost(ana, padaria, null);
  postAgendado = await criarPost(ana, padaria, "2026-11-05T12:00:00Z", 3);
  rascunho = await criarPost(ana, padaria, "2026-11-01T12:00:00Z");
  await db.query("update public.posts set status = 'draft' where id = $1", [rascunho]);
  postAcademia = await criarPost(ana, academia, null);
  await db.query("select public.create_approval_link($1, $2)", [padaria, HASH_ANA]);

  await comoUsuario(db, bruno);
  clienteBruno = await umValor(
    "insert into public.clients (name) values ('Loja do Bruno') returning id",
  );
  postBruno = await criarPost(bruno, clienteBruno, null);
  await db.query("select public.create_approval_link($1, $2)", [clienteBruno, HASH_BRUNO]);

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

describe("create_post", () => {
  it("cria o post aguardando aprovação, com os slides na ordem", async () => {
    await comoUsuario(db, ana);
    const { rows } = await db.query<{ position: number; storage_path: string }>(
      "select position, storage_path from public.post_slides where post_id = $1 order by position",
      [postAgendado],
    );
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(rows[2].storage_path).toBe(`${ana}/${padaria}/${postAgendado}/2.jpg`);
    expect(
      await umValor("select status from public.posts where id = $1", [postAgendado]),
    ).toBe("pending_approval");
  });

  it("exige de 1 a 20 mídias", async () => {
    await comoUsuario(db, ana);
    for (const lista of ["[]", slides(ana, padaria, "x", 21), '{"a":1}']) {
      await expect(
        db.query("select public.create_post($1, $2, '', null, $3)", [
          crypto.randomUUID(),
          padaria,
          lista,
        ]),
      ).rejects.toThrow(/slides_invalidos/);
    }
  });

  it("é atômico: se uma mídia for inválida, o post não é criado", async () => {
    await comoUsuario(db, ana);
    const id = crypto.randomUUID();
    const mistura = JSON.stringify([
      { media_type: "image", storage_path: `${ana}/ok.jpg` },
      { media_type: "image", storage_path: `${bruno}/roubada.jpg` },
    ]);
    await expect(
      db.query("select public.create_post($1, $2, '', null, $3)", [id, padaria, mistura]),
    ).rejects.toThrow(/check constraint/);
    expect(Number(await umValor("select count(*) from public.posts where id = $1", [id]))).toBe(0);
  });

  it("não deixa criar post no cliente de outro social media", async () => {
    await comoUsuario(db, bruno);
    await expect(
      db.query("select public.create_post($1, $2, '', null, $3)", [
        crypto.randomUUID(),
        padaria,
        slides(bruno, padaria, "x"),
      ]),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("create_approval_link", () => {
  it("cria o link com validade de 30 dias", async () => {
    await comoUsuario(db, ana);
    const dias = await umValor<number>(
      "select round(extract(epoch from expires_at - created_at) / 86400) from public.approval_links where token_hash = $1",
      [HASH_ANA],
    );
    expect(Number(dias)).toBe(30);
  });

  it("gerar um novo link revoga o anterior (um link ativo por cliente)", async () => {
    await comoUsuario(db, ana);
    const novo = hashFalso("a2");
    await db.query("select public.create_approval_link($1, $2)", [padaria, novo]);
    const { rows } = await db.query<{ token_hash: string; ativo: boolean }>(
      "select token_hash, revoked_at is null as ativo from public.approval_links where client_id = $1",
      [padaria],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.token_hash === HASH_ANA)?.ativo).toBe(false);
    expect(rows.find((r) => r.token_hash === novo)?.ativo).toBe(true);

    expect(await pagina(HASH_ANA)).toEqual({ state: "revoked" });
    expect((await pagina(novo))?.state).toBe("active");
  });

  it("não revoga links de outros clientes", async () => {
    await comoUsuario(db, ana);
    await db.query("select public.create_approval_link($1, $2)", [academia, hashFalso("c1")]);
    expect((await pagina(HASH_ANA))?.state).toBe("active");
  });

  it("não cria link para cliente de outro social media", async () => {
    await comoUsuario(db, bruno);
    await expect(
      db.query("select public.create_approval_link($1, $2)", [padaria, hashFalso("b9")]),
    ).rejects.toThrow(/cliente_nao_encontrado/);
  });
});

describe("get_approval_page", () => {
  it("mostra o cliente e os posts dele, sem rascunhos, na ordem de publicação", async () => {
    const p = (await pagina(HASH_ANA))!;
    expect(p.state).toBe("active");
    expect(p.client).toEqual({ name: "Padaria", instagram_handle: "padaria", avatar_path: null });
    expect(p.posts.map((x) => x.id)).toEqual([postAgendado, postSemData]);
    expect(p.posts[0].slides.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(p.posts[0].last_event).toBeNull();
  });

  it("não vaza posts de outros clientes nem de outros social medias", async () => {
    const ids = (await pagina(HASH_ANA))!.posts.map((x) => x.id);
    expect(ids).not.toContain(postAcademia);
    expect(ids).not.toContain(postBruno);
    expect(ids).not.toContain(rascunho);
    expect((await pagina(HASH_BRUNO))!.posts.map((x) => x.id)).toEqual([postBruno]);
  });

  it("retorna null para token inexistente", async () => {
    expect(await pagina(hashFalso("ff"))).toBeNull();
  });

  it("informa quando o link expirou", async () => {
    await comoSuperusuario(db);
    await db.query(
      "update public.approval_links set created_at = now() - interval '31 days', expires_at = now() - interval '1 day' where token_hash = $1",
      [HASH_ANA],
    );
    expect(await pagina(HASH_ANA)).toEqual({ state: "expired" });
  });

  it("informa quando o link foi revogado", async () => {
    await comoUsuario(db, ana);
    await db.query("update public.approval_links set revoked_at = now() where token_hash = $1", [
      HASH_ANA,
    ]);
    expect(await pagina(HASH_ANA)).toEqual({ state: "revoked" });
  });

  it("registra o último acesso", async () => {
    await pagina(HASH_ANA);
    await comoUsuario(db, ana);
    expect(
      await umValor(
        "select last_accessed_at is not null from public.approval_links where token_hash = $1",
        [HASH_ANA],
      ),
    ).toBe(true);
  });
});

describe("register_approval", () => {
  it("aprova: grava o evento com data e hora e atualiza o status", async () => {
    const { rows } = await registrar(HASH_ANA, postAgendado, "approved");
    expect(rows[0].action).toBe("approved");
    expect(rows[0].created_at).toBeInstanceOf(Date);

    await comoUsuario(db, ana);
    expect(await umValor("select status from public.posts where id = $1", [postAgendado])).toBe(
      "approved",
    );
    const evento = await db.query<{ approval_link_id: string; owner_id: string }>(
      "select approval_link_id, owner_id from public.approval_events where post_id = $1",
      [postAgendado],
    );
    expect(evento.rows[0].owner_id).toBe(ana);
    expect(evento.rows[0].approval_link_id).not.toBeNull();
  });

  it("pede ajuste com comentário e aparece como último evento na página", async () => {
    await registrar(HASH_ANA, postSemData, "approved");
    await registrar(HASH_ANA, postSemData, "changes_requested", "  Trocar a foto  ");
    const post = (await pagina(HASH_ANA))!.posts.find((x) => x.id === postSemData)!;
    expect(post.status).toBe("changes_requested");
    expect(post.last_event).toMatchObject({
      action: "changes_requested",
      comment: "Trocar a foto",
    });

    await comoUsuario(db, ana);
    expect(
      Number(await umValor("select count(*) from public.approval_events where post_id = $1", [postSemData])),
    ).toBe(2);
  });

  it("pedido de ajuste sem comentário é recusado", async () => {
    await expect(registrar(HASH_ANA, postSemData, "changes_requested", "   ")).rejects.toThrow(
      /check constraint/,
    );
  });

  it.each([
    ["de outro cliente do mesmo social media", () => postAcademia],
    ["de outro social media", () => postBruno],
    ["em rascunho", () => rascunho],
    ["inexistente", () => crypto.randomUUID()],
  ])("recusa post %s", async (_nome, post) => {
    await expect(registrar(HASH_ANA, post(), "approved")).rejects.toThrow(/post_invalido/);
  });

  it("recusa link revogado, expirado ou inexistente", async () => {
    await expect(registrar(hashFalso("ff"), postAgendado, "approved")).rejects.toThrow(
      /link_invalido/,
    );

    await comoSuperusuario(db);
    await db.query(
      "update public.approval_links set created_at = now() - interval '31 days', expires_at = now() - interval '1 second' where token_hash = $1",
      [HASH_ANA],
    );
    await expect(registrar(HASH_ANA, postAgendado, "approved")).rejects.toThrow(/link_invalido/);

    await comoUsuario(db, bruno);
    await db.query("update public.approval_links set revoked_at = now()");
    await expect(registrar(HASH_BRUNO, postBruno, "approved")).rejects.toThrow(/link_invalido/);
  });
});

describe("permissões das funções", () => {
  it("visitante e social media não chamam as funções do link direto", async () => {
    for (const papel of ["anon", "usuario"] as const) {
      if (papel === "anon") await comoAnonimo(db);
      else await comoUsuario(db, ana);
      await expect(
        db.query("select public.get_approval_page($1)", [HASH_ANA]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select public.register_approval($1, $2, 'approved')", [HASH_ANA, postAgendado]),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("visitante não cria posts nem links", async () => {
    await comoAnonimo(db);
    await expect(
      db.query("select public.create_approval_link($1, $2)", [padaria, hashFalso("z1")]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.create_post($1, $2, '', null, '[]')", [crypto.randomUUID(), padaria]),
    ).rejects.toThrow(/permission denied/);
  });

  it("nenhuma função de public pode ser executada pelo anon", async () => {
    const { rows } = await db.query<{ proname: string }>(
      `select p.proname
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and has_function_privilege('anon', p.oid, 'execute')
          and p.prorettype <> 'trigger'::regtype`,
    );
    expect(rows.map((r) => r.proname)).toEqual([]);
  });
});
