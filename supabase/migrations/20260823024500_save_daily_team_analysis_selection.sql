-- Save the free account's chosen Team Analysis matchup for the Eastern day.
-- The saved matchup can be reopened without consuming another daily use.

alter table public.analysis_daily_usage
  add column if not exists selection_key text,
  add column if not exists selection jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'analysis_daily_usage_selection_check'
      and conrelid = 'public.analysis_daily_usage'::regclass
  ) then
    alter table public.analysis_daily_usage
      add constraint analysis_daily_usage_selection_check
      check (
        (selection_key is null and selection is null)
        or (
          feature = 'team_analysis'
          and selection_key ~ '^[0-9]{1,20}$'
          and jsonb_typeof(selection) = 'object'
          and pg_column_size(selection) <= 8192
        )
      );
  end if;
end;
$$;

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
  v_team_selection jsonb := null;
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

  select selection
  into v_team_selection
  from public.analysis_daily_usage
  where user_id = v_user_id
    and usage_date = v_usage_date
    and feature = 'team_analysis';

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
    'selections', jsonb_build_object(
      'team_analysis', v_team_selection
    ),
    'capabilities', jsonb_build_object(
      'advanced_analytics', v_unlimited,
      'advanced_prediction_filters', v_unlimited
    )
  );
end;
$$;

create or replace function public.open_team_analysis(
  p_selection_key text,
  p_selection jsonb
)
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
  v_saved_key text;
  v_saved_selection jsonb;
  v_used integer;
  v_inserted boolean := false;
  v_reopened boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_selection_key is null or p_selection_key !~ '^[0-9]{1,20}$' then
    raise exception 'A valid MLB game ID is required';
  end if;

  if jsonb_typeof(p_selection) is distinct from 'object'
    or p_selection ->> 'gamePk' is distinct from p_selection_key
    or jsonb_typeof(p_selection -> 'awayTeam') is distinct from 'object'
    or jsonb_typeof(p_selection -> 'homeTeam') is distinct from 'object'
    or coalesce(p_selection #>> '{awayTeam,id}', '') !~ '^[0-9]{1,10}$'
    or coalesce(p_selection #>> '{homeTeam,id}', '') !~ '^[0-9]{1,10}$'
    or length(coalesce(p_selection #>> '{awayTeam,name}', '')) not between 1 and 120
    or length(coalesce(p_selection #>> '{homeTeam,name}', '')) not between 1 and 120
    or pg_column_size(p_selection) > 8192
  then
    raise exception 'Invalid Team Analysis selection';
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

  if v_unlimited then
    return jsonb_build_object(
      'allowed', true,
      'reopened', false,
      'tier', v_tier,
      'unlimited', true,
      'feature', 'team_analysis',
      'limit', null,
      'used', null,
      'remaining', null,
      'reset_at', v_reset_at,
      'saved_selection', p_selection
    );
  end if;

  select selection_key, selection, used_count
  into v_saved_key, v_saved_selection, v_used
  from public.analysis_daily_usage
  where user_id = v_user_id
    and usage_date = v_usage_date
    and feature = 'team_analysis'
  for update;

  if found then
    if v_used < 1 or v_saved_key is null or v_saved_key = p_selection_key then
      v_reopened := v_used >= 1;
      v_used := greatest(1, v_used);

      update public.analysis_daily_usage
      set used_count = v_used,
          selection_key = p_selection_key,
          selection = p_selection,
          updated_at = now()
      where user_id = v_user_id
        and usage_date = v_usage_date
        and feature = 'team_analysis';

      return jsonb_build_object(
        'allowed', true,
        'reopened', v_reopened,
        'tier', v_tier,
        'unlimited', false,
        'feature', 'team_analysis',
        'limit', 1,
        'used', v_used,
        'remaining', greatest(0, 1 - v_used),
        'reset_at', v_reset_at,
        'saved_selection', p_selection
      );
    end if;

    return jsonb_build_object(
      'allowed', false,
      'reopened', false,
      'tier', v_tier,
      'unlimited', false,
      'feature', 'team_analysis',
      'limit', 1,
      'used', v_used,
      'remaining', 0,
      'reset_at', v_reset_at,
      'saved_selection', v_saved_selection
    );
  end if;

  insert into public.analysis_daily_usage (
    user_id,
    usage_date,
    feature,
    used_count,
    selection_key,
    selection,
    updated_at
  ) values (
    v_user_id,
    v_usage_date,
    'team_analysis',
    1,
    p_selection_key,
    p_selection,
    now()
  )
  on conflict (user_id, usage_date, feature) do nothing
  returning true into v_inserted;

  if v_inserted then
    return jsonb_build_object(
      'allowed', true,
      'reopened', false,
      'tier', v_tier,
      'unlimited', false,
      'feature', 'team_analysis',
      'limit', 1,
      'used', 1,
      'remaining', 0,
      'reset_at', v_reset_at,
      'saved_selection', p_selection
    );
  end if;

  -- A concurrent request created the daily row. Lock it and apply the same
  -- saved-matchup rules instead of allowing two different games to win.
  select selection_key, selection, used_count
  into v_saved_key, v_saved_selection, v_used
  from public.analysis_daily_usage
  where user_id = v_user_id
    and usage_date = v_usage_date
    and feature = 'team_analysis'
  for update;

  if v_used < 1 or v_saved_key is null or v_saved_key = p_selection_key then
    v_reopened := v_used >= 1;
    v_used := greatest(1, v_used);

    update public.analysis_daily_usage
    set used_count = v_used,
        selection_key = p_selection_key,
        selection = p_selection,
        updated_at = now()
    where user_id = v_user_id
      and usage_date = v_usage_date
      and feature = 'team_analysis';

    return jsonb_build_object(
      'allowed', true,
      'reopened', v_reopened,
      'tier', v_tier,
      'unlimited', false,
      'feature', 'team_analysis',
      'limit', 1,
      'used', v_used,
      'remaining', greatest(0, 1 - v_used),
      'reset_at', v_reset_at,
      'saved_selection', p_selection
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'reopened', false,
    'tier', v_tier,
    'unlimited', false,
    'feature', 'team_analysis',
    'limit', 1,
    'used', coalesce(v_used, 1),
    'remaining', 0,
    'reset_at', v_reset_at,
    'saved_selection', v_saved_selection
  );
end;
$$;

revoke all on function public.open_team_analysis(text, jsonb) from public, anon, authenticated;
grant execute on function public.open_team_analysis(text, jsonb) to authenticated;

-- Reassert the intended privilege after replacing the access-summary function.
revoke all on function public.get_analysis_access() from public, anon;
grant execute on function public.get_analysis_access() to authenticated;

comment on column public.analysis_daily_usage.selection_key is
  'Stable identifier for the daily saved selection; Team Analysis uses the MLB gamePk.';
comment on column public.analysis_daily_usage.selection is
  'Minimal private matchup metadata needed to show and reopen the authenticated account selection.';
comment on function public.open_team_analysis(text, jsonb) is
  'Claims or reopens the authenticated account daily Team Analysis matchup atomically.';
