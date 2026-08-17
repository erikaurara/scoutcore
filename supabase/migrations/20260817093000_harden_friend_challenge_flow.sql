-- Keep the public Friends Challenge API aligned with the modes the UI actually supports.
-- Team Up remains visible as Coming Soon until a real four-participant schema exists.

create or replace function public.create_friend_challenge(p_profile_id uuid, p_mode text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_id uuid;
  challenge_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_mode = 'team_up' then
    raise exception 'Team Up is coming soon';
  end if;
  if p_mode is not null and p_mode not in ('weekly_h2h', 'same_game') then
    raise exception 'Invalid mode';
  end if;

  select user_id into target_id
  from public.social_profiles
  where public_id = p_profile_id;

  if target_id is null then raise exception 'Profile not found'; end if;
  if target_id = auth.uid() then raise exception 'You cannot invite yourself'; end if;

  if not exists (
    select 1 from public.user_follows follow_one
    where follow_one.follower_id = auth.uid() and follow_one.followed_id = target_id
  ) or not exists (
    select 1 from public.user_follows follow_two
    where follow_two.follower_id = target_id and follow_two.followed_id = auth.uid()
  ) then
    raise exception 'Friends only';
  end if;

  if exists (
    select 1 from public.friend_challenges existing
    where existing.inviter_id = auth.uid()
      and existing.invitee_id = target_id
      and existing.status = 'pending'
      and existing.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'A request is already waiting for this friend';
  end if;

  insert into public.friend_challenges(inviter_id, invitee_id, mode, status)
  values (auth.uid(), target_id, p_mode, 'pending')
  returning id into challenge_id;

  return challenge_id;
end;
$$;

create or replace function public.submit_friend_challenge_picks(p_challenge_id uuid, p_picks jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  c public.friend_challenges%rowtype;
  game_start timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into c
  from public.friend_challenges
  where id = p_challenge_id
    and auth.uid() in (inviter_id, invitee_id)
  for update;

  if c.id is null or c.status <> 'accepted' or c.mode <> 'same_game' or c.game is null then
    raise exception 'Picks not available';
  end if;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) <> 4 then
    raise exception 'Four picks are required';
  end if;

  begin
    game_start := (c.game->>'gameDate')::timestamptz;
  exception when others then
    raise exception 'Invalid game start time';
  end;
  if game_start <= now() then
    raise exception 'Picks are locked because the game has started';
  end if;

  if auth.uid() = c.inviter_id then
    update public.friend_challenges
      set inviter_picks = p_picks, inviter_submitted = true, updated_at = now()
    where id = c.id;
  else
    update public.friend_challenges
      set invitee_picks = p_picks, invitee_submitted = true, updated_at = now()
    where id = c.id;
  end if;
end;
$$;

revoke all on function public.create_friend_challenge(uuid, text) from public, anon;
revoke all on function public.submit_friend_challenge_picks(uuid, jsonb) from public, anon;
grant execute on function public.create_friend_challenge(uuid, text) to authenticated;
grant execute on function public.submit_friend_challenge_picks(uuid, jsonb) to authenticated;

comment on function public.create_friend_challenge(uuid, text) is
  'Creates a free mutual-friend challenge. Team Up remains unavailable until four-player support exists.';
comment on function public.submit_friend_challenge_picks(uuid, jsonb) is
  'Locks four private Same Game picks before the selected MLB game begins.';
