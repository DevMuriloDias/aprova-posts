# CLAUDE.md

Contexto do projeto **aprova-posts** para o Claude Code.

## Produto

SaaS em português (pt-BR) para **social medias** enviarem posts de Instagram para os **clientes** aprovarem.

## Usuários

- **Social media**: tem conta e faz login (Supabase Auth). Gerencia os próprios clientes e posts.
- **Cliente final**: **não tem login**. Acessa os posts por um **link mágico** enviado pelo social media.

## Fluxo principal

1. O social media faz login e sobe os posts (imagens/vídeos + legenda) de um cliente.
2. O sistema gera um link mágico e o cliente o recebe.
3. O cliente abre o link e vê os posts **simulando o feed do Instagram**.
4. Para cada post, o cliente **aprova** ou **pede ajuste** (com comentário).
5. Toda ação fica **registrada com data e hora** (histórico/auditoria).

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Supabase**: Auth, Postgres e Storage

## Regras obrigatórias

- **Isolamento de dados**: um social media só pode ver os próprios clientes e posts.
  **RLS habilitado em todas as tabelas**, sem exceção, com políticas baseadas em `auth.uid()`.
- **Links mágicos**: tokens gerados de forma criptograficamente aleatória (não sequenciais nem previsíveis) e **com data de expiração**. Validar o token e a expiração no servidor a cada acesso; o acesso do cliente fica restrito aos posts vinculados àquele link.
- **Segredos**: nunca colocar chaves, tokens ou senhas no código. Usar apenas variáveis de ambiente (`.env.local`, que não é versionado). A `service_role` key do Supabase só pode ser usada no servidor, nunca exposta ao navegador.
- **Idioma**: todos os textos da interface em **pt-BR**.
- **Mobile-first**: projetar primeiro para telas pequenas e depois ampliar com os breakpoints do Tailwind.
- **Registro de ações**: aprovações e pedidos de ajuste sempre gravados com data e hora (`timestamptz`).

## Convenções do código

- **Next.js 16**: o middleware agora se chama `src/proxy.ts`. `cacheComponents` está ligado, então
  qualquer leitura de cookies/sessão precisa ficar dentro de `<Suspense>`. Veja `AGENTS.md`.
- Supabase no servidor: `criarClienteSupabase()` em `src/lib/supabase/server.ts` (usa a sessão, passa pelo RLS).
  Para checar o usuário, use `supabase.auth.getClaims()` (nunca confie em `getSession()` no servidor).
- Regras de negócio ficam em `src/lib/**` como funções testáveis; Server Actions só fazem a ligação.
- Toda tabela nova: `owner_id default auth.uid()`, FK composta `(id, owner_id)` para o pai,
  `revoke` do `anon`, RLS ligado e políticas para `authenticated`. O teste
  `tests/db/rls.test.ts` falha se alguma tabela de `public` ficar sem RLS.
- Links mágicos: salvar só o hash SHA-256 do token (`approval_links.token_hash`), nunca o token.
  O acesso do cliente passa só pelas funções `get_approval_page`, `get_audio_upload_folder` e
  `register_approval` (executáveis apenas pelo `service_role`), chamadas no servidor via
  `criarClienteAdmin()`. O cliente admin só pode, além disso, assinar URLs das mídias que essas
  funções devolvem, gravar o áudio na pasta devolvida por `get_audio_upload_folder` e chamar
  `get_event_notification` para montar o e-mail de aviso ao social media.
- Avisos: e-mail (opcional, via Resend, só com `RESEND_API_KEY`) em todo pedido de ajuste e quando
  o cliente aprova o último post pendente; enviado com `after()` para não atrasar o cliente. No
  painel, "Novidades" usa `profiles.events_seen_at`.
- Status do post: só o cliente aprova ou pede ajuste (`register_approval`). O social media não tem
  INSERT/UPDATE em `posts` nem em `post_slides`; cria e edita pelas funções `create_post` e
  `update_post`, e toda edição gera uma nova versão que volta para aprovação.
- Identidade visual própria: não usar logo, ícones, gradiente ou cores do Instagram. Use as cores
  do tema em `src/app/globals.css` (`marca-*` azul-petróleo, `destaque` verde-limão, `fundo` creme,
  `tinta`), não cores soltas; status: verde aprovado, âmbar ajuste, azul aguardando.
- Calendário: datas agrupadas no horário de Brasília (`src/lib/calendario`). Reagendar
  (`reschedule_post`) muda só a data e não pede nova aprovação; editar conteúdo (`update_post`) pede.
- Exclusão: `delete_client` / `delete_post` apagam em cascata e devolvem os arquivos para o app
  remover do storage. O histórico some junto: a interface sempre pede confirmação.
- Variáveis de ambiente: documentar em `.env.example` e validar em `src/lib/env.ts`.

## Comandos

- `npm test`: testes unitários (Vitest) + testes de RLS, que rodam as migrations num Postgres em memória (PGlite)
- `npm run lint`, `npm run typecheck`, `npm run build`
- Migrations em `supabase/migrations/` (`npx supabase db push`)

## Forma de trabalhar

- **Sempre escrever testes** para o que for implementado ou alterado (incluindo regras de acesso/RLS e validação dos links mágicos).
- **Ao final de cada tarefa, explicar o que mudou**: arquivos alterados, o motivo e como testar.
