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

## Forma de trabalhar

- **Sempre escrever testes** para o que for implementado ou alterado (incluindo regras de acesso/RLS e validação dos links mágicos).
- **Ao final de cada tarefa, explicar o que mudou**: arquivos alterados, o motivo e como testar.
