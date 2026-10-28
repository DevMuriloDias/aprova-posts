-- Avisos para o social media quando o cliente responde.
--
-- 1. No painel: "Novidades" mostra as respostas mais recentes; o que chegou
--    depois de profiles.events_seen_at aparece como novo.
-- 2. Por e-mail (opcional): depois de register_approval, o servidor chama
--    get_event_notification para montar o aviso.

-- ---------------------------------------------------------------------------
-- Novidades no painel
-- ---------------------------------------------------------------------------

-- Começa em now(): respostas antigas não aparecem como novas.
alter table public.profiles
  add column events_seen_at timestamptz not null default now();

grant update (events_seen_at) on table public.profiles to authenticated;

-- Marca as novidades como vistas, com o horário do banco (não do navegador).
create function public.mark_events_seen()
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  update public.profiles
     set events_seen_at = now()
   where id = (select auth.uid())
  returning events_seen_at;
$$;

revoke execute on function public.mark_events_seen() from public, anon;
grant execute on function public.mark_events_seen() to authenticated;

-- ---------------------------------------------------------------------------
-- Dados do e-mail de aviso (só o servidor)
-- ---------------------------------------------------------------------------

create function public.get_event_notification(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email', u.email,
    'owner_name', pr.full_name,
    'client_id', c.id,
    'client_name', c.name,
    'post_id', p.id,
    'caption', p.caption,
    'action', e.action,
    'comment', e.comment,
    'has_audio', e.audio_path is not null,
    'created_at', e.created_at,
    -- Quantos posts do cliente ainda esperam aprovação (aguardando ou com ajuste).
    'remaining', (
      select count(*)
        from public.posts p2
       where p2.client_id = c.id
         and p2.owner_id = e.owner_id
         and p2.status in ('pending_approval', 'changes_requested')
    ),
    'total', (
      select count(*)
        from public.posts p2
       where p2.client_id = c.id
         and p2.owner_id = e.owner_id
         and p2.status <> 'draft'
    )
  )
  from public.approval_events e
  join public.posts p on p.id = e.post_id and p.owner_id = e.owner_id
  join public.clients c on c.id = p.client_id and c.owner_id = e.owner_id
  join public.profiles pr on pr.id = e.owner_id
  join auth.users u on u.id = e.owner_id
  where e.id = p_event_id;
$$;

revoke execute on function public.get_event_notification(uuid) from public, anon, authenticated;
grant execute on function public.get_event_notification(uuid) to service_role;
