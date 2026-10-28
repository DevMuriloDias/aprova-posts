-- Calendário (reagendar) e exclusão de clientes e posts.

-- ---------------------------------------------------------------------------
-- reschedule_post: muda só a data/hora prevista
-- ---------------------------------------------------------------------------

-- Diferente de update_post, não gera nova versão nem pede nova aprovação:
-- o conteúdo que o cliente avaliou continua o mesmo. O cliente vê a nova data.
create function public.reschedule_post(p_id uuid, p_scheduled_for timestamptz)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  update public.posts
     set scheduled_for = p_scheduled_for
   where id = p_id and owner_id = auth.uid()
  returning * into v_post;

  if not found then
    raise exception 'post_nao_encontrado' using errcode = 'P0002';
  end if;
  return v_post;
end;
$$;

revoke execute on function public.reschedule_post(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_post(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Exclusão: apaga e devolve os arquivos do storage que ficaram sem uso
-- ---------------------------------------------------------------------------

-- O apagar em cascata leva junto posts, mídias, links e histórico. O app usa
-- a lista devolvida para apagar os arquivos no bucket (o RLS do storage só
-- deixa apagar na pasta do dono).

create function public.delete_post(p_id uuid)
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
      select e.audio_path from public.approval_events e
       where e.post_id = p_id and e.audio_path is not null
    ) arquivos;

  -- RLS: só apaga se o post for de quem chamou.
  delete from public.posts where id = p_id;
  if not found then
    raise exception 'post_nao_encontrado' using errcode = 'P0002';
  end if;

  return v_arquivos;
end;
$$;

create function public.delete_client(p_id uuid)
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

revoke execute on function public.delete_post(uuid) from public, anon;
revoke execute on function public.delete_client(uuid) from public, anon;
grant execute on function public.delete_post(uuid) to authenticated;
grant execute on function public.delete_client(uuid) to authenticated;
