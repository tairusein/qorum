alter table public.profiles
  add column avatar_path text;

drop policy if exists "Authenticated users can view usernames" on public.profiles;
create policy "Everyone can view public profiles"
  on public.profiles for select to anon, authenticated
  using (true);

revoke select on public.profiles from anon, authenticated;
grant select (id, username, avatar_path) on public.profiles to anon, authenticated;
grant update (username, avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public avatars can be viewed by everyone"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create table public.public_chat_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index public_chat_messages_created_idx
  on public.public_chat_messages (created_at desc);
create index public_chat_messages_sender_created_idx
  on public.public_chat_messages (sender_id, created_at desc);

alter table public.public_chat_messages enable row level security;

create policy "Everyone can read public chat"
  on public.public_chat_messages for select to anon, authenticated
  using (true);

create policy "Signed-in users can send public chat messages"
  on public.public_chat_messages for insert to authenticated
  with check (sender_id = (select auth.uid()));

grant select on public.public_chat_messages to anon, authenticated;
grant insert on public.public_chat_messages to authenticated;
grant usage, select on sequence public.public_chat_messages_id_seq to authenticated;

create function public.enforce_public_chat_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sent_recently integer;
  last_sent timestamptz;
  check_now timestamptz := clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.sender_id::text, 0));

  select count(*), max(messages.created_at)
  into sent_recently, last_sent
  from public.public_chat_messages as messages
  where messages.sender_id = new.sender_id
    and messages.created_at > check_now - interval '1 minute';

  if sent_recently >= 20 or last_sent > check_now - interval '2 seconds' then
    raise exception 'Please wait before sending another public chat message';
  end if;

  return new;
end;
$$;

create trigger enforce_public_chat_rate_limit_before_insert
  before insert on public.public_chat_messages
  for each row execute function public.enforce_public_chat_rate_limit();

revoke all on function public.enforce_public_chat_rate_limit() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'public_chat_messages'
  ) then
    alter publication supabase_realtime add table public.public_chat_messages;
  end if;
end;
$$;
