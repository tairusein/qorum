create or replace function public.get_public_game_stats()
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
