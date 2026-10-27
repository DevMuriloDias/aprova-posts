-- Esquema inicial do aprova-posts.
--
-- Regra central: cada social media só acessa os próprios dados.
-- Toda tabela tem owner_id (ou id, no caso de profiles) ligado a auth.uid(),
-- RLS habilitado e políticas apenas para o papel "authenticated".
-- O papel "anon" não recebe nenhum privilégio: o acesso do cliente final
-- (link mágico) será feito pelo servidor, nunca direto pelo navegador.
--
-- As chaves estrangeiras compostas (id, owner_id) garantem que um registro
-- filho sempre pertença ao mesmo dono do registro pai. Assim não é possível,
-- por exemplo, criar um post apontando para o cliente de outro social media.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.post_status as enum (
  'draft',              -- rascunho, ainda não enviado ao cliente
  'pending_approval',   -- aguardando aprovação do cliente
  'approved',           -- aprovado pelo cliente
  'changes_requested'   -- cliente pediu ajuste
);

create type public.media_type as enum ('image', 'video');

create type public.approval_action as enum ('approved', 'changes_requested');

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: um registro por social media (usuário do Supabase Auth)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando um usuário se cadastra.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- clients: clientes de cada social media
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  instagram_handle text check (instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check (avatar_path is null or split_part(avatar_path, '/', 1) = owner_id::text)
);

create index clients_owner_id_idx on public.clients (owner_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- posts: posts de Instagram de um cliente
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  client_id uuid not null,
  caption text not null default '' check (char_length(caption) <= 2200),
  status public.post_status not null default 'draft',
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (client_id, owner_id)
    references public.clients (id, owner_id) on delete cascade
);

create index posts_owner_id_idx on public.posts (owner_id);
create index posts_client_id_idx on public.posts (client_id, scheduled_for);

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- post_slides: mídias de um post (1 para post simples, até 20 em carrossel)
-- ---------------------------------------------------------------------------

create table public.post_slides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid not null,
  position smallint not null check (position between 0 and 19),
  media_type public.media_type not null default 'image',
  -- Caminho no bucket "post-media". Sempre começa com "<owner_id>/".
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (post_id, position) deferrable initially immediate,
  foreign key (post_id, owner_id)
    references public.posts (id, owner_id) on delete cascade,
  check (split_part(storage_path, '/', 1) = owner_id::text)
);

create index post_slides_owner_id_idx on public.post_slides (owner_id);

-- ---------------------------------------------------------------------------
-- approval_links: links mágicos enviados ao cliente
-- ---------------------------------------------------------------------------

create table public.approval_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  client_id uuid not null,
  -- Guardamos só o hash SHA-256 (hex) do token. O token em si aparece
  -- apenas uma vez, na URL enviada ao cliente, e nunca é salvo no banco.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (client_id, owner_id)
    references public.clients (id, owner_id) on delete cascade,
  check (expires_at > created_at)
);

create index approval_links_owner_id_idx on public.approval_links (owner_id);
create index approval_links_client_id_idx on public.approval_links (client_id);

-- ---------------------------------------------------------------------------
-- approval_events: histórico imutável de aprovações e pedidos de ajuste
-- ---------------------------------------------------------------------------

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null,
  approval_link_id uuid,
  action public.approval_action not null,
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (post_id, owner_id)
    references public.posts (id, owner_id) on delete cascade,
  foreign key (approval_link_id, owner_id)
    references public.approval_links (id, owner_id)
    on delete set null (approval_link_id),
  -- Pedido de ajuste precisa dizer o que ajustar.
  check (
    action <> 'changes_requested'
    or char_length(trim(coalesce(comment, ''))) > 0
  )
);

create index approval_events_owner_id_idx on public.approval_events (owner_id);
create index approval_events_post_id_idx on public.approval_events (post_id, created_at);

-- O histórico não pode ser editado, nem pelo service_role.
-- Única exceção: o "on delete set null" quando o link é apagado.
-- (Exclusão só acontece em cascata, quando o post é apagado.)
create function public.prevent_approval_event_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approval_link_id is not null
     and new.approval_link_id is null
     and (new.id, new.owner_id, new.post_id, new.action, new.comment, new.created_at)
         is not distinct from
         (old.id, old.owner_id, old.post_id, old.action, old.comment, old.created_at)
  then
    return new;
  end if;
  raise exception 'O histórico de aprovações não pode ser alterado.';
end;
$$;

create trigger approval_events_no_update
  before update on public.approval_events
  for each row execute function public.prevent_approval_event_update();

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

-- O Supabase concede tudo a anon/authenticated por padrão; restringimos.
revoke all on table
  public.profiles,
  public.clients,
  public.posts,
  public.post_slides,
  public.approval_links,
  public.approval_events
from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table
  public.clients,
  public.posts,
  public.post_slides
to authenticated;
-- No link, o social media só pode criar, revogar (revoked_at) e apagar.
grant select, insert, delete on table public.approval_links to authenticated;
grant update (revoked_at) on table public.approval_links to authenticated;
-- Eventos são gravados pelo servidor no fluxo do link mágico.
grant select on table public.approval_events to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.posts enable row level security;
alter table public.post_slides enable row level security;
alter table public.approval_links enable row level security;
alter table public.approval_events enable row level security;

-- profiles
create policy "Social media vê o próprio perfil"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Social media edita o próprio perfil"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- clients
create policy "Social media vê os próprios clientes"
  on public.clients for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Social media cria clientes para si"
  on public.clients for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Social media edita os próprios clientes"
  on public.clients for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Social media apaga os próprios clientes"
  on public.clients for delete to authenticated
  using (owner_id = (select auth.uid()));

-- posts
create policy "Social media vê os próprios posts"
  on public.posts for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Social media cria posts para si"
  on public.posts for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Social media edita os próprios posts"
  on public.posts for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Social media apaga os próprios posts"
  on public.posts for delete to authenticated
  using (owner_id = (select auth.uid()));

-- post_slides
create policy "Social media vê as próprias mídias"
  on public.post_slides for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Social media cria mídias para si"
  on public.post_slides for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Social media edita as próprias mídias"
  on public.post_slides for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Social media apaga as próprias mídias"
  on public.post_slides for delete to authenticated
  using (owner_id = (select auth.uid()));

-- approval_links
create policy "Social media vê os próprios links"
  on public.approval_links for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Social media cria links para si"
  on public.approval_links for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Social media revoga os próprios links"
  on public.approval_links for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Social media apaga os próprios links"
  on public.approval_links for delete to authenticated
  using (owner_id = (select auth.uid()));

-- approval_events (somente leitura para o social media)
create policy "Social media vê o histórico dos próprios posts"
  on public.approval_events for select to authenticated
  using (owner_id = (select auth.uid()));
