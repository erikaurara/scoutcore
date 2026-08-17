-- Allow a signed-in user to edit only their own no-money ScoutCore picks
-- before first pitch. Result and points fields remain server-controlled.

create or replace function public.update_upcoming_challenge_card(
  p_card_id uuid,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.challenge_cards%rowtype;
  v_normalized jsonb;
  v_count integer;
  v_away_id bigint;
  v_home_id bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_selections) <> 'array' then
    raise exception 'Predictions must be an array';
  end if;

  v_count := jsonb_array_length(p_selections);
  if v_count < 1 or v_count > 8 then
    raise exception 'A Challenge Card must contain 1 to 8 selections';
  end if;

  select *
  into v_card
  from public.challenge_cards
  where id = p_card_id
  for update;

  if not found or v_card.user_id <> v_user_id then
    raise exception 'Challenge Card not found';
  end if;

  if v_card.status <> 'upcoming'
     or v_card.game_date <= now()
     or v_card.settled_count <> 0
     or v_card.settled_at is not null then
    raise exception 'Predictions are locked after the game starts';
  end if;

  v_away_id := coalesce(
    nullif(v_card.away_team ->> 'id', '')::bigint,
    nullif(v_card.away_team ->> 'teamId', '')::bigint
  );
  v_home_id := coalesce(
    nullif(v_card.home_team ->> 'id', '')::bigint,
    nullif(v_card.home_team ->> 'teamId', '')::bigint
  );

  if exists (
    select 1
    from jsonb_array_elements(p_selections) as item(value)
    cross join lateral (
      select
        item.value ->> 'type' as prediction_type,
        coalesce(item.value ->> 'direction', 'gte') as direction,
        coalesce(item.value ->> 'choice', '') as choice,
        case when jsonb_typeof(item.value -> 'gamePk') = 'number' then (item.value ->> 'gamePk')::bigint end as game_pk,
        case when jsonb_typeof(item.value -> 'subjectId') = 'number' then (item.value ->> 'subjectId')::bigint end as subject_id,
        case when jsonb_typeof(item.value -> 'teamId') = 'number' then (item.value ->> 'teamId')::bigint end as team_id,
        case when jsonb_typeof(item.value -> 'threshold') = 'number' then (item.value ->> 'threshold')::numeric end as threshold
    ) as pick
    where jsonb_typeof(item.value) <> 'object'
       or coalesce(item.value ->> 'id', '') = ''
       or pick.game_pk is null
       or pick.game_pk <> v_card.game_pk
       or pick.subject_id is null
       or pick.team_id is null
       or pick.threshold is null
       or not (
         (pick.prediction_type = 'hitter_hit' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2,3))
         or (pick.prediction_type = 'hitter_total_base' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2,3,4))
         or (pick.prediction_type = 'hitter_reach_base' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2,3))
         or (pick.prediction_type = 'hitter_home_run' and pick.direction = 'gte' and pick.choice = '' and pick.threshold = 1)
         or (pick.prediction_type = 'hitter_runs' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2))
         or (pick.prediction_type = 'hitter_rbi' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2,3))
         or (pick.prediction_type = 'hitter_walks' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2))
         or (pick.prediction_type = 'hitter_stolen_bases' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2))
         or (pick.prediction_type = 'hitter_extra_base_hit' and pick.direction = 'gte' and pick.choice = '' and pick.threshold = 1)
         or (pick.prediction_type = 'hitter_hrr' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (2,3,4))
         or (pick.prediction_type = 'hitter_strikeouts' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (1,2))
         or (pick.prediction_type = 'pitcher_strikeouts' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (4,5,6,7,8))
         or (pick.prediction_type = 'pitcher_innings' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (5,6))
         or (pick.prediction_type = 'pitcher_hits_allowed' and pick.direction = 'lte' and pick.choice = '' and pick.threshold in (4,5,6))
         or (pick.prediction_type = 'pitcher_earned_runs' and pick.direction = 'lte' and pick.choice = '' and pick.threshold in (1,2,3))
         or (pick.prediction_type = 'pitcher_walks' and pick.direction = 'lte' and pick.choice = '' and pick.threshold in (1,2,3))
         or (pick.prediction_type = 'pitcher_quality_start' and pick.direction = 'eq' and ((pick.choice = 'yes' and pick.threshold = 1) or (pick.choice = 'no' and pick.threshold = 0)))
         or (pick.prediction_type = 'game_first_inning' and pick.direction = 'eq' and ((pick.choice = 'run' and pick.threshold = 1) or (pick.choice = 'no_run' and pick.threshold = 0)))
         or (pick.prediction_type = 'game_first_team_score' and pick.direction = 'eq' and pick.choice = '' and pick.threshold = 1)
         or (pick.prediction_type = 'team_runs' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (3,4,5))
         or (pick.prediction_type = 'team_hits' and pick.direction = 'gte' and pick.choice = '' and pick.threshold in (7,9,11))
         or (pick.prediction_type = 'game_extra_innings' and pick.direction = 'eq' and ((pick.choice = 'yes' and pick.threshold = 1) or (pick.choice = 'no' and pick.threshold = 0)))
         or (pick.prediction_type = 'team_winner' and pick.direction = 'eq' and pick.choice = '' and pick.threshold = 1)
       )
       or (
         (pick.prediction_type like 'hitter_%' or pick.prediction_type like 'pitcher_%')
         and (pick.subject_id <= 0 or pick.team_id not in (v_away_id, v_home_id))
       )
       or (
         pick.prediction_type in ('game_first_team_score','team_runs','team_hits','team_winner')
         and (pick.team_id not in (v_away_id, v_home_id) or pick.subject_id <> pick.team_id)
       )
       or (
         pick.prediction_type in ('game_first_inning','game_extra_innings')
         and (pick.subject_id <> v_card.game_pk or pick.team_id <> 0)
       )
  ) then
    raise exception 'One or more predictions are invalid';
  end if;

  if (
    select count(distinct concat_ws('|',
      item.value ->> 'type',
      item.value ->> 'subjectId',
      item.value ->> 'threshold',
      coalesce(item.value ->> 'choice', '')
    ))
    from jsonb_array_elements(p_selections) as item(value)
  ) <> v_count then
    raise exception 'Duplicate predictions are not allowed';
  end if;

  select jsonb_agg(
    (
      item.value
      - 'result'
      - 'resultValue'
      - 'result_value'
      - 'actual_result'
      - 'result_detail'
      - 'chance'
      - 'score'
      - 'summary'
      - 'keyFactor'
      - 'stats'
      - 'projection'
      - 'probability'
      - 'confidence'
      - 'scoutcore_projection'
      - 'id'
      - 'scope'
      - 'gamePk'
      - 'direction'
    )
    || jsonb_build_object(
      'id', concat_ws('-',
        v_card.game_pk,
        item.value ->> 'type',
        item.value ->> 'subjectId',
        item.value ->> 'threshold',
        coalesce(item.value ->> 'choice', '')
      ),
      'gamePk', v_card.game_pk,
      'scope', case
        when item.value ->> 'type' like 'hitter_%' then 'batter'
        when item.value ->> 'type' like 'pitcher_%' then 'pitcher'
        else 'game'
      end,
      'direction', coalesce(item.value ->> 'direction', 'gte'),
      'result', 'pending'
    )
    order by item.ordinality
  )
  into v_normalized
  from jsonb_array_elements(p_selections) with ordinality as item(value, ordinality);

  update public.challenge_cards
  set selections = v_normalized,
      total_count = v_count
  where id = v_card.id;

  return jsonb_build_object(
    'id', v_card.id,
    'status', 'upcoming',
    'game_date', v_card.game_date,
    'total_count', v_count,
    'selections', v_normalized
  );
end;
$$;

revoke all on function public.update_upcoming_challenge_card(uuid,jsonb) from public;
grant execute on function public.update_upcoming_challenge_card(uuid,jsonb) to authenticated;

comment on function public.update_upcoming_challenge_card(uuid,jsonb) is
  'Updates only the signed-in owner''s pending, no-money ScoutCore selections before first pitch; results and points remain server-controlled.';
