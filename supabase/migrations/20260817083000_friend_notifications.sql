-- Private, bot-only Friends Challenge notifications.
-- Notification rows use public profile IDs so Realtime never exposes auth user UUIDs.

alter table public.friend_challenges
  add column if not exists response_note text;

alter table public.friend_challenges
  drop constraint if exists friend_challenges_response_note_check;
alter table public.friend_challenges
  add constraint friend_challenges_response_note_check
  check (response_note is null or response_note in ('accept', 'later', 'decline'));

create table if not exists public.scoutcore_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.social_profiles(public_id) on delete cascade,
  actor_profile_id uuid references public.social_profiles(public_id) on delete set null,
  actor_display_name text not null default 'ScoutCore User',
  actor_avatar_url text,
  kind text not null check (kind in (
    'friend_play_request',
    'friend_play_response',
    'friend_challenge_invite',
    'friend_challenge_update'
  )),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 240),
  action_target text not null default 'friends-challenge:inbox'
    check (action_target in ('friends-challenge:inbox', 'friends-challenge:active')),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scoutcore_notifications_recipient_idx
  on public.scoutcore_notifications(recipient_profile_id, created_at desc);
create index if not exists scoutcore_notifications_unread_idx
  on public.scoutcore_notifications(recipient_profile_id, created_at desc)
  where read_at is null;

alter table public.scoutcore_notifications enable row level security;

revoke all on table public.scoutcore_notifications from anon, authenticated;
grant select on table public.scoutcore_notifications to authenticated;
grant update (read_at) on table public.scoutcore_notifications to authenticated;

drop policy if exists "Users can read their own notifications" on public.scoutcore_notifications;
create policy "Users can read their own notifications"
  on public.scoutcore_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.social_profiles profile
      where profile.public_id = recipient_profile_id
        and profile.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can mark their own notifications read" on public.scoutcore_notifications;
create policy "Users can mark their own notifications read"
  on public.scoutcore_notifications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.social_profiles profile
      where profile.public_id = recipient_profile_id
        and profile.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.social_profiles profile
      where profile.public_id = recipient_profile_id
        and profile.user_id = (select auth.uid())
    )
  );

create or replace function public.notify_friend_challenge_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_profile public.social_profiles%rowtype;
  recipient_profile public.social_profiles%rowtype;
  notification_kind text;
  notification_title text;
  notification_body text;
  notification_target text;
begin
  if tg_op = 'INSERT' then
    select * into actor_profile
    from public.social_profiles
    where user_id = new.inviter_id;

    select * into recipient_profile
    from public.social_profiles
    where user_id = new.invitee_id;

    if actor_profile.public_id is null or recipient_profile.public_id is null then
      return new;
    end if;

    if new.mode is null then
      notification_kind := 'friend_play_request';
      notification_title := 'ScoutBot play request';
      notification_body := actor_profile.display_name || ' wants to play a Friends Challenge.';
    else
      notification_kind := 'friend_challenge_invite';
      notification_title := 'New Friends Challenge';
      notification_body := actor_profile.display_name || ' invited you to ' ||
        case new.mode
          when 'weekly_h2h' then 'Weekly Head-to-Head.'
          when 'same_game' then 'Same Game: You vs Friend.'
          else 'a Friends Challenge.'
        end;
    end if;
    notification_target := 'friends-challenge:inbox';

  elsif tg_op = 'UPDATE'
    and old.status = 'pending'
    and new.status is distinct from old.status
    and new.status in ('choosing', 'accepted', 'declined') then

    select * into actor_profile
    from public.social_profiles
    where user_id = new.invitee_id;

    select * into recipient_profile
    from public.social_profiles
    where user_id = new.inviter_id;

    if actor_profile.public_id is null or recipient_profile.public_id is null then
      return new;
    end if;

    notification_kind := case
      when new.mode is null then 'friend_play_response'
      else 'friend_challenge_update'
    end;
    notification_title := 'ScoutBot update';
    notification_body := case
      when new.response_note = 'later' then actor_profile.display_name || ' may be able to play later.'
      when new.status = 'declined' then actor_profile.display_name || ' cannot play right now.'
      else actor_profile.display_name || ' is ready to play.'
    end;
    notification_target := case
      when new.status = 'declined' then 'friends-challenge:inbox'
      else 'friends-challenge:active'
    end;
  else
    return new;
  end if;

  insert into public.scoutcore_notifications (
    recipient_profile_id,
    actor_profile_id,
    actor_display_name,
    actor_avatar_url,
    kind,
    title,
    body,
    action_target,
    entity_id
  ) values (
    recipient_profile.public_id,
    actor_profile.public_id,
    actor_profile.display_name,
    actor_profile.avatar_url,
    notification_kind,
    notification_title,
    notification_body,
    notification_target,
    new.id
  );

  return new;
end;
$$;

revoke all on function public.notify_friend_challenge_change() from public, anon, authenticated;

drop trigger if exists notify_scoutcore_friend_challenge on public.friend_challenges;
create trigger notify_scoutcore_friend_challenge
  after insert or update of status on public.friend_challenges
  for each row execute function public.notify_friend_challenge_change();

-- Keep play requests mutual-friends-only and prevent repeated requests from becoming spam.
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

  if target_id is null then
    raise exception 'Profile not found';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot invite yourself';
  end if;
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
    select 1
    from public.friend_challenges existing
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

revoke all on function public.create_friend_challenge(uuid, text) from public, anon;
grant execute on function public.create_friend_challenge(uuid, text) to authenticated;

-- A generic ScoutBot request can be accepted, answered later, or declined.
create or replace function public.respond_friend_challenge(p_challenge_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_response not in ('accept', 'later', 'decline') then
    raise exception 'Invalid response';
  end if;

  update public.friend_challenges
  set status = case
        when p_response in ('later', 'decline') then 'declined'
        when mode is null then 'choosing'
        else 'accepted'
      end,
      response_note = p_response,
      updated_at = now()
  where id = p_challenge_id
    and invitee_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Challenge not available';
  end if;
end;
$$;

revoke all on function public.respond_friend_challenge(uuid, text) from public, anon;
grant execute on function public.respond_friend_challenge(uuid, text) to authenticated;

-- Publish only this RLS-protected table for live toast notifications.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scoutcore_notifications'
  ) then
    alter publication supabase_realtime add table public.scoutcore_notifications;
  end if;
end;
$$;
