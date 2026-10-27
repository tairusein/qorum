create unique index game_sessions_one_open_per_user_idx
  on public.game_sessions (user_id)
  where ended_at is null;
