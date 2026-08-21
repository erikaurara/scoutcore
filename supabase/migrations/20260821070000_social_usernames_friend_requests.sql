-- Safe ScoutCore profile discovery, QR sharing, and explicit friend requests.
-- Public profile links use social_profiles.public_id, never auth.users.id or email.

create extension if not exists pgcrypto;

alter table public.social_profiles
  add column if not exists username text;

update public.social_profiles
set username = 'scout_' || substring(replace(public_id::text, '-', '') from 1 for 8)
where username is null
   or username !~ '^[a-z0-9_]{3,24}$';

alter table public.social_profiles
  alter column username set default ('scout_' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  alter column username set not null;

alter table public.social_profiles
  drop constraint if exists social_profiles_username_format_check;
alter table public.social_profiles
  add constraint social_profiles_username_format_check
  check (username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists social_profiles_username_unique_idx
  on public.social_profiles (username);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);

create unique index if not exists friend_requests_one_pending_pair_idx
  on public.friend_requests (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  )
  where status = 'pending';

create index if not exists friend_requests_recipient_pending_idx
  on public.friend_requests (recipient_id, created_at desc)
  where status = 'pending';

create index if not exists friend_requests_requester_pending_idx
  on public.friend_requests (requester_id, created_at desc)
  where status = 'pending';

alter table public.friend_requests enable row level security;
revoke all on table public.friend_requests from public, anon, authenticated;

-- Extend the existing private notification inbox for friend requests.
alter table public.scoutcore_notifications
  drop constraint if exists scoutcore_notifications_kind_check;
alter table public.scoutcore_notifications
  add constraint scoutcore_notifications_kind_check
  check (kind in (
    'friend_play_request',
    'friend_play_response',
    'friend_challenge_invite',
    'friend_challenge_update',
    'friend_request',
    'friend_request_update'
  ));

alter table public.scoutcore_notifications
  drop constraint if exists scoutcore_notifications_action_target_check;
alter table public.scoutcore_notifications
  add constraint scoutcore_notifications_action_target_check
  check (action_target in (
    'friends-challenge:inbox',
    'friends-challenge:active',
    'profile:requests',
    'profile:friends'
  ));

create or replace function public.social_friend_relationship(p_other_user_id uuid)
returns table(friend_status text, friend_request_id uuid)
language sql
stable
security definer
set search_path = public, auth
as $$
  with pending as (
    select request.id, request.requester_id, request.recipient_id
    from public.friend_requests request
    where request.status = 'pending'
      and auth.uid() is not null
      and (
        (request.requester_id = auth.uid() and request.recipient_id = p_other_user_id)
        or (request.recipient_id = auth.uid() and request.requester_id = p_other_user_id)
      )
    order by request.created_at desc
    limit 1
  )
  select
    case
      when auth.uid() is null then 'none'
      when p_other_user_id = auth.uid() then 'self'
      when exists (
        select 1
        from public.user_follows mine
        join public.user_follows theirs
          on theirs.follower_id = mine.followed_id
         and theirs.followed_id = mine.follower_id
        where mine.follower_id = auth.uid()
          and mine.followed_id = p_other_user_id
      ) then 'friends'
      when pending.requester_id = auth.uid() then 'outgoing'
      when pending.recipient_id = auth.uid() then 'incoming'
      else 'none'
    end,
    pending.id
  from (select 1) anchor
  left join pending on true;
$$;

revoke all on function public.social_friend_relationship(uuid) from public, anon, authenticated;

create or replace function public.get_my_social_identity()
returns table(profile_id uuid, username text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select profile.public_id, profile.username
  from public.social_profiles profile
  where auth.uid() is not null
    and profile.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_social_identity() from public, anon, authenticated;
grant execute on function public.get_my_social_identity() to authenticated;

create or replace function public.set_my_social_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := lower(btrim(regexp_replace(coalesce(p_username, ''), '^@+', '')));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if normalized !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters using letters, numbers, or underscores';
  end if;
  if normalized in ('admin', 'administrator', 'moderator', 'scoutbot', 'scoutcore', 'scoutcoremlb', 'support', 'system') then
    raise exception 'That username is reserved';
  end if;

  update public.social_profiles
  set username = normalized,
      updated_at = now()
  where user_id = auth.uid();

  if not found then
    perform public.sync_my_social_profile();
    update public.social_profiles
    set username = normalized,
        updated_at = now()
    where user_id = auth.uid();
  end if;

  return normalized;
exception
  when unique_violation then
    raise exception 'That username is already taken';
end;
$$;

revoke all on function public.set_my_social_username(text) from public, anon, authenticated;
grant execute on function public.set_my_social_username(text) to authenticated;

drop function if exists public.get_social_profile(uuid);
create function public.get_social_profile(p_profile_id uuid)
returns table(
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  scout_level text,
  is_self boolean,
  is_following boolean,
  friend_status text,
  friend_request_id uuid,
  is_online boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    profile.public_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    public.scout_level_for_points(score.points),
    profile.user_id = auth.uid(),
    case
      when auth.uid() is null then false
      else exists (
        select 1
        from public.user_follows follow
        where follow.follower_id = auth.uid()
          and follow.followed_id = profile.user_id
      )
    end,
    relationship.friend_status,
    relationship.friend_request_id,
    coalesce(profile.last_seen_at > now() - interval '3 minutes', false)
  from public.social_profiles profile
  left join public.challenge_scores score on score.user_id = profile.user_id
  cross join lateral public.social_friend_relationship(profile.user_id) relationship
  where profile.public_id = p_profile_id
  limit 1;
$$;

revoke all on function public.get_social_profile(uuid) from public, anon, authenticated;
grant execute on function public.get_social_profile(uuid) to anon, authenticated;

drop function if exists public.get_my_social_people(text);
create function public.get_my_social_people(p_kind text)
returns table(
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  scout_level text,
  followed_at timestamptz,
  is_online boolean,
  is_following boolean,
  friend_status text,
  friend_request_id uuid
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with mine as (
    select follow.followed_id
    from public.user_follows follow
    where follow.follower_id = auth.uid()
  ),
  followers as (
    select follow.follower_id as other_id, follow.created_at as followed_at
    from public.user_follows follow
    where follow.followed_id = auth.uid()
  ),
  following as (
    select follow.followed_id as other_id, follow.created_at as followed_at
    from public.user_follows follow
    where follow.follower_id = auth.uid()
  ),
  friends as (
    select first_follow.followed_id as other_id,
           greatest(first_follow.created_at, second_follow.created_at) as followed_at
    from public.user_follows first_follow
    join public.user_follows second_follow
      on second_follow.follower_id = first_follow.followed_id
     and second_follow.followed_id = first_follow.follower_id
    where first_follow.follower_id = auth.uid()
  ),
  chosen as (
    select * from followers where lower(p_kind) = 'followers'
    union all
    select * from following where lower(p_kind) = 'following'
    union all
    select * from friends where lower(p_kind) = 'friends'
  )
  select
    profile.public_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    public.scout_level_for_points(score.points),
    chosen.followed_at,
    coalesce(profile.last_seen_at > now() - interval '3 minutes', false),
    exists(select 1 from mine where mine.followed_id = profile.user_id),
    relationship.friend_status,
    relationship.friend_request_id
  from chosen
  join public.social_profiles profile on profile.user_id = chosen.other_id
  left join public.challenge_scores score on score.user_id = profile.user_id
  cross join lateral public.social_friend_relationship(profile.user_id) relationship
  where auth.uid() is not null
  order by lower(profile.display_name);
$$;

revoke all on function public.get_my_social_people(text) from public, anon, authenticated;
grant execute on function public.get_my_social_people(text) to authenticated;

create or replace function public.search_social_profiles(p_query text, p_limit integer default 20)
returns table(
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  scout_level text,
  is_online boolean,
  is_following boolean,
  friend_status text,
  friend_request_id uuid
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  query_text text := lower(btrim(regexp_replace(coalesce(p_query, ''), '^@+', '')));
  result_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(query_text) < 2 then
    return;
  end if;

  return query
  select
    profile.public_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    public.scout_level_for_points(score.points),
    coalesce(profile.last_seen_at > now() - interval '3 minutes', false),
    exists (
      select 1 from public.user_follows follow
      where follow.follower_id = auth.uid()
        and follow.followed_id = profile.user_id
    ),
    relationship.friend_status,
    relationship.friend_request_id
  from public.social_profiles profile
  left join public.challenge_scores score on score.user_id = profile.user_id
  cross join lateral public.social_friend_relationship(profile.user_id) relationship
  where profile.user_id <> auth.uid()
    and (
      profile.username = query_text
      or profile.username like query_text || '%'
      or position(query_text in lower(profile.display_name)) > 0
    )
  order by
    (profile.username = query_text) desc,
    (profile.username like query_text || '%') desc,
    lower(profile.display_name)
  limit result_limit;
end;
$$;

revoke all on function public.search_social_profiles(text, integer) from public, anon, authenticated;
grant execute on function public.search_social_profiles(text, integer) to authenticated;

create or replace function public.send_friend_request(p_profile_id uuid)
returns table(request_id uuid, friend_status text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_profile public.social_profiles%rowtype;
  recipient_profile public.social_profiles%rowtype;
  pending_request public.friend_requests%rowtype;
  created_request_id uuid;
  recent_request_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into actor_profile
  from public.social_profiles
  where user_id = auth.uid();
  if actor_profile.public_id is null then
    perform public.sync_my_social_profile();
    select * into actor_profile from public.social_profiles where user_id = auth.uid();
  end if;

  select * into recipient_profile
  from public.social_profiles
  where public_id = p_profile_id;

  if recipient_profile.public_id is null then
    raise exception 'Profile not found';
  end if;
  if recipient_profile.user_id = auth.uid() then
    raise exception 'You cannot add yourself';
  end if;
  if exists (
    select 1
    from public.user_follows mine
    join public.user_follows theirs
      on theirs.follower_id = mine.followed_id
     and theirs.followed_id = mine.follower_id
    where mine.follower_id = auth.uid()
      and mine.followed_id = recipient_profile.user_id
  ) then
    raise exception 'You are already friends';
  end if;

  select * into pending_request
  from public.friend_requests request
  where request.status = 'pending'
    and (
      (request.requester_id = auth.uid() and request.recipient_id = recipient_profile.user_id)
      or (request.recipient_id = auth.uid() and request.requester_id = recipient_profile.user_id)
    )
  order by request.created_at desc
  limit 1;

  if pending_request.id is not null then
    return query
    select pending_request.id,
      case when pending_request.requester_id = auth.uid() then 'outgoing' else 'incoming' end;
    return;
  end if;

  select count(*)::integer into recent_request_count
  from public.friend_requests request
  where request.requester_id = auth.uid()
    and request.created_at > now() - interval '24 hours';
  if recent_request_count >= 20 then
    raise exception 'Friend request limit reached. Please try again later';
  end if;

  insert into public.friend_requests (requester_id, recipient_id)
  values (auth.uid(), recipient_profile.user_id)
  returning id into created_request_id;

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
    'friend_request',
    'New friend request',
    actor_profile.display_name || ' wants to add you as a friend.',
    'profile:requests',
    created_request_id
  );

  return query select created_request_id, 'outgoing'::text;
exception
  when unique_violation then
    return query
    select request.id,
      case when request.requester_id = auth.uid() then 'outgoing' else 'incoming' end
    from public.friend_requests request
    where request.status = 'pending'
      and least(request.requester_id, request.recipient_id) = least(auth.uid(), recipient_profile.user_id)
      and greatest(request.requester_id, request.recipient_id) = greatest(auth.uid(), recipient_profile.user_id)
    order by request.created_at desc
    limit 1;
end;
$$;

revoke all on function public.send_friend_request(uuid) from public, anon, authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_request_id uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_row public.friend_requests%rowtype;
  actor_profile public.social_profiles%rowtype;
  requester_profile public.social_profiles%rowtype;
  normalized_action text := lower(btrim(coalesce(p_action, '')));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if normalized_action not in ('accept', 'decline') then
    raise exception 'Invalid friend request response';
  end if;

  select * into request_row
  from public.friend_requests request
  where request.id = p_request_id
    and request.recipient_id = auth.uid()
    and request.status = 'pending'
  for update;

  if request_row.id is null then
    raise exception 'Friend request not found';
  end if;

  update public.friend_requests
  set status = case when normalized_action = 'accept' then 'accepted' else 'declined' end,
      responded_at = now(),
      updated_at = now()
  where id = request_row.id;

  if normalized_action = 'accept' then
    insert into public.user_follows (follower_id, followed_id)
    values
      (request_row.requester_id, request_row.recipient_id),
      (request_row.recipient_id, request_row.requester_id)
    on conflict do nothing;
  end if;

  select * into actor_profile from public.social_profiles where user_id = auth.uid();
  select * into requester_profile from public.social_profiles where user_id = request_row.requester_id;

  if actor_profile.public_id is not null and requester_profile.public_id is not null then
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
      requester_profile.public_id,
      actor_profile.public_id,
      actor_profile.display_name,
      actor_profile.avatar_url,
      'friend_request_update',
      case when normalized_action = 'accept' then 'Friend request accepted' else 'Friend request update' end,
      case when normalized_action = 'accept'
        then actor_profile.display_name || ' accepted your friend request.'
        else actor_profile.display_name || ' is not accepting the request right now.'
      end,
      case when normalized_action = 'accept' then 'profile:friends' else 'profile:requests' end,
      request_row.id
    );
  end if;

  return case when normalized_action = 'accept' then 'friends' else 'none' end;
end;
$$;

revoke all on function public.respond_friend_request(uuid, text) from public, anon, authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.friend_requests
  set status = 'cancelled',
      responded_at = now(),
      updated_at = now()
  where id = p_request_id
    and requester_id = auth.uid()
    and status = 'pending';

  return found;
end;
$$;

revoke all on function public.cancel_friend_request(uuid) from public, anon, authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

create or replace function public.get_my_friend_requests(p_kind text default 'incoming')
returns table(
  request_id uuid,
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  scout_level text,
  requested_at timestamptz,
  friend_status text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with requests as (
    select
      request.id,
      case when request.recipient_id = auth.uid() then request.requester_id else request.recipient_id end as other_user_id,
      request.created_at,
      case when request.recipient_id = auth.uid() then 'incoming' else 'outgoing' end as direction
    from public.friend_requests request
    where request.status = 'pending'
      and auth.uid() is not null
      and (
        (lower(p_kind) = 'incoming' and request.recipient_id = auth.uid())
        or (lower(p_kind) = 'outgoing' and request.requester_id = auth.uid())
      )
  )
  select
    requests.id,
    profile.public_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    public.scout_level_for_points(score.points),
    requests.created_at,
    requests.direction
  from requests
  join public.social_profiles profile on profile.user_id = requests.other_user_id
  left join public.challenge_scores score on score.user_id = profile.user_id
  order by requests.created_at desc;
$$;

revoke all on function public.get_my_friend_requests(text) from public, anon, authenticated;
grant execute on function public.get_my_friend_requests(text) to authenticated;
