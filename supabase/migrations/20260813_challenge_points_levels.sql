-- ScoutCore Challenge points, progression, badge and leaderboard statistics.
-- DEVELOPMENT ONLY: stage this migration in Git. Do not apply it to Supabase until release.
--
-- ScoutCore Points are non-monetary achievement points. They have no cash value,
-- cannot be purchased, exchanged, transferred or withdrawn.
--
-- Scoring rules implemented by settle-challenge:
--   correct prediction        +10
--   perfect Challenge Card    +25
--   reach a 3-pick streak     +10
--   reach a 5-pick streak     +25
--   daily Challenge completed  +5
--   weekly Challenge complete +20
-- Incorrect picks never subtract points; they only affect accuracy.

alter table public.challenge_scores
  add column if not exists perfect_cards integer not null default 0,
  add column if not exists monthly_points integer not null default 0,
  add column if not exists monthly_correct_picks integer not null default 0,
  add column if not exists monthly_total_picks integer not null default 0,
  add column if not exists hitting_correct_picks integer not null default 0,
  add column if not exists hitting_total_picks integer not null default 0,
  add column if not exists pitching_correct_picks integer not null default 0,
  add column if not exists pitching_total_picks integer not null default 0,
  add column if not exists team_correct_picks integer not null default 0,
  add column if not exists team_total_picks integer not null default 0;

create index if not exists challenge_scores_accuracy_idx
  on public.challenge_scores(total_picks desc, correct_picks desc, points desc);

create index if not exists challenge_scores_month_idx
  on public.challenge_scores(monthly_total_picks desc, monthly_correct_picks desc, monthly_points desc);

comment on column public.challenge_scores.points is
  'Non-monetary ScoutCore Points from ranked Challenge performance. No cash value; cannot be bought, exchanged, transferred or withdrawn.';
comment on column public.challenge_scores.perfect_cards is
  'Number of ranked cards with at least two settled selections and every settled selection correct.';
comment on column public.challenge_scores.monthly_points is
  'ScoutCore Points earned on ranked cards whose game date falls in the current UTC calendar month.';
comment on column public.challenge_scores.hitting_total_picks is
  'Settled ranked batter selections used for Hitting leaderboard eligibility and badges.';
comment on column public.challenge_scores.pitching_total_picks is
  'Settled ranked pitcher selections used for Pitching leaderboard eligibility and badges.';
comment on column public.challenge_scores.team_total_picks is
  'Settled ranked game/team selections used for Team Picks leaderboard eligibility and badges.';

-- Scout level thresholds are intentionally derived in the client from total ScoutCore Points:
-- Rookie Scout          0-249
-- Advanced Scout      250-749
-- Pro Scout           750-1999
-- Elite Scout        2000-4999
-- ScoutCore All-Star 5000+
--
-- Main leaderboard eligibility is 20 completed ranked picks. Ranking order in the
-- client is Accuracy -> Correct Picks -> Current Streak -> ScoutCore Points.
