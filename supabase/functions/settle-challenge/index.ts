import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Selection = {
  id: string;
  type: 'hitter_hit' | 'hitter_total_base' | 'hitter_reach_base' | 'pitcher_strikeouts' | 'team_winner';
  subjectId: number;
  teamId: number;
  threshold: number;
  result?: 'pending' | 'correct' | 'incorrect' | 'void';
  resultValue?: number | null;
  [key: string]: unknown;
};

type ChallengeCard = {
  id: string;
  user_id: string;
  display_name: string;
  game_pk: number;
  ticket_kind: 'ranked' | 'extra';
  selections: Selection[];
  created_at: string;
};

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const settleSelections = (feed: any, card: ChallengeCard) => {
  const boxTeams = feed?.liveData?.boxscore?.teams ?? {};
  const findPlayer = (id: number) => boxTeams.away?.players?.[`ID${id}`] ?? boxTeams.home?.players?.[`ID${id}`] ?? null;
  const awayRuns = number(feed?.liveData?.linescore?.teams?.away?.runs);
  const homeRuns = number(feed?.liveData?.linescore?.teams?.home?.runs);
  const awayTeamId = number(feed?.gameData?.teams?.away?.id);
  const homeTeamId = number(feed?.gameData?.teams?.home?.id);
  const winnerId = awayRuns === homeRuns ? null : awayRuns > homeRuns ? awayTeamId : homeTeamId;

  return (card.selections ?? []).map((selection) => {
    let value: number | null = null;
    let passed: boolean | null = null;

    if (selection.type === 'team_winner') {
      if (!winnerId) return { ...selection, result: 'void', resultValue: null };
      value = winnerId;
      passed = number(selection.teamId) === winnerId;
    } else {
      const player = findPlayer(number(selection.subjectId));
      if (!player) return { ...selection, result: 'void', resultValue: null };
      if (selection.type === 'pitcher_strikeouts') value = number(player.stats?.pitching?.strikeOuts);
      if (selection.type === 'hitter_hit') value = number(player.stats?.batting?.hits);
      if (selection.type === 'hitter_total_base') value = number(player.stats?.batting?.totalBases);
      if (selection.type === 'hitter_reach_base') {
        value = number(player.stats?.batting?.hits) + number(player.stats?.batting?.baseOnBalls) + number(player.stats?.batting?.hitByPitch);
      }
      passed = value >= number(selection.threshold);
    }

    return { ...selection, result: passed ? 'correct' : 'incorrect', resultValue: value };
  });
};

const computeStreaks = (cards: any[]) => {
  const outcomes = cards
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .flatMap((card) => Array.isArray(card.selections) ? card.selections : [])
    .filter((selection: any) => selection.result === 'correct' || selection.result === 'incorrect');

  let running = 0;
  let best = 0;
  for (const selection of outcomes) {
    if (selection.result === 'correct') {
      running += 1;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  }

  let current = 0;
  for (const selection of [...outcomes].reverse()) {
    if (selection.result !== 'correct') break;
    current += 1;
  }
  return { current, best };
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return new Response(JSON.stringify({ error: 'Supabase service credentials are missing.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const { data: cards, error } = await supabase
    .from('challenge_cards')
    .select('id,user_id,display_name,game_pk,ticket_kind,selections,created_at')
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
    const scored = selections.filter((selection: any) => selection.result === 'correct' || selection.result === 'incorrect');
    const correct = scored.filter((selection: any) => selection.result === 'correct').length;
    const perfectBonus = scored.length > 1 && scored.every((selection: any) => selection.result === 'correct') ? 5 : 0;
    const points = card.ticket_kind === 'ranked' ? correct * 10 + perfectBonus : 0;

    const { error: updateError } = await supabase.from('challenge_cards').update({
      selections,
      status: 'finished',
      settled_count: scored.length,
      correct_count: correct,
      points,
      settled_at: new Date().toISOString(),
    }).eq('id', card.id);

    if (!updateError) {
      settledCards += 1;
      if (card.ticket_kind === 'ranked') affectedUsers.add(card.user_id);
    }
  }

  for (const userId of affectedUsers) {
    const { data: userCards } = await supabase
      .from('challenge_cards')
      .select('display_name,selections,points,created_at,ticket_kind')
      .eq('user_id', userId)
      .eq('status', 'finished')
      .eq('ticket_kind', 'ranked')
      .order('created_at', { ascending: true });

    const rankedCards = userCards ?? [];
    const selections = rankedCards.flatMap((card: any) => Array.isArray(card.selections) ? card.selections : [])
      .filter((selection: any) => selection.result === 'correct' || selection.result === 'incorrect');
    const correct = selections.filter((selection: any) => selection.result === 'correct').length;
    const total = selections.length;
    const points = rankedCards.reduce((sum: number, card: any) => sum + number(card.points), 0);
    const streaks = computeStreaks(rankedCards);
    const displayName = rankedCards.at(-1)?.display_name || 'ScoutCore User';

    await supabase.from('challenge_scores').upsert({
      user_id: userId,
      display_name: displayName,
      points,
      correct_picks: correct,
      total_picks: total,
      current_streak: streaks.current,
      best_streak: streaks.best,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  return new Response(JSON.stringify({ settledCards, updatedUsers: affectedUsers.size }), {
    headers: { 'Content-Type': 'application/json' },
  });
});