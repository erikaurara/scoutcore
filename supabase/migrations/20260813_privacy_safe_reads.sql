-- ScoutCore privacy-safe public reads.
-- Public-facing clients should use these functions instead of selecting raw auth UUIDs.
-- Other users' internal auth IDs are returned as NULL; a signed-in user can only see their own ID.

create or replace function public.get_community_posts_safe(p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  title text,
  body text,
  category text,
  tag text,
  created_at timestamptz,
  updated_at timestamptz,
  media_path text,
  media_type text,
  moderation_status text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    case when p.user_id = auth.uid() then p.user_id else null end,
    p.author_name,
    p.title,
    p.body,
    p.category,
    p.tag,
    p.created_at,
    p.updated_at,
    p.media_path,
    p.media_type,
    p.moderation_status
  from public.community_posts p
  where p.moderation_status = 'approved' or p.user_id = auth.uid()
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create or replace function public.get_community_comments_safe(p_limit integer default 700)
returns table (
  id uuid,
  post_id uuid,
  user_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  parent_comment_id uuid,
  moderation_status text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    c.id,
    c.post_id,
    case when c.user_id = auth.uid() then c.user_id else null end,
    c.author_name,
    c.body,
    c.created_at,
    c.updated_at,
    c.parent_comment_id,
    c.moderation_status
  from public.community_comments c
  where c.moderation_status = 'approved' or c.user_id = auth.uid()
  order by c.created_at asc
  limit greatest(1, least(coalesce(p_limit, 700), 2000));
$$;

create or replace function public.get_community_likes_safe(p_limit integer default 3000)
returns table (post_id uuid, user_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select l.post_id,
         case when l.user_id = auth.uid() then l.user_id else null end,
         l.created_at
  from public.community_likes l
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 3000), 10000));
$$;

create or replace function public.get_community_reactions_safe(p_limit integer default 5000)
returns table (post_id uuid, user_id uuid, emoji text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select r.post_id,
         case when r.user_id = auth.uid() then r.user_id else null end,
         r.emoji,
         r.created_at
  from public.community_reactions r
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5000), 15000));
$$;

create or replace function public.get_game_chat_messages_safe(p_game_pk bigint, p_limit integer default 50)
returns table (
  id uuid,
  game_pk bigint,
  user_id uuid,
  display_name text,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.id,
         m.game_pk,
         case when m.user_id = auth.uid() then m.user_id else null end,
         m.display_name,
         m.body,
         m.created_at
  from public.game_chat_messages m
  where m.game_pk = p_game_pk
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.get_game_event_reactions_safe(
  p_game_pk bigint,
  p_event_key text,
  p_limit integer default 5000
)
returns table (
  id uuid,
  game_pk bigint,
  event_key text,
  emoji text,
  user_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select r.id,
         r.game_pk,
         r.event_key,
         r.emoji,
         case when r.user_id = auth.uid() then r.user_id else null end,
         r.created_at
  from public.game_event_reactions r
  where r.game_pk = p_game_pk and r.event_key = p_event_key
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5000), 10000));
$$;

create or replace function public.get_challenge_scores_safe(p_limit integer default 1000)
returns table (
  user_id uuid,
  display_name text,
  points integer,
  correct_picks integer,
  total_picks integer,
  current_streak integer,
  best_streak integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    case when s.user_id = auth.uid() then s.user_id else null end,
    s.display_name,
    s.points,
    s.correct_picks,
    s.total_picks,
    s.current_streak,
    s.best_streak,
    s.updated_at
  from public.challenge_scores s
  where auth.uid() is not null
  order by s.points desc, s.correct_picks desc, s.updated_at asc
  limit greatest(1, least(coalesce(p_limit, 1000), 5000));
$$;

create or replace function public.remove_community_like(p_post_id uuid)
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from public.community_likes
  where post_id = p_post_id and user_id = auth.uid();
$$;

create or replace function public.remove_community_reaction(p_post_id uuid, p_emoji text)
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from public.community_reactions
  where post_id = p_post_id and emoji = p_emoji and user_id = auth.uid();
$$;

create or replace function public.remove_game_event_reaction(p_game_pk bigint, p_event_key text, p_emoji text)
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from public.game_event_reactions
  where game_pk = p_game_pk and event_key = p_event_key and emoji = p_emoji and user_id = auth.uid();
$$;

revoke all on function public.get_community_posts_safe(integer) from public;
revoke all on function public.get_community_comments_safe(integer) from public;
revoke all on function public.get_community_likes_safe(integer) from public;
revoke all on function public.get_community_reactions_safe(integer) from public;
revoke all on function public.get_game_chat_messages_safe(bigint, integer) from public;
revoke all on function public.get_game_event_reactions_safe(bigint, text, integer) from public;
revoke all on function public.get_challenge_scores_safe(integer) from public;
revoke all on function public.remove_community_like(uuid) from public;
revoke all on function public.remove_community_reaction(uuid, text) from public;
revoke all on function public.remove_game_event_reaction(bigint, text, text) from public;

grant execute on function public.get_community_posts_safe(integer) to anon, authenticated;
grant execute on function public.get_community_comments_safe(integer) to anon, authenticated;
grant execute on function public.get_community_likes_safe(integer) to anon, authenticated;
grant execute on function public.get_community_reactions_safe(integer) to anon, authenticated;
grant execute on function public.get_game_chat_messages_safe(bigint, integer) to anon, authenticated;
grant execute on function public.get_game_event_reactions_safe(bigint, text, integer) to anon, authenticated;
grant execute on function public.get_challenge_scores_safe(integer) to authenticated;
grant execute on function public.remove_community_like(uuid) to authenticated;
grant execute on function public.remove_community_reaction(uuid, text) to authenticated;
grant execute on function public.remove_game_event_reaction(bigint, text, text) to authenticated;
