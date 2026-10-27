create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(new.raw_user_meta_data ->> 'username', '');
  if requested_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 letters, numbers, or underscores';
  end if;

  insert into public.profiles (id, username)
  values (new.id, requested_username);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;

create policy "Authenticated users can view usernames"
  on public.profiles for select to authenticated
  using (true);

create policy "Users can update their own username"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;

create table public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint direct_messages_distinct_users check (sender_id <> recipient_id)
);

create index direct_messages_conversation_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);
create index direct_messages_recipient_idx
  on public.direct_messages (recipient_id, created_at desc);

alter table public.direct_messages enable row level security;

create policy "Participants can read direct messages"
  on public.direct_messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

create policy "Users can send direct messages as themselves"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id <> (select auth.uid())
  );

grant select, insert on public.direct_messages to authenticated;
grant usage, select on sequence public.direct_messages_id_seq to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end;
$$;

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null check (game_id in ('snake', 'sky-hop', 'pocket-pong', 'memory-garden')),
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  constraint game_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index game_sessions_user_game_idx on public.game_sessions (user_id, game_id);
create unique index game_sessions_one_open_per_user_idx
  on public.game_sessions (user_id)
  where ended_at is null;
alter table public.game_sessions enable row level security;

create policy "Users can view their own game sessions"
  on public.game_sessions for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.game_sessions to authenticated;

create function public.start_game_session(p_game_id text)
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

create function public.heartbeat_game_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_sessions
  set last_heartbeat_at = clock_timestamp()
  where id = p_session_id
    and user_id = (select auth.uid())
    and ended_at is null;
  if not found then
    raise exception 'Active game session not found';
  end if;
end;
$$;

create function public.finish_game_session(p_session_id uuid)
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

revoke all on function public.start_game_session(text) from public, anon;
revoke all on function public.heartbeat_game_session(uuid) from public, anon;
revoke all on function public.finish_game_session(uuid) from public, anon;
grant execute on function public.start_game_session(text) to authenticated;
grant execute on function public.heartbeat_game_session(uuid) to authenticated;
grant execute on function public.finish_game_session(uuid) to authenticated;

create function public.get_public_game_stats()
returns table (game_id text, total_seconds bigint, player_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sessions.game_id,
    sum(
      case
        when sessions.ended_at is null then greatest(
          0,
          floor(extract(epoch from (
            least(statement_timestamp(), sessions.last_heartbeat_at + interval '45 seconds') - sessions.started_at
          )))::bigint
        )
        else sessions.duration_seconds::bigint
      end
    )::bigint as total_seconds,
    count(distinct sessions.user_id) as player_count
  from public.game_sessions as sessions
  group by sessions.game_id
  order by sessions.game_id;
$$;

revoke all on function public.get_public_game_stats() from public;
grant execute on function public.get_public_game_stats() to anon, authenticated;
