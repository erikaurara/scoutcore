-- ScoutCore social follows.
-- Public surfaces can show a safe public profile identity (name/avatar/Scout level),
-- while follower/following counts and lists remain private to the signed-in account.

create extension if not exists pgcrypto;

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_id uuid not null unique default gen_random_uuid(),
  display_name text not null default 'ScoutCore User',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint user_follows_no_self check (follower_id <> followed_id)
);

create index if not exists user_follows_followed_idx on public.user_follows(followed_id, created_at desc);
create index if not exists user_follows_follower_idx on public.user_follows(follower_id, created_at desc);

alter table public.social_profiles enable row level security;
alter table public.user_follows enable row level security;

-- Do not expose auth UUIDs through direct REST table reads. All social access goes through safe RPCs below.
revoke all on table public.social_profiles from anon, authenticated;
revoke all on table public.user_follows from anon, authenticated;

create or replace function public.social_display_name(p_user auth.users)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(p_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(p_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(p_user.email, ''), '@', 1), ''),
    'ScoutCore User'
  );
$$;

create or replace function public.sync_social_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.social_profiles (user_id, display_name, avatar_url, updated_at)
  values (
    new.id,
    public.social_display_name(new),
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    now()
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_scoutcore_social_profile on auth.users;
create trigger sync_scoutcore_social_profile
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute procedure public.sync_social_profile_from_auth();

-- Backfill accounts that already existed before this migration.
insert into public.social_profiles (user_id, display_name, avatar_url)
select
  u.id,
  public.social_display_name(u),
  nullif(btrim(u.raw_user_meta_data ->> 'avatar_url'), '')
from auth.users u
on conflict (user_id) do update
  set display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();

create or replace function public.scout_level_for_points(p_points integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_points, 0) >= 5000 then 'ScoutCore All-Star'
    when coalesce(p_points, 0) >= 2000 then 'Elite Scout'
    when coalesce(p_points, 0) >= 750 then 'Pro Scout'
    when coalesce(p_points, 0) >= 250 then 'Advanced Scout'
    else 'Rookie Scout'
  end;
$$;

create or replace function public.sync_my_social_profile()
returns table (profile_id uuid, display_name text, avatar_url text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me auth.users%rowtype;
begin
  if auth.uid() is null then
    return;
  end if;
  select * into me from auth.users where id = auth.uid();
  if me.id is null then
    return;
  end if;

  insert into public.social_profiles (user_id, display_name, avatar_url, updated_at)
  values (
    me.id,
    public.social_display_name(me),
    nullif(btrim(me.raw_user_meta_data ->> 'avatar_url'), ''),
    now()
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  return query
  select sp.public_id, sp.display_name, sp.avatar_url
  from public.social_profiles sp
  where sp.user_id = auth.uid();
end;
$$;

-- Public profile card. Intentionally does NOT return follower/following totals.
create or replace function public.get_social_profile(p_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  scout_level text,
  is_self boolean,
  is_following boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    sp.public_id,
    sp.display_name,
    sp.avatar_url,
    public.scout_level_for_points(cs.points),
    sp.user_id = auth.uid(),
    case
      when auth.uid() is null then false
      else exists (
        select 1 from public.user_follows f
        where f.follower_id = auth.uid() and f.followed_id = sp.user_id
      )
    end
  from public.social_profiles sp
  left join public.challenge_scores cs on cs.user_id = sp.user_id
  where sp.public_id = p_profile_id
  limit 1;
$$;

create or replace function public.toggle_social_follow(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select user_id into target_user_id
  from public.social_profiles
  where public_id = p_profile_id;

  if target_user_id is null then
    raise exception 'Profile not found';
  end if;
  if target_user_id = auth.uid() then
    return false;
  end if;

  if exists (
    select 1 from public.user_follows
    where follower_id = auth.uid() and followed_id = target_user_id
  ) then
    delete from public.user_follows
    where follower_id = auth.uid() and followed_id = target_user_id;
    return false;
  end if;

  insert into public.user_follows (follower_id, followed_id)
  values (auth.uid(), target_user_id)
  on conflict do nothing;
  return true;
end;
$$;

-- Owner-only counts. These are never included in another user's public profile card.
create or replace function public.get_my_follow_counts()
returns table (followers integer, following integer)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    (select count(*)::integer from public.user_follows f where f.followed_id = auth.uid()),
    (select count(*)::integer from public.user_follows f where f.follower_id = auth.uid())
  where auth.uid() is not null;
$$;

create or replace function public.get_my_followers()
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  scout_level text,
  followed_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    sp.public_id,
    sp.display_name,
    sp.avatar_url,
    public.scout_level_for_points(cs.points),
    f.created_at
  from public.user_follows f
  join public.social_profiles sp on sp.user_id = f.follower_id
  left join public.challenge_scores cs on cs.user_id = sp.user_id
  where f.followed_id = auth.uid() and auth.uid() is not null
  order by f.created_at desc;
$$;

create or replace function public.get_my_following()
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  scout_level text,
  followed_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    sp.public_id,
    sp.display_name,
    sp.avatar_url,
    public.scout_level_for_points(cs.points),
    f.created_at
  from public.user_follows f
  join public.social_profiles sp on sp.user_id = f.followed_id
  left join public.challenge_scores cs on cs.user_id = sp.user_id
  where f.follower_id = auth.uid() and auth.uid() is not null
  order by f.created_at desc;
$$;

-- Safe author identities for the Community page. No auth UUIDs or private follow counts.
create or replace function public.get_community_social_profiles(p_post_limit integer default 100, p_comment_limit integer default 700)
returns table (
  activity_type text,
  activity_id uuid,
  profile_id uuid,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with posts as (
    select p.id, p.user_id, p.author_name, p.created_at
    from public.community_posts p
    where p.moderation_status = 'approved' or p.user_id = auth.uid()
    order by p.created_at desc
    limit greatest(1, least(coalesce(p_post_limit, 100), 500))
  ), comments as (
    select c.id, c.user_id, c.author_name, c.created_at
    from public.community_comments c
    where c.moderation_status = 'approved' or c.user_id = auth.uid()
    order by c.created_at desc
    limit greatest(1, least(coalesce(p_comment_limit, 700), 2000))
  )
  select 'post'::text, p.id, sp.public_id, coalesce(sp.display_name, p.author_name), sp.avatar_url
  from posts p
  left join public.social_profiles sp on sp.user_id = p.user_id
  union all
  select 'comment'::text, c.id, sp.public_id, coalesce(sp.display_name, c.author_name), sp.avatar_url
  from comments c
  left join public.social_profiles sp on sp.user_id = c.user_id;
$$;

-- Safe author identities for live game chat. No auth UUIDs or private follow counts.
create or replace function public.get_game_chat_social_profiles(p_game_pk bigint, p_limit integer default 50)
returns table (
  message_id uuid,
  profile_id uuid,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    m.id,
    sp.public_id,
    coalesce(sp.display_name, m.display_name),
    sp.avatar_url
  from public.game_chat_messages m
  left join public.social_profiles sp on sp.user_id = m.user_id
  where m.game_pk = p_game_pk
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.sync_my_social_profile() from public;
revoke all on function public.get_social_profile(uuid) from public;
revoke all on function public.toggle_social_follow(uuid) from public;
revoke all on function public.get_my_follow_counts() from public;
revoke all on function public.get_my_followers() from public;
revoke all on function public.get_my_following() from public;
revoke all on function public.get_community_social_profiles(integer, integer) from public;
revoke all on function public.get_game_chat_social_profiles(bigint, integer) from public;

grant execute on function public.sync_my_social_profile() to authenticated;
grant execute on function public.get_social_profile(uuid) to anon, authenticated;
grant execute on function public.toggle_social_follow(uuid) to authenticated;
grant execute on function public.get_my_follow_counts() to authenticated;
grant execute on function public.get_my_followers() to authenticated;
grant execute on function public.get_my_following() to authenticated;
grant execute on function public.get_community_social_profiles(integer, integer) to anon, authenticated;
grant execute on function public.get_game_chat_social_profiles(bigint, integer) to anon, authenticated;
