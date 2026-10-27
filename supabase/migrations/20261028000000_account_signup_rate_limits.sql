create table public.account_signup_attempts (
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);

create index account_signup_attempts_ip_time_idx
  on public.account_signup_attempts (ip_hash, attempted_at desc);
create index account_signup_attempts_time_idx
  on public.account_signup_attempts (attempted_at);

alter table public.account_signup_attempts enable row level security;

create function public.allow_account_signup(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_time timestamptz := clock_timestamp();
  recent_attempts integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0));

  delete from public.account_signup_attempts
  where attempted_at < current_time - interval '24 hours';

  select count(*) into recent_attempts
  from public.account_signup_attempts
  where ip_hash = p_ip_hash
    and attempted_at > current_time - interval '1 hour';

  if recent_attempts >= 5 then
    return false;
  end if;

  insert into public.account_signup_attempts (ip_hash, attempted_at)
  values (p_ip_hash, current_time);
  return true;
end;
$$;

revoke all on public.account_signup_attempts from public, anon, authenticated;
revoke all on function public.allow_account_signup(text) from public, anon, authenticated;
grant execute on function public.allow_account_signup(text) to service_role;
