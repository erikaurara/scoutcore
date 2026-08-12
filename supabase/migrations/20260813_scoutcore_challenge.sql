-- ScoutCore Challenge backend schema.
-- This migration is intentionally staged on the development branch and should be
-- applied to Supabase only when the Challenge feature is ready to publish.

create table if not exists public.challenge_cards (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'ScoutCore User',
  game_pk bigint not null,
  game_date timestamptz not null,
  away_team jsonb not null,
  home_team jsonb not null,
  selections jsonb not null default '[]'::jsonb,
  status text not null default 'upcoming' check (status in ('upcoming','finished')),
  total_count integer not null default 0,
  settled_count integer not null default 0,
  correct_count integer not null default 0,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists challenge_cards_user_created_idx
  on public.challenge_cards(user_id, created_at desc);
create index if not exists challenge_cards_game_status_idx
  on public.challenge_cards(game_pk, status);

alter table public.challenge_cards enable row level security;

grant select, insert on table public.challenge_cards to authenticated;

create policy "challenge users can read own cards"
  on public.challenge_cards
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "challenge users can create own cards"
  on public.challenge_cards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Results and points are intentionally not client-updatable. A service-role
-- result-settling function should update them after MLB marks the game Final.

create table if not exists public.challenge_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ScoutCore User',
  points integer not null default 0,
  correct_picks integer not null default 0,
  total_picks integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists challenge_scores_rank_idx
  on public.challenge_scores(points desc, correct_picks desc, updated_at asc);

alter table public.challenge_scores enable row level security;

grant select on table public.challenge_scores to authenticated;

create policy "authenticated users can view challenge leaderboard"
  on public.challenge_scores
  for select
  to authenticated
  using (true);

comment on table public.challenge_cards is 'No-money ScoutCore baseball prediction challenge cards.';
comment on table public.challenge_scores is 'Server-maintained ScoutCore Challenge leaderboard statistics.';
