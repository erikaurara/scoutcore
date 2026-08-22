-- Secure access limits for free analysis accounts.
-- Usage resets at midnight in the MLB's primary Eastern Time zone.

create table if not exists public.analysis_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  feature text not null,
  used_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, feature),
  constraint analysis_daily_usage_feature_check
    check (feature in ('matchup_lab', 'team_analysis')),
  constraint analysis_daily_usage_count_check
    check (used_count >= 0)
);

alter table public.analysis_daily_usage enable row level security;

-- Browser clients can only reach usage through the two authenticated RPCs
-- below. This prevents a caller from editing or resetting their own counter.
revoke all on table public.analysis_daily_usage from public, anon, authenticated;
grant select, insert, update, delete on table public.analysis_daily_usage to service_role;

create index if not exists analysis_daily_usage_cleanup_idx
  on public.analysis_daily_usage (usage_date);

create or replace function public.get_analysis_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_usage_date date := (current_timestamp at time zone 'America/New_York')::date;
  v_reset_at timestamptz := ((v_usage_date + 1)::timestamp at time zone 'America/New_York');
  v_is_admin boolean := false;
  v_is_premium boolean := false;
  v_matchup_used integer := 0;
  v_team_used integer := 0;
  v_unlimited boolean := false;
  v_tier text := 'free';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.community_admins
    where user_id = v_user_id
  ) into v_is_admin;

  -- Subscription authorization uses server-controlled app metadata. Never use
  -- user-editable user_metadata to grant Premium access.
  select coalesce(
    lower(coalesce(raw_app_meta_data ->> 'plan', '')) = 'premium'
    or lower(coalesce(raw_app_meta_data ->> 'subscription_tier', '')) = 'premium'
    or lower(coalesce(raw_app_meta_data ->> 'is_premium', 'false')) = 'true',
    false
  )
  into v_is_premium
  from auth.users
  where id = v_user_id;

  v_is_premium := coalesce(v_is_premium, false);
  v_unlimited := v_is_admin or v_is_premium;
  v_tier := case when v_is_admin then 'admin' when v_is_premium then 'premium' else 'free' end;

  select
    coalesce(max(used_count) filter (where feature = 'matchup_lab'), 0),
    coalesce(max(used_count) filter (where feature = 'team_analysis'), 0)
  into v_matchup_used, v_team_used
  from public.analysis_daily_usage
  where user_id = v_user_id
    and usage_date = v_usage_date;

  return jsonb_build_object(
    'tier', v_tier,
    'unlimited', v_unlimited,
    'reset_at', v_reset_at,
    'limits', jsonb_build_object(
      'matchup_lab', 3,
      'team_analysis', 1,
      'player_prediction_cards', 3
    ),
    'usage', jsonb_build_object(
      'matchup_lab', v_matchup_used,
      'team_analysis', v_team_used
    ),
    'remaining', jsonb_build_object(
      'matchup_lab', case when v_unlimited then null else greatest(0, 3 - v_matchup_used) end,
      'team_analysis', case when v_unlimited then null else greatest(0, 1 - v_team_used) end
    ),
    'capabilities', jsonb_build_object(
      'advanced_analytics', v_unlimited,
      'advanced_prediction_filters', v_unlimited
    )
  );
end;
$$;

create or replace function public.consume_analysis_credit(p_feature text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_usage_date date := (current_timestamp at time zone 'America/New_York')::date;
  v_reset_at timestamptz := ((v_usage_date + 1)::timestamp at time zone 'America/New_York');
  v_is_admin boolean := false;
  v_is_premium boolean := false;
  v_unlimited boolean := false;
  v_tier text := 'free';
  v_limit integer;
  v_used integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_feature not in ('matchup_lab', 'team_analysis') then
    raise exception 'Unknown analysis feature';
  end if;

  select exists (
    select 1
    from public.community_admins
    where user_id = v_user_id
  ) into v_is_admin;

  select coalesce(
    lower(coalesce(raw_app_meta_data ->> 'plan', '')) = 'premium'
    or lower(coalesce(raw_app_meta_data ->> 'subscription_tier', '')) = 'premium'
    or lower(coalesce(raw_app_meta_data ->> 'is_premium', 'false')) = 'true',
    false
  )
  into v_is_premium
  from auth.users
  where id = v_user_id;

  v_is_premium := coalesce(v_is_premium, false);
  v_unlimited := v_is_admin or v_is_premium;
  v_tier := case when v_is_admin then 'admin' when v_is_premium then 'premium' else 'free' end;
  v_limit := case when p_feature = 'matchup_lab' then 3 else 1 end;

  if v_unlimited then
    return jsonb_build_object(
      'allowed', true,
      'tier', v_tier,
      'unlimited', true,
      'feature', p_feature,
      'limit', null,
      'used', null,
      'remaining', null,
      'reset_at', v_reset_at
    );
  end if;

  insert into public.analysis_daily_usage as daily_usage (
    user_id,
    usage_date,
    feature,
    used_count,
    updated_at
  ) values (
    v_user_id,
    v_usage_date,
    p_feature,
    1,
    now()
  )
  on conflict (user_id, usage_date, feature) do update
    set used_count = daily_usage.used_count + 1,
        updated_at = now()
    where daily_usage.used_count < v_limit
  returning used_count into v_used;

  if v_used is null then
    select used_count
    into v_used
    from public.analysis_daily_usage
    where user_id = v_user_id
      and usage_date = v_usage_date
      and feature = p_feature;

    return jsonb_build_object(
      'allowed', false,
      'tier', v_tier,
      'unlimited', false,
      'feature', p_feature,
      'limit', v_limit,
      'used', coalesce(v_used, v_limit),
      'remaining', 0,
      'reset_at', v_reset_at
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'tier', v_tier,
    'unlimited', false,
    'feature', p_feature,
    'limit', v_limit,
    'used', v_used,
    'remaining', greatest(0, v_limit - v_used),
    'reset_at', v_reset_at
  );
end;
$$;

revoke all on function public.get_analysis_access() from public, anon;
revoke all on function public.consume_analysis_credit(text) from public, anon;
grant execute on function public.get_analysis_access() to authenticated;
grant execute on function public.consume_analysis_credit(text) to authenticated;

comment on table public.analysis_daily_usage is
  'Server-managed per-account daily usage for free analysis features.';
comment on function public.get_analysis_access() is
  'Returns the authenticated account tier, daily usage, remaining access, and feature capabilities.';
comment on function public.consume_analysis_credit(text) is
  'Atomically consumes one free analysis credit; Premium and administrator accounts are unlimited.';
