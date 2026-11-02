-- Capa dos posts.
--
-- Uma imagem opcional, separada das mídias do carrossel, que aparece na
-- "Grade do perfil" do cliente (como a capa de um Reels no Instagram).
-- Fica na pasta do post no armazenamento, como as outras mídias.

alter table public.posts
  add column cover_path text,
  add constraint posts_cover_path_do_dono
    check (cover_path is null or split_part(cover_path, '/', 1) = owner_id::text);

-- ---------------------------------------------------------------------------
-- create_post: aceita a capa
-- ---------------------------------------------------------------------------

drop function public.create_post(uuid, uuid, text, timestamptz, jsonb);

create function public.create_post(
  p_id uuid,
  p_client_id uuid,
  p_caption text,
  p_scheduled_for timestamptz,
  p_slides jsonb,
  p_cover_path text default null
)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dono uuid := auth.uid();
  v_post public.posts;
begin
  if v_dono is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_slides) is distinct from 'array'
     or jsonb_array_length(p_slides) not between 1 and 20 then
    raise exception 'slides_invalidos' using errcode = '22023';
  end if;

  -- A FK composta (client_id, owner_id) garante que o cliente é de quem chamou;
  -- o check de cover_path garante que a capa está na pasta do dono.
  insert into public.posts (id, owner_id, client_id, caption, scheduled_for, status, cover_path)
  values (
    p_id, v_dono, p_client_id, coalesce(p_caption, ''), p_scheduled_for, 'pending_approval',
    nullif(p_cover_path, '')
  )
  returning * into v_post;

  insert into public.post_slides (owner_id, post_id, position, media_type, storage_path)
  select
    v_dono,
    v_post.id,
    (s.ordem - 1)::smallint,
    (s.valor ->> 'media_type')::public.media_type,
    s.valor ->> 'storage_path'
  from jsonb_array_elements(p_slides) with ordinality as s (valor, ordem);

  return v_post;
end;
$$;

revoke execute on function public.create_post(uuid, uuid, text, timestamptz, jsonb, text) from public, anon;
grant execute on function public.create_post(uuid, uuid, text, timestamptz, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_post: troca ou remove a capa
-- ---------------------------------------------------------------------------

drop function public.update_post(uuid, text, timestamptz, jsonb);

-- p_slides = null mantém as mídias; p_cover_path = null mantém a capa
-- (a não ser que p_remover_capa = true). Retorna os arquivos que saíram.
create function public.update_post(
  p_id uuid,
  p_caption text,
  p_scheduled_for timestamptz,
  p_slides jsonb default null,
  p_cover_path text default null,
  p_remover_capa boolean default false
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dono uuid := auth.uid();
  v_post public.posts;
  v_removidos text[] := '{}';
  v_capa text;
begin
  if v_dono is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select * into v_post from public.posts where id = p_id and owner_id = v_dono for update;
  if not found then
    raise exception 'post_nao_encontrado' using errcode = 'P0002';
  end if;

  if p_slides is not null then
    if jsonb_typeof(p_slides) is distinct from 'array'
       or jsonb_array_length(p_slides) not between 1 and 20 then
      raise exception 'slides_invalidos' using errcode = '22023';
    end if;

    select coalesce(array_agg(storage_path order by position), '{}')
      into v_removidos
      from public.post_slides
     where post_id = p_id;

    delete from public.post_slides where post_id = p_id;

    insert into public.post_slides (owner_id, post_id, position, media_type, storage_path)
    select
      v_dono,
      p_id,
      (s.ordem - 1)::smallint,
      (s.valor ->> 'media_type')::public.media_type,
      s.valor ->> 'storage_path'
    from jsonb_array_elements(p_slides) with ordinality as s (valor, ordem);

    -- Um arquivo reaproveitado na nova lista não deve ser apagado.
    select coalesce(array_agg(c), '{}')
      into v_removidos
      from unnest(v_removidos) as c
     where c not in (select storage_path from public.post_slides where post_id = p_id);
  end if;

  -- Capa: nova, removida ou a mesma de antes.
  v_capa := case
    when nullif(p_cover_path, '') is not null then p_cover_path
    when p_remover_capa then null
    else v_post.cover_path
  end;
  if v_post.cover_path is not null and v_post.cover_path is distinct from v_capa then
    v_removidos := v_removidos || v_post.cover_path;
  end if;

  update public.posts
     set caption = coalesce(p_caption, ''),
         scheduled_for = p_scheduled_for,
         cover_path = v_capa,
         status = 'pending_approval',
         version = version + 1,
         resubmitted_at = now()
   where id = p_id;

  return v_removidos;
end;
$$;

revoke execute on function public.update_post(uuid, text, timestamptz, jsonb, text, boolean) from public, anon;
grant execute on function public.update_post(uuid, text, timestamptz, jsonb, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Exclusão: a capa também é devolvida para sair do armazenamento
-- ---------------------------------------------------------------------------

create or replace function public.delete_post(p_id uuid)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_arquivos text[];
begin
  select coalesce(array_agg(caminho), '{}') into v_arquivos
    from (
      select s.storage_path as caminho from public.post_slides s where s.post_id = p_id
      union
      select p.cover_path from public.posts p where p.id = p_id and p.cover_path is not null
      union
      select e.audio_path from public.approval_events e
       where e.post_id = p_id and e.audio_path is not null
    ) arquivos;

  delete from public.posts where id = p_id;
  if not found then
    raise exception 'post_nao_encontrado' using errcode = 'P0002';
  end if;

  return v_arquivos;
end;
$$;

create or replace function public.delete_client(p_id uuid)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_arquivos text[];
begin
  select coalesce(array_agg(caminho), '{}') into v_arquivos
    from (
      select c.avatar_path as caminho from public.clients c
       where c.id = p_id and c.avatar_path is not null
      union
      select p.cover_path from public.posts p
       where p.client_id = p_id and p.cover_path is not null
      union
      select s.storage_path from public.post_slides s
        join public.posts p on p.id = s.post_id
       where p.client_id = p_id
      union
      select e.audio_path from public.approval_events e
        join public.posts p on p.id = e.post_id
       where p.client_id = p_id and e.audio_path is not null
    ) arquivos;

  delete from public.clients where id = p_id;
  if not found then
    raise exception 'cliente_nao_encontrado' using errcode = 'P0002';
  end if;

  return v_arquivos;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_approval_page: inclui a capa
-- ---------------------------------------------------------------------------

create or replace function public.get_approval_page(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.approval_links;
  v_client public.clients;
begin
  select * into v_link from public.approval_links where token_hash = p_token_hash;
  if not found then
    return null;
  end if;
  if v_link.revoked_at is not null then
    return jsonb_build_object('state', 'revoked');
  end if;
  if v_link.expires_at <= now() then
    return jsonb_build_object('state', 'expired');
  end if;

  update public.approval_links set last_accessed_at = now() where id = v_link.id;

  select * into v_client
    from public.clients
   where id = v_link.client_id and owner_id = v_link.owner_id;

  return jsonb_build_object(
    'state', 'active',
    'expires_at', v_link.expires_at,
    'client', jsonb_build_object(
      'name', v_client.name,
      'instagram_handle', v_client.instagram_handle,
      'avatar_path', v_client.avatar_path
    ),
    'posts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'caption', p.caption,
          'status', p.status,
          'scheduled_for', p.scheduled_for,
          'version', p.version,
          'cover_path', p.cover_path,
          'resubmitted_at', p.resubmitted_at,
          'slides', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'position', s.position,
                'media_type', s.media_type,
                'storage_path', s.storage_path
              )
              order by s.position
            )
            from public.post_slides s
            where s.post_id = p.id and s.owner_id = v_link.owner_id
          ), '[]'::jsonb),
          'last_event', (
            select jsonb_build_object(
              'action', e.action,
              'comment', e.comment,
              'audio_path', e.audio_path,
              'post_version', e.post_version,
              'created_at', e.created_at
            )
            from public.approval_events e
            where e.post_id = p.id
            order by e.created_at desc
            limit 1
          )
        )
        order by p.scheduled_for asc nulls last, p.created_at asc
      )
      from public.posts p
      where p.client_id = v_link.client_id
        and p.owner_id = v_link.owner_id
        and p.status <> 'draft'
    ), '[]'::jsonb)
  );
end;
$$;
