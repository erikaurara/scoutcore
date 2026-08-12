-- ScoutCore Challenge weekly-ticket rules.
-- Staged on the development branch only. Apply with the final Challenge release.

alter table public.challenge_cards
  add column if not exists week_key date,
  add column if not exists ticket_kind text not null default 'ranked';

update public.challenge_cards
set week_key = date_trunc('week', created_at at time zone 'UTC')::date
where week_key is null;

alter table public.challenge_cards
  alter column week_key set not null;

alter table public.challenge_cards
  drop constraint if exists challenge_cards_ticket_kind_check;

alter table public.challenge_cards
  add constraint challenge_cards_ticket_kind_check
  check (ticket_kind in ('ranked', 'extra'));

create index if not exists challenge_cards_user_week_ticket_idx
  on public.challenge_cards(user_id, week_key, ticket_kind, created_at);

-- Challenge cards must be submitted through this function so clients cannot
-- bypass weekly limits or mark Premium extra tickets as ranked.
revoke insert on table public.challenge_cards from authenticated;
drop policy if exists "challenge users can create own cards" on public.challenge_cards;

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

  select coalesce(
    raw_user_meta_data ->> 'plan' = 'premium'
    or raw_user_meta_data ->> 'subscription_tier' = 'premium'
    or lower(coalesce(raw_user_meta_data ->> 'is_premium', 'false')) = 'true',
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

  if v_ranked_used < 5 then
    v_ticket_kind := 'ranked';
  elsif v_is_premium and v_extra_used < 10 then
    v_ticket_kind := 'extra';
  else
    raise exception 'No Challenge Tickets remaining this week';
  end if;

  insert into public.challenge_cards (
    id,
    user_id,
    display_name,
    game_pk,
    game_date,
    away_team,
    home_team,
    selections,
    status,
    total_count,
    week_key,
    ticket_kind
  ) values (
    p_id,
    v_user_id,
    left(coalesce(nullif(trim(p_display_name), ''), 'ScoutCore User'), 80),
    p_game_pk,
    p_game_date,
    p_away_team,
    p_home_team,
    p_selections,
    'upcoming',
    jsonb_array_length(p_selections),
    v_week_key,
    v_ticket_kind
  );

  return p_id;
end;
$$;

revoke all on function public.submit_challenge_card(uuid,text,bigint,timestamptz,jsonb,jsonb,jsonb) from public;
grant execute on function public.submit_challenge_card(uuid,text,bigint,timestamptz,jsonb,jsonb,jsonb) to authenticated;

comment on column public.challenge_cards.ticket_kind is
  'ranked = one of 5 equal weekly leaderboard entries; extra = Premium personal-only entry with no leaderboard points.';
comment on column public.challenge_cards.week_key is
  'UTC Monday used for weekly Challenge Ticket accounting.';
comment on function public.submit_challenge_card(uuid,text,bigint,timestamptz,jsonb,jsonb,jsonb) is
  'Securely assigns weekly Challenge Tickets: 5 ranked for every account, then up to 10 Premium extra unranked cards.';
