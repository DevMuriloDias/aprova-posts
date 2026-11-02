-- As mídias podem ficar no Cloudflare R2 (e não só no Supabase Storage).
--
-- register_approval checava se o áudio existia em storage.objects, o que só
-- vale para o Supabase Storage. Quem envia o áudio é o próprio servidor, logo
-- antes de chamar esta função (que só o service_role executa), então basta
-- garantir que o caminho está na pasta do post validada pelo link.

create or replace function public.register_approval(
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

  -- O áudio precisa estar na pasta deste post.
  if p_audio_path is not null then
    if p_audio_path not like format('%s/%s/%s/audios/%%', v_link.owner_id, v_link.client_id, v_post.id)
       or p_audio_path like '%..%'
       or p_audio_path like '%/' then
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
