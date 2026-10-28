revoke select on public.profiles from anon, authenticated;
grant select (id, username, avatar_path) on public.profiles to anon, authenticated;
