-- Fluxo de aprovação pelo link mágico.
--
-- O cliente final não tem login. O servidor do app recebe o token da URL,
-- calcula o hash SHA-256 e chama get_approval_page / register_approval com a
-- chave secreta (service_role). Essas funções são o único caminho até os
-- dados do cliente: validam o link (existe, não revogado, não expirado) a cada
-- chamada e só enxergam os posts do cliente e do dono daquele link.

-- ---------------------------------------------------------------------------
-- create_post: cria o post e suas mídias de uma vez (social media logado)
-- ---------------------------------------------------------------------------

create function public.create_post(
  p_id uuid,
  p_client_id uuid,
  p_caption text,
  p_scheduled_for timestamptz,
  p_slides jsonb
)
returns public.posts
language plpgsql
security invoker -- roda com as permissões e o RLS de quem chamou
set search_path = ''
as $$
declare
  v_post public.posts;
begin
  if jsonb_typeof(p_slides) is distinct from 'array'
     or jsonb_array_length(p_slides) not between 1 and 20 then
    raise exception 'slides_invalidos' using errcode = '22023';
  end if;

  insert into public.posts (id, client_id, caption, scheduled_for, status)
  values (p_id, p_client_id, coalesce(p_caption, ''), p_scheduled_for, 'pending_approval')
  returning * into v_post;

  insert into public.post_slides (post_id, position, media_type, storage_path)
  select
    v_post.id,
    (s.ordem - 1)::smallint,
    (s.valor ->> 'media_type')::public.media_type,
    s.valor ->> 'storage_path'
  from jsonb_array_elements(p_slides) with ordinality as s (valor, ordem);

  return v_post;
end;
$$;

revoke execute on function public.create_post(uuid, uuid, text, timestamptz, jsonb)
  from public, anon;
grant execute on function public.create_post(uuid, uuid, text, timestamptz, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- create_approval_link: um link ativo por cliente, válido por 30 dias
-- ---------------------------------------------------------------------------

create function public.create_approval_link(p_client_id uuid, p_token_hash text)
returns public.approval_links
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_link public.approval_links;
begin
  -- Pelo RLS, só encontra se o cliente for de quem chamou.
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'cliente_nao_encontrado' using errcode = 'P0002';
  end if;

  -- Gerar um novo link revoga os anteriores.
  update public.approval_links
     set revoked_at = now()
   where client_id = p_client_id
     and revoked_at is null;

  insert into public.approval_links (client_id, token_hash, expires_at)
  values (p_client_id, p_token_hash, now() + interval '30 days')
  returning * into v_link;

  return v_link;
end;
$$;

revoke execute on function public.create_approval_link(uuid, text) from public, anon;
grant execute on function public.create_approval_link(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_approval_page: dados que o cliente vê ao abrir o link
-- ---------------------------------------------------------------------------

-- Retorna null se o token não existir, {"state": "revoked" | "expired"} se o
-- link não puder mais ser usado, ou a página completa com "state": "active".
create function public.get_approval_page(p_token_hash text)
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

revoke execute on function public.get_approval_page(text) from public, anon, authenticated;
grant execute on function public.get_approval_page(text) to service_role;

-- ---------------------------------------------------------------------------
-- register_approval: grava a decisão do cliente e atualiza o status do post
-- ---------------------------------------------------------------------------

create function public.register_approval(
  p_token_hash text,
  p_post_id uuid,
  p_action public.approval_action,
  p_comment text default null
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

  insert into public.approval_events (owner_id, post_id, approval_link_id, action, comment)
  values (
    v_link.owner_id,
    v_post.id,
    v_link.id,
    p_action,
    nullif(trim(coalesce(p_comment, '')), '')
  )
  returning * into v_event;

  update public.posts
     set status = p_action::text::public.post_status
   where id = v_post.id;

  return v_event;
end;
$$;

revoke execute on function public.register_approval(text, uuid, public.approval_action, text)
  from public, anon, authenticated;
grant execute on function public.register_approval(text, uuid, public.approval_action, text)
  to service_role;
