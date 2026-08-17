-- Complete the three free Friends Challenge modes.

create extension if not exists pgcrypto;

-- Shared, server-side scoring helpers.
create or replace function public.friend_pick_is_correct(
  p_pick jsonb,
  p_away_runs integer,
  p_home_runs integer
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case p_pick ->> 'key'
    when 'winner' then (p_pick ->> 'choice') = case when p_away_runs > p_home_runs then 'away' else 'home' end
    when 'total_runs' then (p_pick ->> 'choice') = case when p_away_runs + p_home_runs >= 8 then '8plus' else '7under' end
    when 'both_3' then (p_pick ->> 'choice') = case when p_away_runs >= 3 and p_home_runs >= 3 then 'yes' else 'no' end
    when 'close_game' then (p_pick ->> 'choice') = case when abs(p_away_runs - p_home_runs) = 1 then 'one' else 'two_plus' end
    when 'home_4' then (p_pick ->> 'choice') = case when p_home_runs >= 4 then 'yes' else 'no' end
    else false
  end;
$$;

create or replace function public.score_friend_picks(
  p_picks jsonb,
  p_away_runs integer,
  p_home_runs integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select count(*)::integer
  from jsonb_array_elements(coalesce(p_picks, '[]'::jsonb)) pick
  where public.friend_pick_is_correct(pick, p_away_runs, p_home_runs);
$$;

create or replace function public.mark_friend_pick_results(
  p_picks jsonb,
  p_away_runs integer,
  p_home_runs integer
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(pick || jsonb_build_object('correct', public.friend_pick_is_correct(pick, p_away_runs, p_home_runs))),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_picks, '[]'::jsonb)) pick;
$$;

revoke all on function public.friend_pick_is_correct(jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.score_friend_picks(jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.mark_friend_pick_results(jsonb, integer, integer) from public, anon, authenticated;

-- Weekly Head-to-Head.
alter table public.friend_challenges add column if not exists week_key date;

create or replace function public.set_friend_challenge_week_key()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.mode = 'weekly_h2h' and new.status = 'accepted' and new.week_key is null then
    new.week_key := date_trunc('week', now() at time zone 'UTC')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists set_scoutcore_friend_challenge_week on public.friend_challenges;
create trigger set_scoutcore_friend_challenge_week
  before insert or update of mode, status on public.friend_challenges
  for each row execute function public.set_friend_challenge_week_key();

update public.friend_challenges
set week_key = date_trunc('week', coalesce(completed_at, updated_at, created_at) at time zone 'UTC')::date
where mode = 'weekly_h2h'
  and status in ('accepted', 'completed')
  and week_key is null;

drop function if exists public.get_my_friend_challenges();
create function public.get_my_friend_challenges()
returns table(
  challenge_id uuid,
  role text,
  other_profile_id uuid,
  other_display_name text,
  other_avatar_url text,
  mode text,
  inviter_preference text,
  invitee_preference text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  shared_game jsonb,
  my_game_choice jsonb,
  other_game_choice jsonb,
  my_picks jsonb,
  other_picks jsonb,
  my_submitted boolean,
  other_submitted boolean,
  my_score integer,
  other_score integer,
  result_json jsonb,
  completed_at timestamptz,
  week_key date
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    fc.id,
    case when fc.inviter_id = auth.uid() then 'inviter' else 'invitee' end,
    profile.public_id,
    profile.display_name,
    profile.avatar_url,
    fc.mode,
    fc.inviter_preference,
    fc.invitee_preference,
    fc.status,
    fc.created_at,
    fc.updated_at,
    fc.game,
    case when fc.inviter_id = auth.uid() then fc.inviter_game else fc.invitee_game end,
    case when fc.inviter_game is not null and fc.invitee_game is not null
      then case when fc.inviter_id = auth.uid() then fc.invitee_game else fc.inviter_game end
      else null end,
    case when fc.inviter_id = auth.uid() then fc.inviter_picks else fc.invitee_picks end,
    case when fc.status = 'completed'
      then case when fc.inviter_id = auth.uid() then fc.invitee_picks else fc.inviter_picks end
      else null end,
    case when fc.inviter_id = auth.uid() then fc.inviter_submitted else fc.invitee_submitted end,
    case when fc.inviter_id = auth.uid() then fc.invitee_submitted else fc.inviter_submitted end,
    case when fc.inviter_id = auth.uid() then fc.inviter_score else fc.invitee_score end,
    case when fc.inviter_id = auth.uid() then fc.invitee_score else fc.inviter_score end,
    fc.result_json,
    fc.completed_at,
    fc.week_key
  from public.friend_challenges fc
  join public.social_profiles profile
    on profile.user_id = case when fc.inviter_id = auth.uid() then fc.invitee_id else fc.inviter_id end
  where auth.uid() in (fc.inviter_id, fc.invitee_id)
  order by fc.updated_at desc;
$$;

create or replace function public.get_friend_weekly_matchup(p_challenge_id uuid)
returns table(
  my_correct integer,
  my_total integer,
  my_points integer,
  other_correct integer,
  other_total integer,
  other_points integer
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_challenges%rowtype;
  me uuid;
  them uuid;
  selected_week date;
begin
  select * into challenge_row
  from public.friend_challenges
  where id = p_challenge_id and auth.uid() in (inviter_id, invitee_id);

  if challenge_row.id is null or challenge_row.mode <> 'weekly_h2h'
    or challenge_row.status not in ('accepted', 'completed') then
    return;
  end if;

  me := auth.uid();
  them := case when me = challenge_row.inviter_id then challenge_row.invitee_id else challenge_row.inviter_id end;
  selected_week := coalesce(challenge_row.week_key, date_trunc('week', challenge_row.created_at at time zone 'UTC')::date);

  return query
  with mine as (
    select coalesce(sum(correct_count), 0)::integer correct,
      coalesce(sum(settled_count), 0)::integer total,
      coalesce(sum(points), 0)::integer points
    from public.challenge_cards
    where user_id = me and week_key = selected_week
  ), theirs as (
    select coalesce(sum(correct_count), 0)::integer correct,
      coalesce(sum(settled_count), 0)::integer total,
      coalesce(sum(points), 0)::integer points
    from public.challenge_cards
    where user_id = them and week_key = selected_week
  )
  select mine.correct, mine.total, mine.points, theirs.correct, theirs.total, theirs.points
  from mine, theirs;
end;
$$;

create or replace function public.complete_friend_weekly_challenge(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_challenges%rowtype;
  selected_week date;
  inviter_correct integer;
  inviter_total integer;
  inviter_points integer;
  invitee_correct integer;
  invitee_total integer;
  invitee_points integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into challenge_row
  from public.friend_challenges
  where id = p_challenge_id and auth.uid() in (inviter_id, invitee_id)
  for update;

  if challenge_row.id is null or challenge_row.mode <> 'weekly_h2h' then
    raise exception 'Weekly challenge not available';
  end if;
  if challenge_row.status = 'completed' then return true; end if;
  if challenge_row.status <> 'accepted' then return false; end if;

  selected_week := coalesce(challenge_row.week_key, date_trunc('week', challenge_row.created_at at time zone 'UTC')::date);
  if now() < (selected_week + 7)::timestamptz then return false; end if;

  select coalesce(sum(correct_count), 0)::integer,
    coalesce(sum(settled_count), 0)::integer,
    coalesce(sum(points), 0)::integer
  into inviter_correct, inviter_total, inviter_points
  from public.challenge_cards
  where user_id = challenge_row.inviter_id and week_key = selected_week;

  select coalesce(sum(correct_count), 0)::integer,
    coalesce(sum(settled_count), 0)::integer,
    coalesce(sum(points), 0)::integer
  into invitee_correct, invitee_total, invitee_points
  from public.challenge_cards
  where user_id = challenge_row.invitee_id and week_key = selected_week;

  update public.friend_challenges
  set inviter_score = inviter_points,
      invitee_score = invitee_points,
      result_json = jsonb_build_object(
        'weekKey', selected_week,
        'inviterCorrect', inviter_correct,
        'inviterTotal', inviter_total,
        'inviterPoints', inviter_points,
        'inviteeCorrect', invitee_correct,
        'inviteeTotal', invitee_total,
        'inviteePoints', invitee_points
      ),
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = challenge_row.id;

  return true;
end;
$$;

-- Same Game: choose the game before inviting and score on the server.
create or replace function public.create_same_game_friend_challenge(
  p_profile_id uuid,
  p_game jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_id uuid;
  game_start timestamptz;
begin
  if p_game is null or coalesce(p_game ->> 'gamePk', '') = '' then
    raise exception 'Choose an MLB game first';
  end if;
  begin
    game_start := (p_game ->> 'gameDate')::timestamptz;
  exception when others then
    raise exception 'Invalid game start time';
  end;
  if game_start <= now() then raise exception 'Choose an upcoming MLB game'; end if;

  challenge_id := public.create_friend_challenge(p_profile_id, 'same_game');
  update public.friend_challenges
  set game = p_game,
      inviter_game = p_game,
      invitee_game = p_game,
      updated_at = now()
  where id = challenge_id and inviter_id = auth.uid();
  return challenge_id;
end;
$$;

create or replace function public.submit_friend_challenge_picks(
  p_challenge_id uuid,
  p_picks jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_challenges%rowtype;
  game_start timestamptz;
  pick_count integer;
  valid_key_count integer;
  invalid_choice_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into challenge_row
  from public.friend_challenges
  where id = p_challenge_id and auth.uid() in (inviter_id, invitee_id)
  for update;

  if challenge_row.id is null or challenge_row.status <> 'accepted'
    or challenge_row.mode <> 'same_game' or challenge_row.game is null then
    raise exception 'Picks not available';
  end if;
  if jsonb_typeof(p_picks) <> 'array' then raise exception 'Four picks are required'; end if;

  select count(*)::integer,
    count(distinct pick ->> 'key') filter (
      where pick ->> 'key' in ('winner', 'total_runs', 'both_3', 'close_game')
    )::integer,
    count(*) filter (where not (
      (pick ->> 'key' = 'winner' and pick ->> 'choice' in ('away', 'home')) or
      (pick ->> 'key' = 'total_runs' and pick ->> 'choice' in ('8plus', '7under')) or
      (pick ->> 'key' = 'both_3' and pick ->> 'choice' in ('yes', 'no')) or
      (pick ->> 'key' = 'close_game' and pick ->> 'choice' in ('one', 'two_plus'))
    ))::integer
  into pick_count, valid_key_count, invalid_choice_count
  from jsonb_array_elements(p_picks) pick;

  if pick_count <> 4 or valid_key_count <> 4 or invalid_choice_count <> 0 then
    raise exception 'Four valid picks are required';
  end if;

  begin
    game_start := (challenge_row.game ->> 'gameDate')::timestamptz;
  exception when others then
    raise exception 'Invalid game start time';
  end;
  if game_start <= now() then raise exception 'Picks are locked because the game has started'; end if;

  if auth.uid() = challenge_row.inviter_id then
    if challenge_row.inviter_submitted then raise exception 'Your picks are already locked'; end if;
    update public.friend_challenges
    set inviter_picks = p_picks, inviter_submitted = true, updated_at = now()
    where id = challenge_row.id;
  else
    if challenge_row.invitee_submitted then raise exception 'Your picks are already locked'; end if;
    update public.friend_challenges
    set invitee_picks = p_picks, invitee_submitted = true, updated_at = now()
    where id = challenge_row.id;
  end if;
end;
$$;

create or replace function public.settle_friend_same_game(
  p_challenge_id uuid,
  p_away_runs integer,
  p_home_runs integer
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_challenges%rowtype;
  inviter_total integer;
  invitee_total integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_away_runs < 0 or p_home_runs < 0 then raise exception 'Invalid final score'; end if;

  select * into challenge_row
  from public.friend_challenges
  where id = p_challenge_id and auth.uid() in (inviter_id, invitee_id)
  for update;

  if challenge_row.id is null or challenge_row.status <> 'accepted'
    or challenge_row.mode <> 'same_game' or challenge_row.game is null
    or not (challenge_row.inviter_submitted and challenge_row.invitee_submitted) then
    raise exception 'Challenge not ready to complete';
  end if;

  if (challenge_row.game ->> 'gameDate')::timestamptz > now() then
    raise exception 'The game has not started';
  end if;

  inviter_total := public.score_friend_picks(challenge_row.inviter_picks, p_away_runs, p_home_runs);
  invitee_total := public.score_friend_picks(challenge_row.invitee_picks, p_away_runs, p_home_runs);

  update public.friend_challenges
  set inviter_score = inviter_total,
      invitee_score = invitee_total,
      result_json = jsonb_build_object(
        'away', p_away_runs,
        'home', p_home_runs,
        'inviterResults', public.mark_friend_pick_results(challenge_row.inviter_picks, p_away_runs, p_home_runs),
        'inviteeResults', public.mark_friend_pick_results(challenge_row.invitee_picks, p_away_runs, p_home_runs)
      ),
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = challenge_row.id;
end;
$$;

-- The legacy client-scored completion RPC is no longer allowed.
revoke execute on function public.complete_friend_challenge(uuid, integer, integer, jsonb) from authenticated;

-- Team Up: four participants and two combined scores.
create table if not exists public.friend_team_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'building_team' check (status in (
    'building_team', 'choosing_opponents', 'pending_opponents', 'choosing_game',
    'picking', 'locked', 'completed', 'cancelled'
  )),
  game jsonb,
  team_one_score integer,
  team_two_score integer,
  result_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.friend_team_challenge_members (
  challenge_id uuid not null references public.friend_team_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team smallint not null check (team in (1, 2)),
  role text not null check (role in ('captain', 'member')),
  invite_status text not null default 'pending' check (invite_status in ('pending', 'accepted', 'declined')),
  picks jsonb,
  submitted boolean not null default false,
  score integer,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create unique index if not exists friend_team_one_captain_per_side_idx
  on public.friend_team_challenge_members(challenge_id, team)
  where role = 'captain';
create index if not exists friend_team_member_user_idx
  on public.friend_team_challenge_members(user_id, created_at desc);
create index if not exists friend_team_challenge_status_idx
  on public.friend_team_challenges(status, updated_at desc);

alter table public.friend_team_challenges enable row level security;
alter table public.friend_team_challenge_members enable row level security;
revoke all on table public.friend_team_challenges from anon, authenticated;
revoke all on table public.friend_team_challenge_members from anon, authenticated;

create or replace function public.friend_users_are_mutual(p_left uuid, p_right uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select p_left <> p_right
    and exists (select 1 from public.user_follows where follower_id = p_left and followed_id = p_right)
    and exists (select 1 from public.user_follows where follower_id = p_right and followed_id = p_left);
$$;

create or replace function public.notify_friend_team_user(
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_title text,
  p_body text,
  p_target text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  recipient public.social_profiles%rowtype;
  actor public.social_profiles%rowtype;
begin
  select * into recipient from public.social_profiles where user_id = p_recipient_user_id;
  select * into actor from public.social_profiles where user_id = p_actor_user_id;
  if recipient.public_id is null or actor.public_id is null then return; end if;

  insert into public.scoutcore_notifications(
    recipient_profile_id, actor_profile_id, actor_display_name, actor_avatar_url,
    kind, title, body, action_target, entity_id
  ) values (
    recipient.public_id, actor.public_id, actor.display_name, actor.avatar_url,
    case when p_target = 'friends-challenge:inbox' then 'friend_challenge_invite' else 'friend_challenge_update' end,
    left(p_title, 80), left(p_body, 240), p_target, p_entity_id
  );
end;
$$;

create or replace function public.create_friend_team_challenge(p_teammate_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  teammate_id uuid;
  challenge_id uuid;
  actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select user_id into teammate_id from public.social_profiles where public_id = p_teammate_profile_id;
  if teammate_id is null then raise exception 'Profile not found'; end if;
  if not public.friend_users_are_mutual(auth.uid(), teammate_id) then raise exception 'Friends only'; end if;

  insert into public.friend_team_challenges(created_by, status)
  values (auth.uid(), 'building_team') returning id into challenge_id;
  insert into public.friend_team_challenge_members(
    challenge_id, user_id, team, role, invite_status, accepted_at
  ) values
    (challenge_id, auth.uid(), 1, 'captain', 'accepted', now()),
    (challenge_id, teammate_id, 1, 'member', 'pending', null);

  select display_name into actor_name from public.social_profiles where user_id = auth.uid();
  perform public.notify_friend_team_user(
    teammate_id, auth.uid(), 'Team Up invitation',
    coalesce(actor_name, 'A friend') || ' invited you to join their two-person team.',
    'friends-challenge:inbox', challenge_id
  );
  return challenge_id;
end;
$$;

create or replace function public.respond_friend_team_challenge(
  p_challenge_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_team_challenges%rowtype;
  member_row public.friend_team_challenge_members%rowtype;
  actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_response not in ('accept', 'decline') then raise exception 'Invalid response'; end if;

  select * into challenge_row
  from public.friend_team_challenges
  where id = p_challenge_id
    and exists (select 1 from public.friend_team_challenge_members where challenge_id = p_challenge_id and user_id = auth.uid())
  for update;
  select * into member_row
  from public.friend_team_challenge_members
  where challenge_id = p_challenge_id and user_id = auth.uid()
  for update;

  if challenge_row.id is null or member_row.user_id is null or member_row.invite_status <> 'pending' then
    raise exception 'Invitation not available';
  end if;
  if (member_row.team = 1 and challenge_row.status <> 'building_team')
    or (member_row.team = 2 and challenge_row.status <> 'pending_opponents') then
    raise exception 'Invitation is no longer active';
  end if;

  if p_response = 'decline' then
    update public.friend_team_challenge_members set invite_status = 'declined'
    where challenge_id = p_challenge_id and user_id = auth.uid();
    update public.friend_team_challenges set status = 'cancelled', updated_at = now()
    where id = p_challenge_id;
  else
    update public.friend_team_challenge_members
    set invite_status = 'accepted', accepted_at = now()
    where challenge_id = p_challenge_id and user_id = auth.uid();

    if member_row.team = 1 then
      update public.friend_team_challenges set status = 'choosing_opponents', updated_at = now()
      where id = p_challenge_id;
    elsif not exists (
      select 1 from public.friend_team_challenge_members
      where challenge_id = p_challenge_id and team = 2 and invite_status <> 'accepted'
    ) then
      update public.friend_team_challenges set status = 'choosing_game', updated_at = now()
      where id = p_challenge_id;
    end if;
  end if;

  select display_name into actor_name from public.social_profiles where user_id = auth.uid();
  perform public.notify_friend_team_user(
    challenge_row.created_by, auth.uid(), 'Team Up update',
    coalesce(actor_name, 'A player') || case when p_response = 'accept' then ' accepted the Team Up invitation.' else ' declined the Team Up invitation.' end,
    'friends-challenge:active', p_challenge_id
  );
end;
$$;

create or replace function public.invite_friend_team_opponents(
  p_challenge_id uuid,
  p_opponent_captain_profile_id uuid,
  p_opponent_teammate_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_team_challenges%rowtype;
  opponent_captain_id uuid;
  opponent_teammate_id uuid;
  actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into challenge_row
  from public.friend_team_challenges
  where id = p_challenge_id and created_by = auth.uid()
  for update;
  if challenge_row.id is null or challenge_row.status <> 'choosing_opponents' then
    raise exception 'Opponent selection is not available';
  end if;

  select user_id into opponent_captain_id from public.social_profiles where public_id = p_opponent_captain_profile_id;
  select user_id into opponent_teammate_id from public.social_profiles where public_id = p_opponent_teammate_profile_id;
  if opponent_captain_id is null or opponent_teammate_id is null or opponent_captain_id = opponent_teammate_id then
    raise exception 'Choose two different opponents';
  end if;
  if exists (
    select 1 from public.friend_team_challenge_members
    where challenge_id = p_challenge_id and user_id in (opponent_captain_id, opponent_teammate_id)
  ) then raise exception 'A player cannot be on both teams'; end if;
  if not public.friend_users_are_mutual(auth.uid(), opponent_captain_id)
    or not public.friend_users_are_mutual(auth.uid(), opponent_teammate_id)
    or not public.friend_users_are_mutual(opponent_captain_id, opponent_teammate_id) then
    raise exception 'The opponent duo must be mutual friends';
  end if;

  insert into public.friend_team_challenge_members(challenge_id, user_id, team, role, invite_status)
  values
    (p_challenge_id, opponent_captain_id, 2, 'captain', 'pending'),
    (p_challenge_id, opponent_teammate_id, 2, 'member', 'pending');
  update public.friend_team_challenges set status = 'pending_opponents', updated_at = now()
  where id = p_challenge_id;

  select display_name into actor_name from public.social_profiles where user_id = auth.uid();
  perform public.notify_friend_team_user(opponent_captain_id, auth.uid(), 'Team Up challenge', coalesce(actor_name, 'A friend') || ' invited your duo to a two-versus-two challenge.', 'friends-challenge:inbox', p_challenge_id);
  perform public.notify_friend_team_user(opponent_teammate_id, auth.uid(), 'Team Up challenge', coalesce(actor_name, 'A friend') || ' invited your duo to a two-versus-two challenge.', 'friends-challenge:inbox', p_challenge_id);
end;
$$;

create or replace function public.choose_friend_team_challenge_game(
  p_challenge_id uuid,
  p_game jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  game_start timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_game is null or coalesce(p_game ->> 'gamePk', '') = '' then raise exception 'Invalid game'; end if;
  begin
    game_start := (p_game ->> 'gameDate')::timestamptz;
  exception when others then
    raise exception 'Invalid game start time';
  end;
  if game_start <= now() then raise exception 'Choose an upcoming MLB game'; end if;

  update public.friend_team_challenges challenge
  set game = p_game, status = 'picking', updated_at = now()
  where challenge.id = p_challenge_id
    and challenge.status = 'choosing_game'
    and exists (
      select 1 from public.friend_team_challenge_members member
      where member.challenge_id = challenge.id and member.user_id = auth.uid()
        and member.role = 'captain' and member.invite_status = 'accepted'
    );
  if not found then raise exception 'Only a team captain can choose the game'; end if;
end;
$$;

create or replace function public.submit_friend_team_challenge_picks(
  p_challenge_id uuid,
  p_picks jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_team_challenges%rowtype;
  game_start timestamptz;
  pick_count integer;
  valid_key_count integer;
  invalid_choice_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into challenge_row
  from public.friend_team_challenges
  where id = p_challenge_id and status = 'picking'
    and exists (
      select 1 from public.friend_team_challenge_members
      where challenge_id = p_challenge_id and user_id = auth.uid()
        and invite_status = 'accepted' and submitted = false
    )
  for update;
  if challenge_row.id is null or challenge_row.game is null then raise exception 'Picks not available'; end if;
  if jsonb_typeof(p_picks) <> 'array' then raise exception 'Five picks are required'; end if;

  select count(*)::integer,
    count(distinct pick ->> 'key') filter (
      where pick ->> 'key' in ('winner', 'total_runs', 'both_3', 'close_game', 'home_4')
    )::integer,
    count(*) filter (where not (
      (pick ->> 'key' = 'winner' and pick ->> 'choice' in ('away', 'home')) or
      (pick ->> 'key' = 'total_runs' and pick ->> 'choice' in ('8plus', '7under')) or
      (pick ->> 'key' = 'both_3' and pick ->> 'choice' in ('yes', 'no')) or
      (pick ->> 'key' = 'close_game' and pick ->> 'choice' in ('one', 'two_plus')) or
      (pick ->> 'key' = 'home_4' and pick ->> 'choice' in ('yes', 'no'))
    ))::integer
  into pick_count, valid_key_count, invalid_choice_count
  from jsonb_array_elements(p_picks) pick;
  if pick_count <> 5 or valid_key_count <> 5 or invalid_choice_count <> 0 then
    raise exception 'Five valid picks are required';
  end if;

  game_start := (challenge_row.game ->> 'gameDate')::timestamptz;
  if game_start <= now() then raise exception 'Picks are locked because the game has started'; end if;

  update public.friend_team_challenge_members
  set picks = p_picks, submitted = true
  where challenge_id = p_challenge_id and user_id = auth.uid();

  if not exists (
    select 1 from public.friend_team_challenge_members
    where challenge_id = p_challenge_id and invite_status = 'accepted' and submitted = false
  ) then
    update public.friend_team_challenges set status = 'locked', updated_at = now()
    where id = p_challenge_id;
  else
    update public.friend_team_challenges set updated_at = now() where id = p_challenge_id;
  end if;
end;
$$;

create or replace function public.settle_friend_team_challenge(
  p_challenge_id uuid,
  p_away_runs integer,
  p_home_runs integer
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  challenge_row public.friend_team_challenges%rowtype;
  first_total integer;
  second_total integer;
  breakdown jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_away_runs < 0 or p_home_runs < 0 then raise exception 'Invalid final score'; end if;
  select * into challenge_row
  from public.friend_team_challenges
  where id = p_challenge_id and status = 'locked'
    and exists (select 1 from public.friend_team_challenge_members where challenge_id = p_challenge_id and user_id = auth.uid())
  for update;
  if challenge_row.id is null then raise exception 'Team challenge not ready to complete'; end if;
  if (challenge_row.game ->> 'gameDate')::timestamptz > now() then raise exception 'The game has not started'; end if;

  update public.friend_team_challenge_members
  set score = public.score_friend_picks(picks, p_away_runs, p_home_runs)
  where challenge_id = p_challenge_id and invite_status = 'accepted';

  select coalesce(sum(score) filter (where team = 1), 0)::integer,
    coalesce(sum(score) filter (where team = 2), 0)::integer
  into first_total, second_total
  from public.friend_team_challenge_members
  where challenge_id = p_challenge_id and invite_status = 'accepted';

  select jsonb_agg(
    jsonb_build_object(
      'profileId', profile.public_id,
      'displayName', profile.display_name,
      'team', member.team,
      'score', member.score,
      'results', public.mark_friend_pick_results(member.picks, p_away_runs, p_home_runs)
    ) order by member.team, member.role, member.created_at
  ) into breakdown
  from public.friend_team_challenge_members member
  join public.social_profiles profile on profile.user_id = member.user_id
  where member.challenge_id = p_challenge_id and member.invite_status = 'accepted';

  update public.friend_team_challenges
  set team_one_score = first_total,
      team_two_score = second_total,
      result_json = jsonb_build_object('away', p_away_runs, 'home', p_home_runs, 'members', coalesce(breakdown, '[]'::jsonb)),
      status = 'completed', completed_at = now(), updated_at = now()
  where id = p_challenge_id;
end;
$$;

drop function if exists public.get_my_friend_team_challenges();
create function public.get_my_friend_team_challenges()
returns table(
  team_challenge_id uuid,
  my_team smallint,
  my_role text,
  my_invite_status text,
  status text,
  game jsonb,
  members jsonb,
  team_one_score integer,
  team_two_score integer,
  result_json jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    challenge.id,
    mine.team,
    mine.role,
    mine.invite_status,
    challenge.status,
    challenge.game,
    (
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', profile.public_id,
          'display_name', profile.display_name,
          'avatar_url', profile.avatar_url,
          'team', member.team,
          'role', member.role,
          'invite_status', member.invite_status,
          'submitted', member.submitted,
          'score', member.score,
          'picks', case when member.user_id = auth.uid() or challenge.status = 'completed' then member.picks else null end
        ) order by member.team, member.role, member.created_at
      )
      from public.friend_team_challenge_members member
      join public.social_profiles profile on profile.user_id = member.user_id
      where member.challenge_id = challenge.id
    ),
    challenge.team_one_score,
    challenge.team_two_score,
    challenge.result_json,
    challenge.created_at,
    challenge.updated_at,
    challenge.completed_at
  from public.friend_team_challenges challenge
  join public.friend_team_challenge_members mine
    on mine.challenge_id = challenge.id and mine.user_id = auth.uid()
  order by challenge.updated_at desc;
$$;

revoke all on function public.set_friend_challenge_week_key() from public, anon, authenticated;
revoke all on function public.get_my_friend_challenges() from public, anon;
revoke all on function public.get_friend_weekly_matchup(uuid) from public, anon;
revoke all on function public.complete_friend_weekly_challenge(uuid) from public, anon;
revoke all on function public.create_same_game_friend_challenge(uuid, jsonb) from public, anon;
revoke all on function public.submit_friend_challenge_picks(uuid, jsonb) from public, anon;
revoke all on function public.settle_friend_same_game(uuid, integer, integer) from public, anon;
revoke all on function public.friend_users_are_mutual(uuid, uuid) from public, anon, authenticated;
revoke all on function public.notify_friend_team_user(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_friend_team_challenge(uuid) from public, anon;
revoke all on function public.respond_friend_team_challenge(uuid, text) from public, anon;
revoke all on function public.invite_friend_team_opponents(uuid, uuid, uuid) from public, anon;
revoke all on function public.choose_friend_team_challenge_game(uuid, jsonb) from public, anon;
revoke all on function public.submit_friend_team_challenge_picks(uuid, jsonb) from public, anon;
revoke all on function public.settle_friend_team_challenge(uuid, integer, integer) from public, anon;
revoke all on function public.get_my_friend_team_challenges() from public, anon;

grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.get_friend_weekly_matchup(uuid) to authenticated;
grant execute on function public.complete_friend_weekly_challenge(uuid) to authenticated;
grant execute on function public.create_same_game_friend_challenge(uuid, jsonb) to authenticated;
grant execute on function public.submit_friend_challenge_picks(uuid, jsonb) to authenticated;
grant execute on function public.settle_friend_same_game(uuid, integer, integer) to authenticated;
grant execute on function public.create_friend_team_challenge(uuid) to authenticated;
grant execute on function public.respond_friend_team_challenge(uuid, text) to authenticated;
grant execute on function public.invite_friend_team_opponents(uuid, uuid, uuid) to authenticated;
grant execute on function public.choose_friend_team_challenge_game(uuid, jsonb) to authenticated;
grant execute on function public.submit_friend_team_challenge_picks(uuid, jsonb) to authenticated;
grant execute on function public.settle_friend_team_challenge(uuid, integer, integer) to authenticated;
grant execute on function public.get_my_friend_team_challenges() to authenticated;

comment on function public.complete_friend_weekly_challenge(uuid) is
  'Settles one Weekly Head-to-Head after its UTC week ends and saves the result to history.';
comment on function public.create_same_game_friend_challenge(uuid, jsonb) is
  'Creates a Same Game challenge with the MLB matchup selected before the friend invitation.';
comment on function public.get_my_friend_team_challenges() is
  'Returns private Team Up challenges for the signed-in participant without exposing auth user IDs.';
