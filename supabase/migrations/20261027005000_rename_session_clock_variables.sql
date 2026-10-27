create or replace function public.start_game_session(p_game_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_id uuid;
  session_now timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_game_id is null or p_game_id not in ('snake', 'sky-hop', 'pocket-pong', 'memory-garden') then
    raise exception 'Unknown game';
  end if;

  update public.game_sessions
  set ended_at = session_now,
      duration_seconds = greatest(
        0,
        floor(extract(epoch from (least(session_now, last_heartbeat_at + interval '45 seconds') - started_at)))::integer
      )
  where user_id = (select auth.uid())
    and ended_at is null;

  insert into public.game_sessions (user_id, game_id, started_at, last_heartbeat_at)
  values ((select auth.uid()), p_game_id, session_now, session_now)
  returning id into session_id;
  return session_id;
end;
$$;

create or replace function public.finish_game_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_now timestamptz := clock_timestamp();
begin
  update public.game_sessions
  set ended_at = session_now,
      duration_seconds = greatest(
        0,
        floor(extract(epoch from (least(session_now, last_heartbeat_at + interval '45 seconds') - started_at)))::integer
      )
  where id = p_session_id
    and user_id = (select auth.uid())
    and ended_at is null;
  if not found then
    raise exception 'Active game session not found';
  end if;
end;
$$;
