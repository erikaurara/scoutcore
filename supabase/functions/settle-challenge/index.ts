import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Direction = 'gte' | 'lte' | 'eq';
type PickScope = 'batter' | 'pitcher' | 'game';
type ResultStatus = 'pending' | 'correct' | 'incorrect' | 'void';

type PredictionType =
  | 'hitter_hit'
  | 'hitter_total_base'
  | 'hitter_reach_base'
  | 'hitter_home_run'
  | 'hitter_runs'
  | 'hitter_rbi'
  | 'hitter_walks'
  | 'hitter_stolen_bases'
  | 'hitter_extra_base_hit'
  | 'hitter_hrr'
  | 'hitter_strikeouts'
  | 'pitcher_strikeouts'
  | 'pitcher_innings'
  | 'pitcher_hits_allowed'
  | 'pitcher_earned_runs'
  | 'pitcher_walks'
  | 'pitcher_quality_start'
  | 'game_first_inning'
  | 'game_first_team_score'
  | 'team_runs'
  | 'team_hits'
  | 'game_extra_innings'
  | 'team_winner';

type Selection = {
  id: string;
  type: PredictionType;
  scope?: PickScope;
  subjectId: number;
  teamId: number;
  threshold: number;
  direction?: Direction;
  choice?: string;
  result?: ResultStatus;
  resultValue?: number | null;
  [key: string]: unknown;
};

type ChallengeCard = {
  id: string;
  user_id: string;
  display_name: string;
  game_pk: number;
  game_date: string;
  week_key?: string | null;
  ticket_kind: 'ranked' | 'extra';
  selections: Selection[];
  created_at: string;
  settled_at?: string | null;
  status?: string;
  points?: number;
};

const CORRECT_PICK_POINTS = 10;
const PERFECT_CARD_BONUS = 25;
const THREE_STREAK_BONUS = 10;
const FIVE_STREAK_BONUS = 25;
const DAILY_CHALLENGE_BONUS = 5;
const WEEKLY_CHALLENGE_BONUS = 20;
const WEEKLY_COMPLETION_CARDS = 5;

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const inningsToOuts = (value: unknown) => {
  const [wholeRaw, fractionRaw = '0'] = String(value ?? '0').split('.');
  const whole = Number(wholeRaw) || 0;
  const fraction = Math.max(0, Math.min(2, Number(fractionRaw) || 0));
  return whole * 3 + fraction;
};

const singles = (stat: any) => Math.max(0, number(stat?.hits) - number(stat?.doubles) - number(stat?.triples) - number(stat?.homeRuns));
const reachedBase = (stat: any) => number(stat?.hits) + number(stat?.baseOnBalls) + number(stat?.hitByPitch);

const selectionScope = (selection: Selection): PickScope => {
  if (selection.scope) return selection.scope;
  if (String(selection.type).startsWith('pitcher_')) return 'pitcher';
  if (String(selection.type).startsWith('hitter_')) return 'batter';
  return 'game';
};

const hitterValue = (type: PredictionType, stat: any) => {
  if (type === 'hitter_hit') return number(stat?.hits);
  if (type === 'hitter_total_base') return number(stat?.totalBases);
  if (type === 'hitter_reach_base') return reachedBase(stat);
  if (type === 'hitter_home_run') return number(stat?.homeRuns);
  if (type === 'hitter_runs') return number(stat?.runs);
  if (type === 'hitter_rbi') return number(stat?.rbi);
  if (type === 'hitter_walks') return number(stat?.baseOnBalls);
  if (type === 'hitter_stolen_bases') return number(stat?.stolenBases);
  if (type === 'hitter_extra_base_hit') return number(stat?.doubles) + number(stat?.triples) + number(stat?.homeRuns);
  if (type === 'hitter_hrr') return number(stat?.hits) + number(stat?.runs) + number(stat?.rbi);
  if (type === 'hitter_strikeouts') return number(stat?.strikeOuts);
  return singles(stat);
};

const pitcherValue = (type: PredictionType, stat: any) => {
  if (type === 'pitcher_strikeouts') return number(stat?.strikeOuts);
  if (type === 'pitcher_innings') return inningsToOuts(stat?.inningsPitched);
  if (type === 'pitcher_hits_allowed') return number(stat?.hits);
  if (type === 'pitcher_earned_runs') return number(stat?.earnedRuns);
  if (type === 'pitcher_walks') return number(stat?.baseOnBalls);
  if (type === 'pitcher_quality_start') return inningsToOuts(stat?.inningsPitched) >= 18 && number(stat?.earnedRuns) <= 3 ? 1 : 0;
  return 0;
};

const passes = (value: number, selection: Selection) => {
  const direction = selection.direction ?? 'gte';
  if (direction === 'lte') return value <= number(selection.threshold);
  if (direction === 'eq') return value === number(selection.threshold);
  return value >= number(selection.threshold);
};

const firstScoringTeamId = (feed: any, awayId: number, homeId: number) => {
  for (const inning of feed?.liveData?.linescore?.innings ?? []) {
    if (number(inning?.away?.runs) > 0) return awayId;
    if (number(inning?.home?.runs) > 0) return homeId;
  }
  return null;
};

const settleSelections = (feed: any, card: ChallengeCard) => {
  const boxTeams = feed?.liveData?.boxscore?.teams ?? {};
  const linescore = feed?.liveData?.linescore ?? {};
  const findPlayer = (id: number) => boxTeams.away?.players?.[`ID${id}`] ?? boxTeams.home?.players?.[`ID${id}`] ?? null;
  const awayRuns = number(linescore?.teams?.away?.runs);
  const homeRuns = number(linescore?.teams?.home?.runs);
  const awayHits = number(linescore?.teams?.away?.hits);
  const homeHits = number(linescore?.teams?.home?.hits);
  const awayTeamId = number(feed?.gameData?.teams?.away?.id);
  const homeTeamId = number(feed?.gameData?.teams?.home?.id);
  const winnerId = awayRuns === homeRuns ? null : awayRuns > homeRuns ? awayTeamId : homeTeamId;
  const firstInningRuns = number(linescore?.innings?.[0]?.away?.runs) + number(linescore?.innings?.[0]?.home?.runs);
  const firstScoreId = firstScoringTeamId(feed, awayTeamId, homeTeamId);
  const extraInnings = number(linescore?.currentInning || linescore?.innings?.length) > 9 || (linescore?.innings?.length ?? 0) > 9;

  return (card.selections ?? []).map((selection) => {
    let value: number | null = null;
    let passed: boolean | null = null;
    const scope = selectionScope(selection);

    if (scope === 'batter') {
      const player = findPlayer(number(selection.subjectId));
      if (!player) return { ...selection, scope, result: 'void' as const, resultValue: null };
      value = hitterValue(selection.type, player.stats?.batting ?? {});
      passed = passes(value, selection);
    } else if (scope === 'pitcher') {
      const player = findPlayer(number(selection.subjectId));
      if (!player) return { ...selection, scope, result: 'void' as const, resultValue: null };
      value = pitcherValue(selection.type, player.stats?.pitching ?? {});
      passed = passes(value, selection);
    } else if (selection.type === 'team_winner') {
      if (!winnerId) return { ...selection, scope, result: 'void' as const, resultValue: null };
      value = winnerId;
      passed = winnerId === number(selection.teamId);
    } else if (selection.type === 'team_runs') {
      value = number(selection.teamId) === awayTeamId ? awayRuns : homeRuns;
      passed = passes(value, selection);
    } else if (selection.type === 'team_hits') {
      value = number(selection.teamId) === awayTeamId ? awayHits : homeHits;
      passed = passes(value, selection);
    } else if (selection.type === 'game_first_team_score') {
      if (!firstScoreId) return { ...selection, scope, result: 'void' as const, resultValue: null };
      value = firstScoreId;
      passed = firstScoreId === number(selection.teamId);
    } else if (selection.type === 'game_first_inning') {
      value = firstInningRuns > 0 ? 1 : 0;
      passed = value === number(selection.threshold);
    } else if (selection.type === 'game_extra_innings') {
      value = extraInnings ? 1 : 0;
      passed = value === number(selection.threshold);
    }

    return { ...selection, scope, result: passed ? 'correct' as const : 'incorrect' as const, resultValue: value };
  });
};

const dateKeyUTC = (value: string) => new Date(value).toISOString().slice(0, 10);
const monthKeyUTC = (value: string) => new Date(value).toISOString().slice(0, 7);

const weekKeyUTC = (value: string) => {
  const date = new Date(value);
  const day = date.getUTCDay();
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + (day === 0 ? -6 : 1 - day)));
  return monday.toISOString().slice(0, 10);
};

const scoreRankedCards = (cards: ChallengeCard[]) => {
  const ordered = [...cards].sort((a, b) => {
    const gameDiff = new Date(a.game_date || a.created_at).getTime() - new Date(b.game_date || b.created_at).getTime();
    return gameDiff || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const dailySeen = new Set<string>();
  const weeklyCounts = new Map<string, number>();
  const currentMonth = new Date().toISOString().slice(0, 7);

  let currentStreak = 0;
  let bestStreak = 0;
  let perfectCards = 0;
  let points = 0;
  let correctPicks = 0;
  let totalPicks = 0;
  let monthlyPoints = 0;
  let monthlyCorrect = 0;
  let monthlyTotal = 0;
  let hittingCorrect = 0;
  let hittingTotal = 0;
  let pitchingCorrect = 0;
  let pitchingTotal = 0;
  let teamCorrect = 0;
  let teamTotal = 0;

  const cardScores = new Map<string, number>();

  for (const card of ordered) {
    const settled = (card.selections ?? []).filter((selection) => selection.result === 'correct' || selection.result === 'incorrect');
    if (!settled.length) {
      cardScores.set(card.id, 0);
      continue;
    }

    let cardPoints = 0;
    const cardCorrect = settled.filter((selection) => selection.result === 'correct').length;
    cardPoints += cardCorrect * CORRECT_PICK_POINTS;
    correctPicks += cardCorrect;
    totalPicks += settled.length;

    const perfect = settled.length > 1 && cardCorrect === settled.length;
    if (perfect) {
      cardPoints += PERFECT_CARD_BONUS;
      perfectCards += 1;
    }

    for (const selection of settled) {
      const correct = selection.result === 'correct';
      const scope = selectionScope(selection);
      if (scope === 'batter') {
        hittingTotal += 1;
        if (correct) hittingCorrect += 1;
      } else if (scope === 'pitcher') {
        pitchingTotal += 1;
        if (correct) pitchingCorrect += 1;
      } else {
        teamTotal += 1;
        if (correct) teamCorrect += 1;
      }

      if (correct) {
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        if (currentStreak === 3) cardPoints += THREE_STREAK_BONUS;
        if (currentStreak === 5) cardPoints += FIVE_STREAK_BONUS;
      } else {
        currentStreak = 0;
      }
    }

    const gameDate = card.game_date || card.created_at;
    const dayKey = dateKeyUTC(gameDate);
    if (!dailySeen.has(dayKey)) {
      dailySeen.add(dayKey);
      cardPoints += DAILY_CHALLENGE_BONUS;
    }

    const weekKey = card.week_key || weekKeyUTC(gameDate);
    const weekCount = (weeklyCounts.get(weekKey) ?? 0) + 1;
    weeklyCounts.set(weekKey, weekCount);
    if (weekCount === WEEKLY_COMPLETION_CARDS) cardPoints += WEEKLY_CHALLENGE_BONUS;

    if (monthKeyUTC(gameDate) === currentMonth) {
      monthlyPoints += cardPoints;
      monthlyCorrect += cardCorrect;
      monthlyTotal += settled.length;
    }

    points += cardPoints;
    cardScores.set(card.id, cardPoints);
  }

  return {
    cardScores,
    points,
    correctPicks,
    totalPicks,
    currentStreak,
    bestStreak,
    perfectCards,
    monthlyPoints,
    monthlyCorrect,
    monthlyTotal,
    hittingCorrect,
    hittingTotal,
    pitchingCorrect,
    pitchingTotal,
    teamCorrect,
    teamTotal,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return new Response(JSON.stringify({ error: 'Supabase service credentials are missing.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const { data: cards, error } = await supabase
    .from('challenge_cards')
    .select('id,user_id,display_name,game_pk,game_date,week_key,ticket_kind,selections,created_at,settled_at,status,points')
    .eq('status', 'upcoming')
    .lte('game_date', new Date().toISOString())
    .limit(150);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const affectedUsers = new Set<string>();
  let settledCards = 0;

  for (const rawCard of cards ?? []) {
    const card = rawCard as ChallengeCard;
    const response = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${card.game_pk}/feed/live`).catch(() => null);
    if (!response?.ok) continue;
    const feed = await response.json();
    const state = feed?.gameData?.status;
    if (state?.abstractGameState !== 'Final' && state?.detailedState !== 'Final') continue;

    const selections = settleSelections(feed, card);
    const scored = selections.filter((selection) => selection.result === 'correct' || selection.result === 'incorrect');
    const correct = scored.filter((selection) => selection.result === 'correct').length;

    const { error: updateError } = await supabase.from('challenge_cards').update({
      selections,
      status: 'finished',
      settled_count: scored.length,
      correct_count: correct,
      points: 0,
      settled_at: new Date().toISOString(),
    }).eq('id', card.id);

    if (!updateError) {
      settledCards += 1;
      if (card.ticket_kind === 'ranked') affectedUsers.add(card.user_id);
    }
  }

  for (const userId of affectedUsers) {
    const { data: userCards, error: userCardsError } = await supabase
      .from('challenge_cards')
      .select('id,user_id,display_name,game_pk,game_date,week_key,ticket_kind,selections,created_at,settled_at,status,points')
      .eq('user_id', userId)
      .eq('status', 'finished')
      .eq('ticket_kind', 'ranked')
      .order('game_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (userCardsError) continue;
    const rankedCards = (userCards ?? []) as ChallengeCard[];
    const scored = scoreRankedCards(rankedCards);

    for (const card of rankedCards) {
      const nextPoints = scored.cardScores.get(card.id) ?? 0;
      if (number(card.points) !== nextPoints) {
        await supabase.from('challenge_cards').update({ points: nextPoints }).eq('id', card.id);
      }
    }

    const displayName = rankedCards.at(-1)?.display_name || 'IXMetrics User';
    await supabase.from('challenge_scores').upsert({
      user_id: userId,
      display_name: displayName,
      points: scored.points,
      correct_picks: scored.correctPicks,
      total_picks: scored.totalPicks,
      current_streak: scored.currentStreak,
      best_streak: scored.bestStreak,
      perfect_cards: scored.perfectCards,
      monthly_points: scored.monthlyPoints,
      monthly_correct_picks: scored.monthlyCorrect,
      monthly_total_picks: scored.monthlyTotal,
      hitting_correct_picks: scored.hittingCorrect,
      hitting_total_picks: scored.hittingTotal,
      pitching_correct_picks: scored.pitchingCorrect,
      pitching_total_picks: scored.pitchingTotal,
      team_correct_picks: scored.teamCorrect,
      team_total_picks: scored.teamTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  return new Response(JSON.stringify({ settledCards, updatedUsers: affectedUsers.size }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
