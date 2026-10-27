create table public.account_recovery_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  recovery_code_hash text not null check (recovery_code_hash ~ '^[0-9a-f]{64}$'),
  claim_id uuid,
  claim_expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_recovery_claim_pair check (
    (claim_id is null and claim_expires_at is null)
    or (claim_id is not null and claim_expires_at is not null)
  )
);

alter table public.account_recovery_keys enable row level security;

create function public.store_account_recovery_key(p_recovery_code_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := (select auth.uid());
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;
  if p_recovery_code_hash is null or p_recovery_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid recovery code hash';
  end if;

  insert into public.account_recovery_keys (user_id, recovery_code_hash)
  values (account_id, p_recovery_code_hash)
  on conflict (user_id) do update
  set recovery_code_hash = excluded.recovery_code_hash,
      claim_id = null,
      claim_expires_at = null,
      created_at = now();
end;
$$;

create function public.claim_account_recovery_code(
  p_username text,
  p_recovery_code_hash text,
  p_claim_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid;
begin
  if p_username is null
    or p_username !~ '^[A-Za-z0-9_]{3,24}$'
    or p_recovery_code_hash is null
    or p_recovery_code_hash !~ '^[0-9a-f]{64}$'
    or p_claim_id is null then
    return null;
  end if;

  select profiles.id into account_id
  from public.profiles as profiles
  join public.account_recovery_keys as recovery on recovery.user_id = profiles.id
  where lower(profiles.username) = lower(p_username)
    and recovery.recovery_code_hash = p_recovery_code_hash
    and (recovery.claim_expires_at is null or recovery.claim_expires_at <= clock_timestamp())
  for update of recovery;

  if account_id is null then
    return null;
  end if;

  update public.account_recovery_keys
  set claim_id = p_claim_id,
      claim_expires_at = clock_timestamp() + interval '2 minutes'
  where user_id = account_id;

  return account_id;
end;
$$;

create function public.consume_account_recovery_code(p_user_id uuid, p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.account_recovery_keys
  where user_id = p_user_id
    and claim_id = p_claim_id;
  if not found then
    raise exception 'Recovery code claim not found';
  end if;
end;
$$;

create function public.release_account_recovery_code(p_user_id uuid, p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_recovery_keys
  set claim_id = null,
      claim_expires_at = null
  where user_id = p_user_id
    and claim_id = p_claim_id;
end;
$$;

revoke all on function public.store_account_recovery_key(text) from public, anon;
revoke all on function public.claim_account_recovery_code(text, text, uuid) from public, anon, authenticated;
revoke all on function public.consume_account_recovery_code(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_account_recovery_code(uuid, uuid) from public, anon, authenticated;
grant execute on function public.store_account_recovery_key(text) to authenticated;
grant execute on function public.claim_account_recovery_code(text, text, uuid) to service_role;
grant execute on function public.consume_account_recovery_code(uuid, uuid) to service_role;
grant execute on function public.release_account_recovery_code(uuid, uuid) to service_role;
