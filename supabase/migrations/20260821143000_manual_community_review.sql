-- Manual Community administration. Text/photos publish immediately; videos wait for approval.

create table if not exists public.community_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.community_admins enable row level security;

revoke all on table public.community_admins from public, anon, authenticated;
grant select, insert, delete on table public.community_admins to service_role;

alter table public.community_posts
  add column if not exists quarantine_path text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.community_comments
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists community_posts_pending_review_idx
  on public.community_posts(moderation_status, created_at desc)
  where moderation_status in ('pending', 'pending_review');

create index if not exists community_comments_pending_review_idx
  on public.community_comments(moderation_status, created_at)
  where moderation_status = 'pending';

-- The browser does not query the admin table or moderation-only columns directly.
-- The authenticated Edge Function verifies the caller, then uses service_role server-side.
revoke select (quarantine_path, reviewed_by) on table public.community_posts from anon, authenticated;
revoke select (reviewed_by) on table public.community_comments from anon, authenticated;

alter table public.scoutcore_notifications
  drop constraint if exists scoutcore_notifications_kind_check,
  drop constraint if exists scoutcore_notifications_action_target_check;

alter table public.scoutcore_notifications
  add constraint scoutcore_notifications_kind_check check (kind in (
    'friend_play_request', 'friend_play_response', 'friend_challenge_invite',
    'friend_challenge_update', 'friend_request', 'friend_request_update', 'community_warning'
  )),
  add constraint scoutcore_notifications_action_target_check check (action_target in (
    'friends-challenge:inbox', 'friends-challenge:active', 'profile:requests', 'profile:friends', 'community'
  ));

grant insert on table public.scoutcore_notifications to service_role;

-- Administrator Challenge cards are unlimited and do not consume ranked or
-- Premium tickets. They are excluded from public leaderboard scoring.
alter table public.challenge_cards
  drop constraint if exists challenge_cards_ticket_kind_check;

alter table public.challenge_cards
  add constraint challenge_cards_ticket_kind_check
  check (ticket_kind in ('ranked', 'extra', 'admin'));

create or replace function public.submit_challenge_card(
  p_id uuid,
  p_display_name text,
  p_game_pk bigint,
  p_game_date timestamptz,
  p_away_team jsonb,
  p_home_team jsonb,
  p_selections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_week_key date := date_trunc('week', now() at time zone 'UTC')::date;
  v_is_admin boolean := false;
  v_is_premium boolean := false;
  v_ranked_used integer := 0;
  v_extra_used integer := 0;
  v_ticket_kind text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_game_date <= now() then
    raise exception 'Predictions are locked after the game starts';
  end if;

  if jsonb_typeof(p_selections) <> 'array'
     or jsonb_array_length(p_selections) < 1
     or jsonb_array_length(p_selections) > 8 then
    raise exception 'A Challenge Card must contain 1 to 8 selections';
  end if;

  select exists (
    select 1 from public.community_admins where user_id = v_user_id
  ) into v_is_admin;

  -- Subscription authorization must use server-controlled app metadata, never
  -- user-editable user_metadata.
  select coalesce(
    raw_app_meta_data ->> 'plan' = 'premium'
    or raw_app_meta_data ->> 'subscription_tier' = 'premium'
    or lower(coalesce(raw_app_meta_data ->> 'is_premium', 'false')) = 'true',
    false
  )
  into v_is_premium
  from auth.users
  where id = v_user_id;

  select count(*) filter (where ticket_kind = 'ranked'),
         count(*) filter (where ticket_kind = 'extra')
  into v_ranked_used, v_extra_used
  from public.challenge_cards
  where user_id = v_user_id
    and week_key = v_week_key;

  if v_is_admin and v_ranked_used < 5 then
    -- Keep the public leaderboard fair: only the same first five weekly cards
    -- count as ranked, even though administrators are never blocked afterward.
    v_ticket_kind := 'ranked';
  elsif v_is_admin then
    v_ticket_kind := 'admin';
  elsif v_ranked_used < 5 then
    v_ticket_kind := 'ranked';
  elsif v_is_premium and v_extra_used < 10 then
    v_ticket_kind := 'extra';
  else
    raise exception 'No Challenge Tickets remaining this week';
  end if;

  insert into public.challenge_cards (
    id, user_id, display_name, game_pk, game_date, away_team, home_team,
    selections, status, total_count, week_key, ticket_kind
  ) values (
    p_id, v_user_id,
    left(coalesce(nullif(trim(p_display_name), ''), 'ScoutCore User'), 80),
    p_game_pk, p_game_date, p_away_team, p_home_team, p_selections,
    'upcoming', jsonb_array_length(p_selections), v_week_key, v_ticket_kind
  );

  return p_id;
end;
$$;

revoke all on function public.submit_challenge_card(uuid,text,bigint,timestamptz,jsonb,jsonb,jsonb) from public;
grant execute on function public.submit_challenge_card(uuid,text,bigint,timestamptz,jsonb,jsonb,jsonb) to authenticated;

comment on column public.challenge_cards.ticket_kind is
  'ranked = leaderboard entry; extra = Premium personal entry; admin = unlimited administrator entry excluded from leaderboard scoring.';
comment on function public.submit_challenge_card(uuid,text,bigint,timestamptz,jsonb,jsonb,jsonb) is
  'Securely assigns ranked, Premium extra, or unlimited administrator Challenge access.';
