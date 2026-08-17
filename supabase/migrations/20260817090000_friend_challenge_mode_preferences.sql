-- ScoutBot mode selection for Friends Challenge.
-- Keeps Friends Challenge free and separate from ranked/ticket challenge scoring.

alter table public.friend_challenges
  add column if not exists inviter_preference text,
  add column if not exists invitee_preference text;

alter table public.friend_challenges
  drop constraint if exists friend_challenges_mode_check;
alter table public.friend_challenges
  add constraint friend_challenges_mode_check
  check (mode is null or mode in ('weekly_h2h', 'same_game', 'team_up'));

alter table public.friend_challenges
  drop constraint if exists friend_challenges_inviter_preference_check;
alter table public.friend_challenges
  add constraint friend_challenges_inviter_preference_check
  check (inviter_preference is null or inviter_preference in ('weekly_h2h', 'same_game', 'team_up'));

alter table public.friend_challenges
  drop constraint if exists friend_challenges_invitee_preference_check;
alter table public.friend_challenges
  add constraint friend_challenges_invitee_preference_check
  check (invitee_preference is null or invitee_preference in ('weekly_h2h', 'same_game', 'team_up'));

create index if not exists friend_challenges_participant_status_idx
  on public.friend_challenges(inviter_id, invitee_id, status, updated_at desc);

create or replace function public.set_friend_challenge_preference(
  p_challenge_id uuid,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  c public.friend_challenges%rowtype;
  inviter_choice text;
  invitee_choice text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_mode not in ('weekly_h2h', 'same_game') then
    raise exception 'This mode is not available yet';
  end if;

  select *
    into c
  from public.friend_challenges
  where id = p_challenge_id
    and auth.uid() in (inviter_id, invitee_id)
  for update;

  if c.id is null or c.status not in ('choosing', 'negotiating') or c.mode is not null then
    raise exception 'Mode selection is not available';
  end if;

  if auth.uid() = c.inviter_id then
    update public.friend_challenges
      set inviter_preference = p_mode,
          updated_at = now()
    where id = c.id;
  else
    update public.friend_challenges
      set invitee_preference = p_mode,
          updated_at = now()
    where id = c.id;
  end if;

  select inviter_preference, invitee_preference
    into inviter_choice, invitee_choice
  from public.friend_challenges
  where id = c.id;

  if inviter_choice is not null and invitee_choice is not null then
    update public.friend_challenges
      set status = case when inviter_choice = invitee_choice then 'accepted' else 'negotiating' end,
          mode = case when inviter_choice = invitee_choice then inviter_choice else null end,
          updated_at = now()
    where id = c.id;
  end if;
end;
$$;

drop function if exists public.randomize_friend_challenge_mode(uuid);
create function public.randomize_friend_challenge_mode(
  p_challenge_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  c public.friend_challenges%rowtype;
  chosen_mode text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
    into c
  from public.friend_challenges
  where id = p_challenge_id
    and auth.uid() in (inviter_id, invitee_id)
  for update;

  if c.id is null
    or c.status <> 'negotiating'
    or c.mode is not null
    or c.inviter_preference is null
    or c.invitee_preference is null then
    raise exception 'Random mode selection is not available';
  end if;

  chosen_mode := case when random() < 0.5 then c.inviter_preference else c.invitee_preference end;

  if chosen_mode not in ('weekly_h2h', 'same_game') then
    raise exception 'This mode is not available yet';
  end if;

  update public.friend_challenges
    set mode = chosen_mode,
        status = 'accepted',
        updated_at = now()
  where id = c.id;
end;
$$;

revoke all on function public.set_friend_challenge_preference(uuid, text) from public, anon;
revoke all on function public.randomize_friend_challenge_mode(uuid) from public, anon;
grant execute on function public.set_friend_challenge_preference(uuid, text) to authenticated;
grant execute on function public.randomize_friend_challenge_mode(uuid) to authenticated;

comment on function public.set_friend_challenge_preference(uuid, text) is
  'Records a private 1v1 Friends Challenge mode preference and accepts when both users match.';
comment on function public.randomize_friend_challenge_mode(uuid) is
  'Lets ScoutBot pick between two different available 1v1 Friends Challenge mode preferences.';
