# Aprova Posts

SaaS para social medias enviarem posts de Instagram para os clientes aprovarem por um link mágico.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Supabase (Auth, Postgres e Storage).

## Como rodar

Requisitos: Node.js 22+ e um projeto no [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env.local   # preencha com os dados do seu projeto
npm run dev                  # http://localhost:3000
```

### Banco de dados

As migrations ficam em `supabase/migrations/`. Para aplicar no seu projeto com o Supabase CLI:

```bash
npx supabase init            # só na primeira vez (cria supabase/config.toml)
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
npm run db:types             # regenera src/types/database.ts
```

### Autenticação (Supabase → Authentication)

- **URL Configuration**: em *Site URL* use o valor de `NEXT_PUBLIC_SITE_URL` e adicione
  `http://localhost:3000/auth/confirm` (e o equivalente em produção) em *Redirect URLs*.
- **Confirmação de e-mail** (recomendado): em *Email Templates → Confirm signup*, troque o link por
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&proximo=/painel`.
  Assim a confirmação funciona mesmo se o e-mail for aberto em outro aparelho.
  O link padrão do Supabase também funciona, desde que aberto no mesmo navegador do cadastro.

## Scripts

| Comando             | O que faz                                          |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                        |
| `npm run build`     | Build de produção                                  |
| `npm test`          | Todos os testes (unitários + RLS do banco)         |
| `npm run lint`      | ESLint                                             |
| `npm run typecheck` | Checagem de tipos                                  |
| `npm run db:types`  | Gera os tipos do banco a partir do projeto linkado |

Os testes do banco rodam as migrations de verdade num Postgres em memória
([PGlite](https://pglite.dev)), com um stub mínimo do Supabase (`tests/db/supabase-stub.sql`).
Não precisam de Docker nem de conexão com o Supabase.

## Estrutura

```
src/
  app/
    (auth)/entrar, (auth)/cadastro   telas de login e cadastro + server actions
    auth/confirm                     destino do link de confirmação de e-mail
    painel/                          área logada: clientes, posts, link e status
    a/[token]/                       página do cliente (sem login, pelo link mágico)
  lib/
    auth/                            validação, rotas, serviço de login/cadastro
    aprovacao/                       página do link e registro das decisões
    painel/                          cadastro de clientes/posts, geração de link
    links/token.ts                   geração e hash dos tokens
    supabase/                        clientes do Supabase (servidor, navegador, admin e proxy)
    env.ts, env-servidor.ts          validação das variáveis de ambiente
  proxy.ts                           renova a sessão e protege /painel
  types/database.ts                  tipos do banco
supabase/migrations/                 esquema, RLS e storage
tests/db/                            testes de RLS e das funções do banco
```

## Modelo de dados

| Tabela            | Para quê                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| `profiles`        | Um por social media (criado automaticamente no cadastro)                 |
| `clients`         | Clientes do social media                                                 |
| `posts`           | Posts de um cliente (legenda, status, data prevista)                     |
| `post_slides`     | Mídias do post (1 ou até 20 num carrossel), no bucket privado `post-media` |
| `approval_links`  | Links mágicos: só o hash SHA-256 do token, com expiração e revogação     |
| `approval_events` | Histórico imutável de aprovações e pedidos de ajuste, com data e hora    |

Todas as tabelas têm RLS: cada social media só enxerga e altera os próprios dados.
O papel `anon` não tem acesso a nenhuma tabela nem função.

## Fluxo de aprovação

1. No painel, o social media cadastra o cliente, cria os posts (as mídias sobem direto do
   navegador para a pasta dele no bucket) e clica em **Gerar link**.
2. O app gera um token aleatório de 256 bits, grava só o hash SHA-256 e mostra a URL
   `/a/<token>` uma única vez. O link vale 30 dias; gerar outro revoga o anterior, e há o
   botão **Revogar link**.
3. O cliente abre o link (sem login). O servidor calcula o hash e chama
   `get_approval_page` com a chave secreta; a função valida o link a cada acesso e devolve
   só os posts daquele cliente. As mídias são exibidas por URLs assinadas válidas por 1 hora.
4. Cada **Aprovar** / **Pedir ajuste** chama `register_approval`, que valida o link de novo,
   grava em `approval_events` (com data e hora) e atualiza o status do post.
5. O painel mostra o status de cada post, o último comentário (ou áudio) e o histórico.

**Áudio:** no "Pedir ajuste", o cliente pode escrever, gravar um áudio de até 3 minutos, ou os
dois. O servidor valida o link (`get_audio_upload_folder`), grava o arquivo na pasta do post no
bucket e só então registra o evento; se o registro falhar, o áudio é apagado.

**Editar e reenviar:** no painel, "Ajustar e reenviar" (ou "Editar") troca a legenda, a data e,
se quiser, as mídias. O post ganha uma nova versão e volta para "Aguardando aprovação"; o cliente
vê o aviso "Post ajustado" com o que tinha pedido. Cada resposta guarda a versão avaliada.

**Avisos:** em **Novidades** (no topo do painel) aparecem as últimas respostas dos clientes, com
um contador do que chegou desde a última visita. Se `RESEND_API_KEY` estiver configurada, o
social media também recebe um e-mail em todo pedido de ajuste e quando o cliente aprova o último
post pendente (aprovações intermediárias não geram e-mail, para não lotar a caixa de entrada).

**Confirmação de e-mail:** se o link de confirmação falhar ou o e-mail não chegar, a tela de
entrar oferece **Reenviar e-mail de confirmação** (a resposta é a mesma exista ou não a conta).

A página do link envia `Referrer-Policy: no-referrer` (o token não vaza para outros sites),
`X-Robots-Tag: noindex` e `Cache-Control: private, no-store`.
