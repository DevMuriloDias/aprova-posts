-- Edição/reenvio de posts e áudio nos pedidos de ajuste.
--
-- 1. Versões: cada edição do post gera uma nova versão e o devolve para
--    aprovação. Cada evento guarda a versão que o cliente avaliou.
-- 2. Integridade do status: só o cliente (via register_approval) aprova ou
--    pede ajuste. O social media não altera posts/mídias direto pela API;
--    usa create_post e update_post, que sempre deixam o post aguardando.
-- 3. Áudio: o pedido de ajuste pode ter um áudio gravado pelo cliente,
--    guardado na pasta do dono no bucket post-media.

-- ---------------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------------

alter table public.posts
  add column version integer not null default 1 check (version >= 1),
  add column resubmitted_at timestamptz;

alter table public.approval_events
  add column post_version integer not null default 1 check (post_version >= 1),
  add column audio_path text,
  add constraint approval_events_audio_path_do_dono
    check (audio_path is null or split_part(audio_path, '/', 1) = owner_id::text);

-- Pedido de ajuste precisa de comentário OU áudio.
alter table public.approval_events
  drop constraint approval_events_check;
alter table public.approval_events
  add constraint approval_events_ajuste_explicado check (
    action <> 'changes_requested'
    or char_length(trim(coalesce(comment, ''))) > 0
    or audio_path is not null
  );

-- ---------------------------------------------------------------------------
-- Privilégios: posts e mídias só mudam pelas funções
-- ---------------------------------------------------------------------------

revoke insert, update on table public.posts from authenticated;
revoke insert, update, delete on table public.post_slides from authenticated;
-- Continua podendo: ler posts/mídias e apagar posts (as mídias vão junto).

-- ---------------------------------------------------------------------------
-- Bucket: aceitar áudio
-- ---------------------------------------------------------------------------

update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime',
     'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'
   ]
 where id = 'post-media';

-- ---------------------------------------------------------------------------
-- create_post: agora SECURITY DEFINER (o social media não insere direto)
-- ---------------------------------------------------------------------------

create or replace function public.create_post(
  p_id uuid,
  p_client_id uuid,
  p_caption text,
  p_scheduled_for timestamptz,
  p_slides jsonb
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

  -- A FK composta (client_id, owner_id) garante que o cliente é de quem chamou.
  insert into public.posts (id, owner_id, client_id, caption, scheduled_for, status)
  values (p_id, v_dono, p_client_id, coalesce(p_caption, ''), p_scheduled_for, 'pending_approval')
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

-- ---------------------------------------------------------------------------
-- update_post: edita e devolve o post para aprovação (nova versão)
-- ---------------------------------------------------------------------------

-- p_slides = null mantém as mídias atuais. Retorna os caminhos das mídias
-- removidas, para o app apagar os arquivos do storage.
create function public.update_post(
  p_id uuid,
  p_caption text,
  p_scheduled_for timestamptz,
  p_slides jsonb default null
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dono uuid := auth.uid();
  v_removidos text[] := '{}';
begin
  if v_dono is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  perform 1 from public.posts where id = p_id and owner_id = v_dono for update;
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

  update public.posts
     set caption = coalesce(p_caption, ''),
         scheduled_for = p_scheduled_for,
         status = 'pending_approval',
         version = version + 1,
         resubmitted_at = now()
   where id = p_id;

  return v_removidos;
end;
$$;

revoke execute on function public.update_post(uuid, text, timestamptz, jsonb) from public, anon;
grant execute on function public.update_post(uuid, text, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- get_audio_upload_folder: onde o servidor pode gravar o áudio do cliente
-- ---------------------------------------------------------------------------

create function public.get_audio_upload_folder(p_token_hash text, p_post_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.approval_links;
begin
  select * into v_link from public.approval_links where token_hash = p_token_hash;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'link_invalido' using errcode = 'P0001';
  end if;

  perform 1
     from public.posts
    where id = p_post_id
      and client_id = v_link.client_id
      and owner_id = v_link.owner_id
      and status <> 'draft';
  if not found then
    raise exception 'post_invalido' using errcode = 'P0001';
  end if;

  return format('%s/%s/%s/audios/', v_link.owner_id, v_link.client_id, p_post_id);
end;
$$;

revoke execute on function public.get_audio_upload_folder(text, uuid)
  from public, anon, authenticated;
grant execute on function public.get_audio_upload_folder(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- register_approval: grava a versão avaliada e o áudio
-- ---------------------------------------------------------------------------

drop function public.register_approval(text, uuid, public.approval_action, text);

create function public.register_approval(
  p_token_hash text,
  p_post_id uuid,
  p_action public.approval_action,
  p_comment text default null,
  p_audio_path text default null
)
returns public.approval_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.approval_links;
  v_post public.posts;
  v_event public.approval_events;
begin
  select * into v_link from public.approval_links where token_hash = p_token_hash;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'link_invalido' using errcode = 'P0001';
  end if;

  select * into v_post
    from public.posts
   where id = p_post_id
     and client_id = v_link.client_id
     and owner_id = v_link.owner_id
     and status <> 'draft'
     for update;
  if not found then
    raise exception 'post_invalido' using errcode = 'P0001';
  end if;

  -- O áudio precisa estar na pasta deste post e já ter sido enviado.
  if p_audio_path is not null then
    if p_audio_path not like format('%s/%s/%s/audios/%%', v_link.owner_id, v_link.client_id, v_post.id)
       or p_audio_path like '%..%'
       or not exists (
         select 1 from storage.objects
          where bucket_id = 'post-media' and name = p_audio_path
       ) then
      raise exception 'audio_invalido' using errcode = 'P0001';
    end if;
  end if;

  insert into public.approval_events
    (owner_id, post_id, approval_link_id, action, comment, audio_path, post_version)
  values (
    v_link.owner_id,
    v_post.id,
    v_link.id,
    p_action,
    nullif(trim(coalesce(p_comment, '')), ''),
    p_audio_path,
    v_post.version
  )
  returning * into v_event;

  update public.posts
     set status = p_action::text::public.post_status
   where id = v_post.id;

  return v_event;
end;
$$;

revoke execute on function public.register_approval(text, uuid, public.approval_action, text, text)
  from public, anon, authenticated;
grant execute on function public.register_approval(text, uuid, public.approval_action, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- get_approval_page: inclui versão, reenvio e áudio
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
