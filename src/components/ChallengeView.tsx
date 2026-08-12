import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { fetchLiveGameFeed, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { supabase } from '../services/supabaseClient';

type ChallengeTab = 'build' | 'mine' | 'leaderboard';
type MyPicksTab = 'upcoming' | 'finished' | 'statistics';
type LeaderboardTab = 'overall' | 'month' | 'hitting' | 'pitching' | 'team';
type PickScope = 'batter' | 'pitcher' | 'game';
type SubjectKind = 'hitter' | 'pitcher' | 'team' | 'game';
type Direction = 'gte' | 'lte' | 'eq';
type ResultStatus = 'pending' | 'correct' | 'incorrect' | 'void';
type TicketKind = 'ranked' | 'extra';
type AccountPlan = 'guest' | 'free' | 'premium';

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

type RosterPlayer = {
  id: number;
  name: string;
  position: string;
  teamId: number;
  teamName: string;
};

type PickSelection = {
  id: string;
  type: PredictionType;
  scope: PickScope;
  gamePk: number;
  subjectId: number;
  subjectName: string;
  teamId: number;
  teamName: string;
  threshold: number;
  direction: Direction;
  choice?: string;
  label: string;
  detail: string;
};

type AnalysisStat = { label: string; value: string };

type PickAnalysis = {
  chance: 'STRONG CHANCE' | 'MODERATE CHANCE' | 'DIFFICULT' | 'LIMITED DATA';
  score: number;
  summary: string;
  keyFactor?: string;
  stats: AnalysisStat[];
};

type SavedSelection = PickSelection & PickAnalysis & {
  result: ResultStatus;
  resultValue?: number | null;
};

type SavedCard = {
  id: string;
  userId?: string | null;
  displayName: string;
  createdAt: string;
  weekKey: string;
  ticketKind: TicketKind;
  gamePk: number;
  gameDate: string;
  awayTeam: MlbScheduleGame['awayTeam'];
  homeTeam: MlbScheduleGame['homeTeam'];
  selections: SavedSelection[];
  status: 'upcoming' | 'finished';
  correctCount: number;
  settledCount: number;
  points: number;
};

type LeaderboardRow = {
  user_id?: string;
  display_name?: string;
  points?: number;
  correct_picks?: number;
  total_picks?: number;
  current_streak?: number;
  best_streak?: number;
  monthly_points?: number;
  monthly_correct_picks?: number;
  monthly_total_picks?: number;
  hitting_correct_picks?: number;
  hitting_total_picks?: number;
  pitching_correct_picks?: number;
  pitching_total_picks?: number;
  team_correct_picks?: number;
  team_total_picks?: number;
};

type PickOption = {
  label: string;
  threshold: number;
  direction?: Direction;
  choice?: string;
};

type CategoryDef = {
  type: PredictionType;
  scope: PickScope;
  label: string;
  shortLabel: string;
  subjectKind: SubjectKind;
  options: PickOption[];
};

type TeamRecentGame = {
  won: boolean;
  teamRuns: number;
  opponentRuns: number;
  teamHits: number;
  opponentHits: number;
  firstInningRuns: number;
  teamScoredFirst: boolean | null;
  extraInnings: boolean;
};

interface ChallengeViewProps {
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
}

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const LOCAL_KEY = 'scoutcore:challenge-cards:v3';
const OLD_LOCAL_KEYS = ['scoutcore:challenge-cards:v2', 'scoutcore:challenge-cards:v1'];
const MAX_PICKS = 8;
const WEEKLY_RANKED_CARDS = 5;
const PREMIUM_EXTRA_CARDS = 10;
const MIN_LEADERBOARD_PICKS = 20;
const CORRECT_PICK_POINTS = 10;
const PERFECT_CARD_BONUS = 25;
const THREE_STREAK_BONUS = 10;
const FIVE_STREAK_BONUS = 25;
const DAILY_CHALLENGE_BONUS = 5;
const WEEKLY_CHALLENGE_BONUS = 20;

const BATTER_CATEGORIES: CategoryDef[] = [
  { type: 'hitter_hit', scope: 'batter', label: 'HITS', shortLabel: 'Hits', subjectKind: 'hitter', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_total_base', scope: 'batter', label: 'TOTAL BASES', shortLabel: 'Total Bases', subjectKind: 'hitter', options: [1, 2, 3, 4].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_reach_base', scope: 'batter', label: 'REACH BASE', shortLabel: 'Reach Base', subjectKind: 'hitter', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_home_run', scope: 'batter', label: 'HOME RUNS', shortLabel: 'Home Runs', subjectKind: 'hitter', options: [{ label: '1+ HR', threshold: 1 }] },
  { type: 'hitter_runs', scope: 'batter', label: 'RUNS SCORED', shortLabel: 'Runs', subjectKind: 'hitter', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_rbi', scope: 'batter', label: 'RBI', shortLabel: 'RBI', subjectKind: 'hitter', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_walks', scope: 'batter', label: 'WALKS', shortLabel: 'Walks', subjectKind: 'hitter', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_stolen_bases', scope: 'batter', label: 'STOLEN BASES', shortLabel: 'Stolen Bases', subjectKind: 'hitter', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_extra_base_hit', scope: 'batter', label: 'EXTRA-BASE HIT', shortLabel: 'Extra-Base Hit', subjectKind: 'hitter', options: [{ label: '1+', threshold: 1 }] },
  { type: 'hitter_hrr', scope: 'batter', label: 'HITS + RUNS + RBI', shortLabel: 'H + R + RBI', subjectKind: 'hitter', options: [2, 3, 4].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_strikeouts', scope: 'batter', label: 'BATTER STRIKEOUTS', shortLabel: 'Batter Strikeouts', subjectKind: 'hitter', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
];

const PITCHER_CATEGORIES: CategoryDef[] = [
  { type: 'pitcher_strikeouts', scope: 'pitcher', label: 'PITCHER STRIKEOUTS', shortLabel: 'Strikeouts', subjectKind: 'pitcher', options: [4, 5, 6, 7, 8].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'pitcher_innings', scope: 'pitcher', label: 'PITCHER INNINGS', shortLabel: 'Innings', subjectKind: 'pitcher', options: [5, 6].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'pitcher_hits_allowed', scope: 'pitcher', label: 'PITCHER HITS ALLOWED', shortLabel: 'Hits Allowed', subjectKind: 'pitcher', options: [4, 5, 6].map(threshold => ({ label: `${threshold} or fewer`, threshold, direction: 'lte' })) },
  { type: 'pitcher_earned_runs', scope: 'pitcher', label: 'PITCHER EARNED RUNS', shortLabel: 'Earned Runs', subjectKind: 'pitcher', options: [1, 2, 3].map(threshold => ({ label: `${threshold} or fewer`, threshold, direction: 'lte' })) },
  { type: 'pitcher_walks', scope: 'pitcher', label: 'PITCHER WALKS', shortLabel: 'Walks', subjectKind: 'pitcher', options: [1, 2, 3].map(threshold => ({ label: `${threshold} or fewer`, threshold, direction: 'lte' })) },
  { type: 'pitcher_quality_start', scope: 'pitcher', label: 'QUALITY START', shortLabel: 'Quality Start', subjectKind: 'pitcher', options: [{ label: 'Yes', threshold: 1, choice: 'yes', direction: 'eq' }, { label: 'No', threshold: 0, choice: 'no', direction: 'eq' }] },
];

const GAME_CATEGORIES: CategoryDef[] = [
  { type: 'game_first_inning', scope: 'game', label: 'FIRST INNING', shortLabel: 'First Inning', subjectKind: 'game', options: [{ label: 'Run scored', threshold: 1, choice: 'run', direction: 'eq' }, { label: 'No run scored', threshold: 0, choice: 'no_run', direction: 'eq' }] },
  { type: 'game_first_team_score', scope: 'game', label: 'FIRST TEAM TO SCORE', shortLabel: 'First Team to Score', subjectKind: 'team', options: [{ label: 'Select team', threshold: 1, direction: 'eq' }] },
  { type: 'team_runs', scope: 'game', label: 'TEAM RUNS', shortLabel: 'Team Runs', subjectKind: 'team', options: [3, 4, 5].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'team_hits', scope: 'game', label: 'TEAM HITS', shortLabel: 'Team Hits', subjectKind: 'team', options: [7, 9, 11].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'game_extra_innings', scope: 'game', label: 'EXTRA INNINGS', shortLabel: 'Extra Innings', subjectKind: 'game', options: [{ label: 'Yes', threshold: 1, choice: 'yes', direction: 'eq' }, { label: 'No', threshold: 0, choice: 'no', direction: 'eq' }] },
  { type: 'team_winner', scope: 'game', label: 'WHO WINS?', shortLabel: 'Winner', subjectKind: 'team', options: [{ label: 'Select team', threshold: 1, direction: 'eq' }] },
];

const ALL_CATEGORIES = [...BATTER_CATEGORIES, ...PITCHER_CATEGORIES, ...GAME_CATEGORIES];
const CATEGORY_BY_TYPE = Object.fromEntries(ALL_CATEGORIES.map(category => [category.type, category])) as Record<PredictionType, CategoryDef>;

const json = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
};

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const stat3 = (value: unknown) => number(value).toFixed(3).replace(/^0/, '');
const pct = (value: number) => `${Math.round(value)}%`;
const inningsToOuts = (value: unknown) => {
  const [wholeRaw, fractionRaw = '0'] = String(value ?? '0').split('.');
  const whole = Number(wholeRaw) || 0;
  const fraction = Math.max(0, Math.min(2, Number(fractionRaw) || 0));
  return whole * 3 + fraction;
};
const outsToInnings = (outs: number) => `${Math.floor(outs / 3)}.${Math.max(0, outs % 3)}`;

const gameTime = (gameDate: string) => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(gameDate));

const gameDateLabel = (gameDate: string) => new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric',
}).format(new Date(gameDate));

const weekKeyFor = (value: string | Date = new Date()) => {
  const date = new Date(value);
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay();
  local.setDate(local.getDate() + (day === 0 ? -6 : 1 - day));
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

const chanceFromScore = (score: number): PickAnalysis['chance'] => {
  if (!Number.isFinite(score) || score <= 0) return 'LIMITED DATA';
  if (score >= 70) return 'STRONG CHANCE';
  if (score >= 48) return 'MODERATE CHANCE';
  return 'DIFFICULT';
};

const chanceClass = (chance?: PickAnalysis['chance']) => {
  if (chance === 'STRONG CHANCE') return 'border-[#77e55d]/45 bg-[#77e55d]/10 text-[#9aff78]';
  if (chance === 'MODERATE CHANCE') return 'border-[#ffd34f]/45 bg-[#ffd34f]/10 text-[#ffd95f]';
  if (chance === 'DIFFICULT') return 'border-[#ff8b4f]/45 bg-[#ff8b4f]/10 text-[#ff9d69]';
  return 'border-[#526275] bg-[#526275]/10 text-[#9ba9b7]';
};

const normalizeSavedCard = (card: any): SavedCard => ({
  ...card,
  weekKey: card.weekKey || weekKeyFor(card.createdAt || new Date()),
  ticketKind: card.ticketKind === 'extra' ? 'extra' : 'ranked',
  selections: Array.isArray(card.selections) ? card.selections.map((selection: any) => ({
    scope: selection.scope || (String(selection.type || '').startsWith('pitcher_') ? 'pitcher' : String(selection.type || '').startsWith('team_') || String(selection.type || '').startsWith('game_') ? 'game' : 'batter'),
    direction: selection.direction || 'gte',
    ...selection,
    stats: Array.isArray(selection.stats) ? selection.stats : [],
  })) : [],
});

const readLocalCards = (): SavedCard[] => {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY) || OLD_LOCAL_KEYS.map(key => window.localStorage.getItem(key)).find(Boolean) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeSavedCard) : [];
  } catch {
    return [];
  }
};

const writeLocalCards = (cards: SavedCard[]) => {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(cards)); } catch {}
};

async function fetchTeamRoster(teamId: number, teamName: string): Promise<RosterPlayer[]> {
  const data = await json(`${MLB_API}/teams/${teamId}/roster?rosterType=active`);
  return (data.roster ?? [])
    .filter((entry: any) => entry?.person?.id)
    .map((entry: any) => ({
      id: Number(entry.person.id),
      name: entry.person.fullName ?? 'MLB Player',
      position: entry.position?.abbreviation ?? '',
      teamId,
      teamName,
    }));
}

async function fetchSeasonStats(playerId: number, group: 'hitting' | 'pitching') {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${playerId}/stats?stats=season&season=${season}&group=${group}`);
  return data.stats?.[0]?.splits?.[0]?.stat ?? {};
}

async function fetchRecentLogs(playerId: number, group: 'hitting' | 'pitching', limit = 10) {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=${group}`);
  return (data.stats?.[0]?.splits ?? []).slice(-limit).reverse().map((split: any) => split.stat ?? {});
}

async function fetchPlayerBio(playerId: number) {
  const data = await json(`${MLB_API}/people/${playerId}`);
  return data.people?.[0] ?? null;
}

async function fetchHitterSplits(playerId: number) {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${playerId}/stats?stats=statSplits&season=${season}&group=hitting&sitCodes=vl,vr`);
  return data.stats?.[0]?.splits ?? [];
}

async function fetchTeamSeasonStats(teamId: number, group: 'hitting' | 'pitching') {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/teams/${teamId}/stats?stats=season&season=${season}&group=${group}`);
  return data.stats?.[0]?.splits?.[0]?.stat ?? {};
}

async function fetchRecentTeamGames(teamId: number, limit = 10): Promise<TeamRecentGame[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 38);
  const key = (date: Date) => date.toISOString().slice(0, 10);
  const data = await json(`${MLB_API}/schedule?sportId=1&teamId=${teamId}&startDate=${key(start)}&endDate=${key(end)}&hydrate=linescore`);
  return (data.dates ?? [])
    .flatMap((day: any) => day.games ?? [])
    .filter((game: any) => game.status?.abstractGameState === 'Final')
    .sort((a: any, b: any) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
    .slice(0, limit)
    .map((game: any) => {
      const awayId = Number(game.teams?.away?.team?.id);
      const isAway = awayId === teamId;
      const awayRuns = number(game.teams?.away?.score ?? game.linescore?.teams?.away?.runs);
      const homeRuns = number(game.teams?.home?.score ?? game.linescore?.teams?.home?.runs);
      const awayHits = number(game.linescore?.teams?.away?.hits);
      const homeHits = number(game.linescore?.teams?.home?.hits);
      const innings = game.linescore?.innings ?? [];
      const firstInningRuns = number(innings?.[0]?.away?.runs) + number(innings?.[0]?.home?.runs);
      let firstScoringSide: 'away' | 'home' | null = null;
      for (const inning of innings) {
        if (number(inning?.away?.runs) > 0) { firstScoringSide = 'away'; break; }
        if (number(inning?.home?.runs) > 0) { firstScoringSide = 'home'; break; }
      }
      const currentInning = number(game.linescore?.currentInning || innings.length);
      return {
        won: isAway ? awayRuns > homeRuns : homeRuns > awayRuns,
        teamRuns: isAway ? awayRuns : homeRuns,
        opponentRuns: isAway ? homeRuns : awayRuns,
        teamHits: isAway ? awayHits : homeHits,
        opponentHits: isAway ? homeHits : awayHits,
        firstInningRuns,
        teamScoredFirst: firstScoringSide ? (isAway ? firstScoringSide === 'away' : firstScoringSide === 'home') : null,
        extraInnings: currentInning > 9 || innings.length > 9,
      };
    });
}

const opposingTeam = (selection: PickSelection, game: MlbScheduleGame) => selection.teamId === game.awayTeam.id ? game.homeTeam : game.awayTeam;
const opposingStarter = (selection: PickSelection, game: MlbScheduleGame) => selection.teamId === game.awayTeam.id ? game.homeProbablePitcher : game.awayProbablePitcher;

const hitterValue = (type: PredictionType, stat: any) => {
  switch (type) {
    case 'hitter_hit': return number(stat.hits);
    case 'hitter_total_base': return number(stat.totalBases);
    case 'hitter_reach_base': return number(stat.hits) + number(stat.baseOnBalls) + number(stat.hitByPitch);
    case 'hitter_home_run': return number(stat.homeRuns);
    case 'hitter_runs': return number(stat.runs);
    case 'hitter_rbi': return number(stat.rbi);
    case 'hitter_walks': return number(stat.baseOnBalls);
    case 'hitter_stolen_bases': return number(stat.stolenBases);
    case 'hitter_extra_base_hit': return number(stat.doubles) + number(stat.triples) + number(stat.homeRuns);
    case 'hitter_hrr': return number(stat.hits) + number(stat.runs) + number(stat.rbi);
    case 'hitter_strikeouts': return number(stat.strikeOuts);
    default: return 0;
  }
};

const pitcherValue = (type: PredictionType, stat: any) => {
  switch (type) {
    case 'pitcher_strikeouts': return number(stat.strikeOuts);
    case 'pitcher_innings': return inningsToOuts(stat.inningsPitched);
    case 'pitcher_hits_allowed': return number(stat.hits);
    case 'pitcher_earned_runs': return number(stat.earnedRuns);
    case 'pitcher_walks': return number(stat.baseOnBalls);
    case 'pitcher_quality_start': return inningsToOuts(stat.inningsPitched) >= 18 && number(stat.earnedRuns) <= 3 ? 1 : 0;
    default: return 0;
  }
};

const passes = (value: number, selection: PickSelection) => {
  if (selection.direction === 'lte') return value <= selection.threshold;
  if (selection.direction === 'eq') return value === selection.threshold;
  return value >= selection.threshold;
};

const optionDetail = (category: CategoryDef, option: PickOption) => {
  if (category.type === 'pitcher_quality_start') return option.choice === 'yes' ? 'Records a quality start: at least 6.0 IP and no more than 3 earned runs.' : 'Does not record a quality start.';
  if (category.type === 'game_first_inning') return option.choice === 'run' ? 'At least one run is scored in the first inning.' : 'No run is scored in the first inning.';
  if (category.type === 'game_extra_innings') return option.choice === 'yes' ? 'Game reaches the 10th inning or later.' : 'Game ends in nine innings or fewer.';
  if (category.type === 'game_first_team_score') return 'Selected team scores the first run of the game.';
  if (category.type === 'team_winner') return 'Selected team wins the game.';
  if (category.type === 'team_runs') return `Selected team scores at least ${option.threshold} runs.`;
  if (category.type === 'team_hits') return `Selected team records at least ${option.threshold} hits.`;
  if (category.type === 'pitcher_hits_allowed') return `Allows ${option.threshold} hits or fewer.`;
  if (category.type === 'pitcher_earned_runs') return `Allows ${option.threshold} earned runs or fewer.`;
  if (category.type === 'pitcher_walks') return `Allows ${option.threshold} walks or fewer.`;
  if (category.type === 'pitcher_innings') return `Records at least ${option.threshold}.0 innings pitched.`;
  if (category.type === 'hitter_extra_base_hit') return 'Records at least one double, triple, or home run.';
  return `${category.shortLabel}: ${option.label}.`;
};

function buildPick(category: CategoryDef, game: MlbScheduleGame, option: PickOption, subject?: RosterPlayer | MlbScheduleGame['awayTeam'] | null): PickSelection {
  const teamSubject = category.subjectKind === 'team' ? subject as MlbScheduleGame['awayTeam'] : null;
  const playerSubject = category.subjectKind === 'hitter' || category.subjectKind === 'pitcher' ? subject as RosterPlayer : null;
  const subjectId = playerSubject?.id ?? teamSubject?.id ?? game.gamePk;
  const subjectName = playerSubject?.name ?? teamSubject?.name ?? `${game.awayTeam.abbreviation ?? game.awayTeam.name} @ ${game.homeTeam.abbreviation ?? game.homeTeam.name}`;
  const teamId = playerSubject?.teamId ?? teamSubject?.id ?? 0;
  const teamName = playerSubject?.teamName ?? teamSubject?.name ?? 'Game';
  let selectionLabel = `${subjectName} · ${category.shortLabel} ${option.label}`;

  if (category.type === 'hitter_hit') selectionLabel = `${subjectName} · ${option.threshold}+ Hit${option.threshold === 1 ? '' : 's'}`;
  if (category.type === 'hitter_total_base') selectionLabel = `${subjectName} · ${option.threshold}+ Total Base${option.threshold === 1 ? '' : 's'}`;
  if (category.type === 'hitter_reach_base') selectionLabel = `${subjectName} · Reach Base ${option.threshold}+ Time${option.threshold === 1 ? '' : 's'}`;
  if (category.type === 'hitter_home_run') selectionLabel = `${subjectName} · 1+ Home Run`;
  if (category.type === 'hitter_runs') selectionLabel = `${subjectName} · ${option.threshold}+ Run${option.threshold === 1 ? '' : 's'}`;
  if (category.type === 'hitter_rbi') selectionLabel = `${subjectName} · ${option.threshold}+ RBI`;
  if (category.type === 'hitter_walks') selectionLabel = `${subjectName} · ${option.threshold}+ Walk${option.threshold === 1 ? '' : 's'}`;
  if (category.type === 'hitter_stolen_bases') selectionLabel = `${subjectName} · ${option.threshold}+ Stolen Base${option.threshold === 1 ? '' : 's'}`;
  if (category.type === 'hitter_extra_base_hit') selectionLabel = `${subjectName} · 1+ Extra-Base Hit`;
  if (category.type === 'hitter_hrr') selectionLabel = `${subjectName} · ${option.threshold}+ Hits + Runs + RBI`;
  if (category.type === 'hitter_strikeouts') selectionLabel = `${subjectName} · ${option.threshold}+ Batter Strikeout${option.threshold === 1 ? '' : 's'}`;
  if (category.type === 'pitcher_strikeouts') selectionLabel = `${subjectName} · ${option.threshold}+ Strikeouts`;
  if (category.type === 'pitcher_innings') selectionLabel = `${subjectName} · ${option.threshold}+ Innings`;
  if (category.type === 'pitcher_hits_allowed') selectionLabel = `${subjectName} · ${option.threshold} or Fewer Hits Allowed`;
  if (category.type === 'pitcher_earned_runs') selectionLabel = `${subjectName} · ${option.threshold} or Fewer Earned Runs`;
  if (category.type === 'pitcher_walks') selectionLabel = `${subjectName} · ${option.threshold} or Fewer Walks`;
  if (category.type === 'pitcher_quality_start') selectionLabel = `${subjectName} · Quality Start: ${option.choice === 'yes' ? 'Yes' : 'No'}`;
  if (category.type === 'game_first_inning') selectionLabel = `First Inning · ${option.choice === 'run' ? 'Run Scored' : 'No Run Scored'}`;
  if (category.type === 'game_first_team_score') selectionLabel = `${subjectName} · First Team to Score`;
  if (category.type === 'team_runs') selectionLabel = `${subjectName} · ${option.threshold}+ Team Runs`;
  if (category.type === 'team_hits') selectionLabel = `${subjectName} · ${option.threshold}+ Team Hits`;
  if (category.type === 'game_extra_innings') selectionLabel = `Extra Innings · ${option.choice === 'yes' ? 'Yes' : 'No'}`;
  if (category.type === 'team_winner') selectionLabel = `${subjectName} · Win`;

  return {
    id: `${game.gamePk}-${category.type}-${subjectId}-${option.threshold}-${option.choice ?? ''}`,
    type: category.type,
    scope: category.scope,
    gamePk: game.gamePk,
    subjectId,
    subjectName,
    teamId,
    teamName,
    threshold: option.threshold,
    direction: option.direction ?? 'gte',
    choice: option.choice,
    label: selectionLabel,
    detail: optionDetail(category, option),
  };
}

function recentFormText(values: number[], selection: PickSelection) {
  let streak = 0;
  for (const value of values) {
    if (passes(value, selection)) streak += 1;
    else break;
  }
  return streak >= 2 ? `${streak}-game streak` : 'Mixed recent form';
}

async function analyzeHitterSelection(selection: PickSelection, game: MlbScheduleGame): Promise<PickAnalysis> {
  const opponentStarter = opposingStarter(selection, game);
  const [season, recent, starterSeason, starterBio, splits] = await Promise.all([
    fetchSeasonStats(selection.subjectId, 'hitting').catch(() => ({})),
    fetchRecentLogs(selection.subjectId, 'hitting', 10).catch(() => []),
    opponentStarter?.id ? fetchSeasonStats(opponentStarter.id, 'pitching').catch(() => ({})) : Promise.resolve({}),
    opponentStarter?.id ? fetchPlayerBio(opponentStarter.id).catch(() => null) : Promise.resolve(null),
    fetchHitterSplits(selection.subjectId).catch(() => []),
  ]);
  if (!recent.length && !Object.keys(season).length) return { chance: 'LIMITED DATA', score: 0, summary: 'ScoutCore does not have enough verified hitter data for this selection yet.', stats: [] };

  const values = recent.map((stat: any) => hitterValue(selection.type, stat));
  const successes = values.filter(value => passes(value, selection)).length;
  const recentRate = recent.length ? successes / recent.length : .5;
  const avg = number(season.avg);
  const obp = number(season.obp);
  const slg = number(season.slg);
  const ops = number(season.ops);
  const pa = number(season.plateAppearances);
  const strikeOutRate = pa ? number(season.strikeOuts) / pa : 0;
  const starterWhip = number(starterSeason.whip);
  const starterEra = number(starterSeason.era);
  const hand = starterBio?.pitchHand?.code ?? null;
  const matchingSplit = splits.find((split: any) => {
    const code = String(split?.split?.code ?? split?.split?.description ?? '').toLowerCase();
    return hand === 'R' ? code.includes('vr') || code.includes('right') : hand === 'L' ? code.includes('vl') || code.includes('left') : false;
  });
  const splitAvg = number(matchingSplit?.stat?.avg);

  let seasonSignal = clamp((avg * 120 + obp * 90 + slg * 70 + ops * 45) / 3.25, 20, 85);
  if (selection.type === 'hitter_home_run' || selection.type === 'hitter_extra_base_hit') seasonSignal = clamp((slg * 140) + Math.max(0, slg - avg) * 170, 15, 85);
  if (selection.type === 'hitter_stolen_bases') seasonSignal = clamp(number(season.stolenBases) * 2.6, 10, 82);
  if (selection.type === 'hitter_strikeouts') seasonSignal = clamp(strikeOutRate * 220, 10, 85);
  const starterSignal = starterWhip ? clamp(50 + (starterWhip - 1.25) * 28 + (starterEra - 4) * 4, 25, 78) : 50;
  const thresholdPenalty = Math.max(0, selection.threshold - 1) * 5;
  const score = clamp(recentRate * 66 + seasonSignal * .22 + starterSignal * .12 - thresholdPenalty, 5, 92);

  const stats: AnalysisStat[] = [
    { label: 'Last 10', value: `${successes}/${recent.length || 0}` },
    { label: 'Season AVG', value: avg ? stat3(avg) : '—' },
    { label: hand ? `vs ${hand}HP` : 'Handedness split', value: splitAvg ? stat3(splitAvg) : '—' },
    { label: 'Opp. starter WHIP', value: starterWhip ? starterWhip.toFixed(2) : '—' },
    { label: 'Season OPS', value: ops ? stat3(ops) : '—' },
    { label: 'Recent form', value: recentFormText(values, selection) },
  ];

  const category = CATEGORY_BY_TYPE[selection.type];
  return {
    chance: chanceFromScore(score),
    score: Math.round(score),
    summary: `${selection.subjectName} cleared this ${category.shortLabel.toLowerCase()} line in ${successes} of the last ${recent.length || 'available'} tracked games. ScoutCore combines recent results with season production and verified opposing-starter context when available.`,
    keyFactor: starterWhip ? `Opposing starter ${opponentStarter?.name ?? ''} carries a ${starterWhip.toFixed(2)} WHIP.` : 'Recent form is the strongest verified signal currently available for this selection.',
    stats,
  };
}

async function analyzePitcherSelection(selection: PickSelection, game: MlbScheduleGame): Promise<PickAnalysis> {
  const opponent = opposingTeam(selection, game);
  const [season, recent, opponentHitting] = await Promise.all([
    fetchSeasonStats(selection.subjectId, 'pitching').catch(() => ({})),
    fetchRecentLogs(selection.subjectId, 'pitching', 10).catch(() => []),
    opponent?.id ? fetchTeamSeasonStats(opponent.id, 'hitting').catch(() => ({})) : Promise.resolve({}),
  ]);
  if (!recent.length && !Object.keys(season).length) return { chance: 'LIMITED DATA', score: 0, summary: 'ScoutCore does not have enough verified pitcher data for this selection yet.', stats: [] };

  const values = recent.map((stat: any) => pitcherValue(selection.type, stat));
  const successes = values.filter(value => passes(value, selection)).length;
  const recentRate = recent.length ? successes / recent.length : .5;
  const k9 = number(season.strikeoutsPer9Inn);
  const era = number(season.era);
  const whip = number(season.whip);
  const bb9 = number(season.walksPer9Inn);
  const avgOuts = recent.length ? recent.reduce((sum: number, stat: any) => sum + inningsToOuts(stat.inningsPitched), 0) / recent.length : 0;
  const oppPa = number(opponentHitting.plateAppearances);
  const oppKRate = oppPa ? number(opponentHitting.strikeOuts) / oppPa : 0;

  let seasonSignal = 55;
  if (selection.type === 'pitcher_strikeouts') seasonSignal = clamp(k9 * 7.2, 20, 85);
  if (selection.type === 'pitcher_innings') seasonSignal = clamp((avgOuts / 18) * 68, 20, 82);
  if (selection.type === 'pitcher_hits_allowed') seasonSignal = clamp(78 - (whip - 1) * 42, 18, 82);
  if (selection.type === 'pitcher_earned_runs') seasonSignal = clamp(80 - era * 8, 18, 82);
  if (selection.type === 'pitcher_walks') seasonSignal = clamp(78 - bb9 * 10, 18, 82);
  if (selection.type === 'pitcher_quality_start') seasonSignal = clamp(78 - era * 5 + (avgOuts - 15) * 2.5, 18, 84);
  const opponentSignal = selection.type === 'pitcher_strikeouts' && oppKRate ? clamp(oppKRate * 260, 25, 82) : 50;
  const score = clamp(recentRate * 67 + seasonSignal * .22 + opponentSignal * .11, 5, 92);

  const stats: AnalysisStat[] = [
    { label: 'Last 10', value: `${successes}/${recent.length || 0}` },
    { label: 'K/9', value: k9 ? k9.toFixed(1) : '—' },
    { label: 'Opponent K rate', value: oppKRate ? pct(oppKRate * 100) : '—' },
    { label: 'Recent workload', value: avgOuts ? `${outsToInnings(Math.round(avgOuts))} IP avg` : '—' },
    { label: 'WHIP', value: whip ? whip.toFixed(2) : '—' },
    { label: 'ERA', value: era ? era.toFixed(2) : '—' },
  ];

  const category = CATEGORY_BY_TYPE[selection.type];
  return {
    chance: chanceFromScore(score),
    score: Math.round(score),
    summary: `${selection.subjectName} cleared this ${category.shortLabel.toLowerCase()} line in ${successes} of the last ${recent.length || 'available'} tracked pitching appearances. ScoutCore adjusts the recent trend with workload and opponent context where verified.`,
    keyFactor: selection.type === 'pitcher_strikeouts' && oppKRate ? `${opponent.name} hitters have a ${pct(oppKRate * 100)} strikeout rate in the verified season team line.` : 'Recent workload and run-prevention form are the strongest verified signals for this pick.',
    stats,
  };
}

async function analyzeGameSelection(selection: PickSelection, game: MlbScheduleGame): Promise<PickAnalysis> {
  const away = game.awayTeam;
  const home = game.homeTeam;
  const selectedTeam = selection.teamId ? (selection.teamId === away.id ? away : home) : null;
  const opponent = selectedTeam ? (selectedTeam.id === away.id ? home : away) : null;
  const opponentStarter = selectedTeam ? (selectedTeam.id === away.id ? game.homeProbablePitcher : game.awayProbablePitcher) : null;

  const [selectedRecent, awayRecent, homeRecent, selectedHitting, opponentPitching, starterStats] = await Promise.all([
    selectedTeam ? fetchRecentTeamGames(selectedTeam.id, 10).catch(() => []) : Promise.resolve([]),
    fetchRecentTeamGames(away.id, 8).catch(() => []),
    fetchRecentTeamGames(home.id, 8).catch(() => []),
    selectedTeam ? fetchTeamSeasonStats(selectedTeam.id, 'hitting').catch(() => ({})) : Promise.resolve({}),
    opponent ? fetchTeamSeasonStats(opponent.id, 'pitching').catch(() => ({})) : Promise.resolve({}),
    opponentStarter?.id ? fetchSeasonStats(opponentStarter.id, 'pitching').catch(() => ({})) : Promise.resolve({}),
  ]);

  let successes = 0;
  let total = 0;
  let score = 50;
  let summary = '';
  let keyFactor = '';
  const stats: AnalysisStat[] = [];

  if (selection.type === 'team_runs' || selection.type === 'team_hits' || selection.type === 'team_winner' || selection.type === 'game_first_team_score') {
    total = selectedRecent.length;
    successes = selectedRecent.filter(item => {
      if (selection.type === 'team_runs') return item.teamRuns >= selection.threshold;
      if (selection.type === 'team_hits') return item.teamHits >= selection.threshold;
      if (selection.type === 'team_winner') return item.won;
      return item.teamScoredFirst === true;
    }).length;
    const recentRate = total ? successes / total : .5;
    const avgRuns = total ? (selectedRecent as TeamRecentGame[]).reduce((sum, item) => sum + item.teamRuns, 0) / total : 0;
    const avgHits = total ? (selectedRecent as TeamRecentGame[]).reduce((sum, item) => sum + item.teamHits, 0) / total : 0;
    const starterEra = number(starterStats.era);
    const starterWhip = number(starterStats.whip);
    const opponentEra = number(opponentPitching.era);
    const teamOps = number(selectedHitting.ops);
    let contextSignal = 50;
    if (selection.type === 'team_runs' || selection.type === 'team_hits') contextSignal = clamp(45 + (starterEra - 4) * 5 + (starterWhip - 1.25) * 20 + (teamOps - .720) * 80, 25, 80);
    if (selection.type === 'team_winner') contextSignal = clamp(50 + (opponentEra - 4) * 4 + (avgRuns - 4.2) * 5, 25, 78);
    if (selection.type === 'game_first_team_score') contextSignal = clamp(45 + (avgRuns - 4) * 5 + (starterEra - 4) * 3, 25, 78);
    score = clamp(recentRate * 70 + contextSignal * .30, 5, 92);
    summary = `${selectedTeam?.name ?? 'The selected team'} cleared this line in ${successes} of its last ${total || 'available'} completed games. ScoutCore also checks recent scoring plus verified starter and team context where available.`;
    keyFactor = starterEra ? `Opposing starter ${opponentStarter?.name ?? ''} has a ${starterEra.toFixed(2)} ERA and ${starterWhip ? `${starterWhip.toFixed(2)} WHIP` : 'verified season line'}.` : 'Recent team results are the strongest verified signal currently available.';
    stats.push(
      { label: 'Last 10', value: `${successes}/${total || 0}` },
      { label: 'Recent runs', value: avgRuns ? `${avgRuns.toFixed(1)} R/G` : '—' },
      { label: 'Recent hits', value: avgHits ? `${avgHits.toFixed(1)} H/G` : '—' },
      { label: 'Opp. starter ERA', value: starterEra ? starterEra.toFixed(2) : '—' },
      { label: 'Opp. staff ERA', value: opponentEra ? opponentEra.toFixed(2) : '—' },
      { label: 'Team OPS', value: teamOps ? stat3(teamOps) : '—' },
    );
  } else if (selection.type === 'game_first_inning') {
    const combined = [...awayRecent, ...homeRecent];
    total = combined.length;
    successes = combined.filter(item => selection.choice === 'run' ? item.firstInningRuns > 0 : item.firstInningRuns === 0).length;
    const rate = total ? successes / total : .5;
    score = clamp(rate * 82 + 9, 5, 92);
    summary = `Across the recent completed-game samples for both clubs, this first-inning outcome occurred in ${successes} of ${total || 'available'} tracked games.`;
    keyFactor = 'ScoutCore uses verified first-inning scoring history rather than a generic full-game scoring rate.';
    stats.push(
      { label: 'Recent sample', value: `${successes}/${total || 0}` },
      { label: `${away.abbreviation ?? away.name} sample`, value: `${awayRecent.filter(item => selection.choice === 'run' ? item.firstInningRuns > 0 : item.firstInningRuns === 0).length}/${awayRecent.length}` },
      { label: `${home.abbreviation ?? home.name} sample`, value: `${homeRecent.filter(item => selection.choice === 'run' ? item.firstInningRuns > 0 : item.firstInningRuns === 0).length}/${homeRecent.length}` },
    );
  } else if (selection.type === 'game_extra_innings') {
    const combined = [...awayRecent, ...homeRecent];
    total = combined.length;
    successes = combined.filter(item => selection.choice === 'yes' ? item.extraInnings : !item.extraInnings).length;
    const rate = total ? successes / total : .5;
    score = clamp(rate * 86 + 7, 5, 94);
    summary = `This extra-innings outcome occurred in ${successes} of ${total || 'available'} recent completed-game samples across the two teams.`;
    keyFactor = 'Extra innings are evaluated from actual game length in verified recent results.';
    stats.push(
      { label: 'Recent sample', value: `${successes}/${total || 0}` },
      { label: 'Away extra-inning games', value: `${awayRecent.filter(item => item.extraInnings).length}/${awayRecent.length}` },
      { label: 'Home extra-inning games', value: `${homeRecent.filter(item => item.extraInnings).length}/${homeRecent.length}` },
    );
  }

  return { chance: chanceFromScore(score), score: Math.round(score), summary, keyFactor, stats };
}

async function analyzeSelection(selection: PickSelection, game: MlbScheduleGame): Promise<PickAnalysis> {
  if (selection.scope === 'batter') return analyzeHitterSelection(selection, game);
  if (selection.scope === 'pitcher') return analyzePitcherSelection(selection, game);
  return analyzeGameSelection(selection, game);
}

function firstScoringTeamId(feed: any, awayId: number, homeId: number) {
  for (const inning of feed?.liveData?.linescore?.innings ?? []) {
    if (number(inning?.away?.runs) > 0) return awayId;
    if (number(inning?.home?.runs) > 0) return homeId;
  }
  return null;
}

async function settleCard(card: SavedCard): Promise<SavedCard> {
  if (card.status === 'finished') return card;
  const feed = await fetchLiveGameFeed(card.gamePk).catch(() => null);
  const status = feed?.gameData?.status;
  if (!feed || (status?.abstractGameState !== 'Final' && status?.detailedState !== 'Final')) return card;

  const boxTeams = feed?.liveData?.boxscore?.teams ?? {};
  const linescore = feed?.liveData?.linescore ?? {};
  const awayRuns = number(linescore?.teams?.away?.runs);
  const homeRuns = number(linescore?.teams?.home?.runs);
  const awayHits = number(linescore?.teams?.away?.hits);
  const homeHits = number(linescore?.teams?.home?.hits);
  const winnerId = awayRuns === homeRuns ? null : awayRuns > homeRuns ? card.awayTeam.id : card.homeTeam.id;
  const firstInningRuns = number(linescore?.innings?.[0]?.away?.runs) + number(linescore?.innings?.[0]?.home?.runs);
  const firstScoreId = firstScoringTeamId(feed, card.awayTeam.id, card.homeTeam.id);
  const extraInnings = number(linescore?.currentInning || linescore?.innings?.length) > 9 || (linescore?.innings?.length ?? 0) > 9;
  const findPlayer = (id: number) => boxTeams.away?.players?.[`ID${id}`] ?? boxTeams.home?.players?.[`ID${id}`] ?? null;

  const selections = card.selections.map(selection => {
    let value: number | null = null;
    let passed: boolean | null = null;

    if (selection.scope === 'batter') {
      const player = findPlayer(selection.subjectId);
      if (!player) return { ...selection, result: 'void' as ResultStatus, resultValue: null };
      value = hitterValue(selection.type, player.stats?.batting ?? {});
      passed = passes(value, selection);
    } else if (selection.scope === 'pitcher') {
      const player = findPlayer(selection.subjectId);
      if (!player) return { ...selection, result: 'void' as ResultStatus, resultValue: null };
      value = pitcherValue(selection.type, player.stats?.pitching ?? {});
      passed = passes(value, selection);
    } else if (selection.type === 'team_winner') {
      if (!winnerId) return { ...selection, result: 'void' as ResultStatus, resultValue: null };
      value = winnerId;
      passed = winnerId === selection.teamId;
    } else if (selection.type === 'team_runs') {
      value = selection.teamId === card.awayTeam.id ? awayRuns : homeRuns;
      passed = value >= selection.threshold;
    } else if (selection.type === 'team_hits') {
      value = selection.teamId === card.awayTeam.id ? awayHits : homeHits;
      passed = value >= selection.threshold;
    } else if (selection.type === 'game_first_team_score') {
      if (!firstScoreId) return { ...selection, result: 'void' as ResultStatus, resultValue: null };
      value = firstScoreId;
      passed = firstScoreId === selection.teamId;
    } else if (selection.type === 'game_first_inning') {
      value = firstInningRuns > 0 ? 1 : 0;
      passed = value === selection.threshold;
    } else if (selection.type === 'game_extra_innings') {
      value = extraInnings ? 1 : 0;
      passed = value === selection.threshold;
    }

    return { ...selection, result: passed ? 'correct' as ResultStatus : 'incorrect' as ResultStatus, resultValue: value };
  });

  const settled = selections.filter(selection => selection.result === 'correct' || selection.result === 'incorrect');
  const correctCount = settled.filter(selection => selection.result === 'correct').length;
  const perfectBonus = settled.length > 1 && settled.every(selection => selection.result === 'correct') ? PERFECT_CARD_BONUS : 0;
  return {
    ...card,
    status: 'finished',
    selections,
    correctCount,
    settledCount: settled.length,
    points: card.ticketKind === 'ranked' ? correctCount * CORRECT_PICK_POINTS + perfectBonus : 0,
  };
}

function applyLocalPointRules(cards: SavedCard[]) {
  const rankedFinished = cards
    .filter(card => card.status === 'finished' && card.ticketKind !== 'extra')
    .sort((a, b) => new Date(a.gameDate || a.createdAt).getTime() - new Date(b.gameDate || b.createdAt).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const dailySeen = new Set<string>();
  const weeklyCounts = new Map<string, number>();
  const pointByCard = new Map<string, number>();
  let streak = 0;

  for (const card of rankedFinished) {
    const settled = card.selections.filter(selection => selection.result === 'correct' || selection.result === 'incorrect');
    const correct = settled.filter(selection => selection.result === 'correct').length;
    let points = correct * CORRECT_PICK_POINTS;
    if (settled.length > 1 && correct === settled.length) points += PERFECT_CARD_BONUS;

    for (const selection of settled) {
      if (selection.result === 'correct') {
        streak += 1;
        if (streak === 3) points += THREE_STREAK_BONUS;
        if (streak === 5) points += FIVE_STREAK_BONUS;
      } else {
        streak = 0;
      }
    }

    const dayKey = new Date(card.gameDate || card.createdAt).toISOString().slice(0, 10);
    if (!dailySeen.has(dayKey)) {
      dailySeen.add(dayKey);
      points += DAILY_CHALLENGE_BONUS;
    }

    const weekKey = card.weekKey || weekKeyFor(card.gameDate || card.createdAt);
    const count = (weeklyCounts.get(weekKey) ?? 0) + 1;
    weeklyCounts.set(weekKey, count);
    if (count === WEEKLY_RANKED_CARDS) points += WEEKLY_CHALLENGE_BONUS;
    pointByCard.set(card.id, points);
  }

  return cards.map(card => card.ticketKind === 'extra' ? { ...card, points: 0 } : pointByCard.has(card.id) ? { ...card, points: pointByCard.get(card.id) ?? card.points } : card);
}

function cardStats(cards: SavedCard[], filter?: (selection: SavedSelection) => boolean) {
  const settled = cards.flatMap(card => card.selections).filter(selection => (selection.result === 'correct' || selection.result === 'incorrect') && (!filter || filter(selection)));
  const correct = settled.filter(selection => selection.result === 'correct').length;
  const total = settled.length;
  return { correct, total, accuracy: total ? Math.round((correct / total) * 100) : 0 };
}

const leaderboardMetric = (row: LeaderboardRow, tab: LeaderboardTab) => {
  if (tab === 'month') return { correct: number(row.monthly_correct_picks), total: number(row.monthly_total_picks), points: number(row.monthly_points) };
  if (tab === 'hitting') return { correct: number(row.hitting_correct_picks), total: number(row.hitting_total_picks), points: number(row.points) };
  if (tab === 'pitching') return { correct: number(row.pitching_correct_picks), total: number(row.pitching_total_picks), points: number(row.points) };
  if (tab === 'team') return { correct: number(row.team_correct_picks), total: number(row.team_total_picks), points: number(row.points) };
  return { correct: number(row.correct_picks), total: number(row.total_picks), points: number(row.points) };
};

const TeamMini = ({ team }: { team: MlbScheduleGame['awayTeam'] }) => <div className="min-w-0 flex items-center gap-2"><div className="h-9 w-9 shrink-0 rounded-lg bg-[#e7ebf0] p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-full w-full object-contain"/></div><span className="truncate text-sm font-bold text-white">{team.abbreviation ?? team.name}</span></div>;

export const ChallengeView: React.FC<ChallengeViewProps> = ({ signedIn, userEmail, onOpenAuth }) => {
  const [tab, setTab] = useState<ChallengeTab>('build');
  const [myTab, setMyTab] = useState<MyPicksTab>('upcoming');
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('overall');
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [openCategory, setOpenCategory] = useState<PredictionType | null>('hitter_hit');
  const [subjectChoice, setSubjectChoice] = useState<Partial<Record<PredictionType, number>>>({});
  const [selectedPicks, setSelectedPicks] = useState<PickSelection[]>([]);
  const [analysis, setAnalysis] = useState<Record<string, PickAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>(() => readLocalCards());
  const [refreshingResults, setRefreshingResults] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [displayName, setDisplayName] = useState('ScoutCore User');
  const [userId, setUserId] = useState<string | null>(null);
  const [favoriteTeamId, setFavoriteTeamId] = useState<number | null>(null);
  const [plan, setPlan] = useState<AccountPlan>(signedIn ? 'free' : 'guest');
  const [message, setMessage] = useState<string | null>(null);

  const selectedGame = useMemo(() => games.find(game => game.gamePk === selectedGamePk) ?? null, [games, selectedGamePk]);
  const hitters = useMemo(() => [...awayRoster, ...homeRoster].filter(player => player.position !== 'P'), [awayRoster, homeRoster]);
  const pitchers = useMemo(() => {
    if (!selectedGame) return [];
    const probable = [
      selectedGame.awayProbablePitcher ? { id: selectedGame.awayProbablePitcher.id, name: selectedGame.awayProbablePitcher.name, position: 'P', teamId: selectedGame.awayTeam.id, teamName: selectedGame.awayTeam.name } : null,
      selectedGame.homeProbablePitcher ? { id: selectedGame.homeProbablePitcher.id, name: selectedGame.homeProbablePitcher.name, position: 'P', teamId: selectedGame.homeTeam.id, teamName: selectedGame.homeTeam.name } : null,
    ].filter(Boolean) as RosterPlayer[];
    const rosterPitchers = [...awayRoster, ...homeRoster].filter(player => player.position === 'P');
    return [...probable, ...rosterPitchers.filter(player => !probable.some(p => p.id === player.id))];
  }, [selectedGame, awayRoster, homeRoster]);

  const currentWeekKey = useMemo(() => weekKeyFor(new Date()), []);
  const cardsThisWeek = useMemo(() => cards.filter(card => (card.weekKey || weekKeyFor(card.createdAt)) === currentWeekKey), [cards, currentWeekKey]);
  const rankedUsed = cardsThisWeek.filter(card => card.ticketKind !== 'extra').length;
  const extraUsed = cardsThisWeek.filter(card => card.ticketKind === 'extra').length;
  const rankedRemaining = signedIn ? Math.max(0, WEEKLY_RANKED_CARDS - rankedUsed) : 0;
  const extraRemaining = plan === 'premium' ? Math.max(0, PREMIUM_EXTRA_CARDS - extraUsed) : 0;
  const nextTicketKind: TicketKind | null = rankedRemaining > 0 ? 'ranked' : extraRemaining > 0 ? 'extra' : null;
  const analysisReady = selectedPicks.length > 0 && selectedPicks.every(pick => Boolean(analysis[pick.id]));
  const gameStarted = selectedGame ? new Date(selectedGame.gameDate).getTime() <= Date.now() : false;

  const strengthSummary = useMemo(() => {
    if (!analysisReady) return null;
    const values = selectedPicks.map(pick => analysis[pick.id]).filter(Boolean);
    const strong = values.filter(item => item.chance === 'STRONG CHANCE').length;
    const moderate = values.filter(item => item.chance === 'MODERATE CHANCE').length;
    const difficult = values.filter(item => item.chance === 'DIFFICULT').length;
    const limited = values.filter(item => item.chance === 'LIMITED DATA').length;
    const label = strong >= Math.ceil(values.length / 2) ? 'Strong' : difficult + limited > values.length / 2 ? 'Difficult' : 'Moderate';
    return { strong, moderate, difficult, limited, label };
  }, [analysisReady, selectedPicks, analysis]);

  const leaderboardRows = useMemo(() => [...leaderboard]
    .filter(row => leaderboardMetric(row, leaderboardTab).total >= MIN_LEADERBOARD_PICKS)
    .sort((a, b) => {
      const aMetric = leaderboardMetric(a, leaderboardTab);
      const bMetric = leaderboardMetric(b, leaderboardTab);
      const aAccuracy = aMetric.total ? aMetric.correct / aMetric.total : 0;
      const bAccuracy = bMetric.total ? bMetric.correct / bMetric.total : 0;
      return bAccuracy - aAccuracy
        || bMetric.correct - aMetric.correct
        || number(b.current_streak) - number(a.current_streak)
        || bMetric.points - aMetric.points;
    }), [leaderboard, leaderboardTab]);

  useEffect(() => {
    fetchSchedule().then(list => {
      setGames(list);
      setSelectedGamePk(current => current ?? list[0]?.gamePk ?? null);
    }).catch(() => setGames([]));
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setPlan('guest');
      setUserId(null);
      return;
    }
    if (!supabase) {
      setPlan('free');
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setUserId(user.id);
      const metadata = user.user_metadata ?? {};
      setDisplayName(metadata.display_name || metadata.full_name || user.email?.split('@')[0] || 'ScoutCore User');
      setFavoriteTeamId(Number(metadata.favorite_team?.id) || null);
      setPlan(metadata.plan === 'premium' || metadata.subscription_tier === 'premium' || metadata.is_premium === true ? 'premium' : 'free');
    });
  }, [signedIn, userEmail]);

  useEffect(() => {
    if (!selectedGame) return;
    setRosterLoading(true);
    setSelectedPicks([]);
    setAnalysis({});
    setSubjectChoice({});
    setOpenCategory('hitter_hit');
    Promise.all([
      fetchTeamRoster(selectedGame.awayTeam.id, selectedGame.awayTeam.name).catch(() => []),
      fetchTeamRoster(selectedGame.homeTeam.id, selectedGame.homeTeam.name).catch(() => []),
    ]).then(([away, home]) => {
      setAwayRoster(away);
      setHomeRoster(home);
    }).finally(() => setRosterLoading(false));
  }, [selectedGamePk]);

  useEffect(() => {
    if (!supabase || !signedIn || tab !== 'leaderboard') return;
    supabase.from('challenge_scores')
      .select('*')
      .limit(1000)
      .then(({ data }) => setLeaderboard((data ?? []) as LeaderboardRow[]));
  }, [signedIn, tab]);

  const orderedGames = useMemo(() => [...games].sort((a, b) => {
    const aFav = favoriteTeamId && (a.awayTeam.id === favoriteTeamId || a.homeTeam.id === favoriteTeamId);
    const bFav = favoriteTeamId && (b.awayTeam.id === favoriteTeamId || b.homeTeam.id === favoriteTeamId);
    if (Boolean(aFav) !== Boolean(bFav)) return aFav ? -1 : 1;
    return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
  }), [games, favoriteTeamId]);

  const togglePick = (pick: PickSelection) => {
    if (!signedIn) { onOpenAuth(); return; }
    setMessage(null);
    const active = selectedPicks.some(item => item.id === pick.id);
    let next: PickSelection[];
    if (active) {
      next = selectedPicks.filter(item => item.id !== pick.id);
    } else {
      const exclusiveType = pick.type === 'team_winner' || pick.type === 'game_first_team_score' || pick.type === 'game_first_inning' || pick.type === 'game_extra_innings';
      const withoutSameLine = selectedPicks.filter(item => exclusiveType ? item.type !== pick.type : !(item.type === pick.type && item.subjectId === pick.subjectId));
      if (withoutSameLine.length >= MAX_PICKS) {
        setMessage(`Choose up to ${MAX_PICKS} Challenge selections on one card.`);
        return;
      }
      next = [...withoutSameLine, pick];
    }
    setSelectedPicks(next);
    setAnalysis(current => Object.fromEntries(Object.entries(current).filter(([id]) => next.some(item => item.id === id))));
  };

  const analyzeAll = async () => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!selectedGame || !selectedPicks.length) return;
    setAnalyzing(true);
    setMessage(null);
    const entries = await Promise.all(selectedPicks.map(async pick => [pick.id, await analyzeSelection(pick, selectedGame).catch(() => ({ chance: 'LIMITED DATA' as const, score: 0, summary: 'ScoutCore could not load enough verified data for this selection right now.', keyFactor: 'Try again when more verified MLB data is available.', stats: [] }))] as const));
    setAnalysis(Object.fromEntries(entries));
    setAnalyzing(false);
    window.setTimeout(() => document.getElementById('challenge-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const lockPrediction = async () => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!selectedGame || !selectedPicks.length) return;
    if (gameStarted) { setMessage('This game has already started, so new Challenge selections are locked.'); return; }
    if (!analysisReady) { setMessage('Analyze every selection and review the supporting statistics before pressing GO.'); return; }
    if (!nextTicketKind) { setMessage('You have used all available Challenge cards for this week. Your ranked allowance resets Monday.'); return; }

    const card: SavedCard = {
      id: crypto.randomUUID(),
      userId,
      displayName,
      createdAt: new Date().toISOString(),
      weekKey: currentWeekKey,
      ticketKind: nextTicketKind,
      gamePk: selectedGame.gamePk,
      gameDate: selectedGame.gameDate,
      awayTeam: selectedGame.awayTeam,
      homeTeam: selectedGame.homeTeam,
      selections: selectedPicks.map(pick => ({ ...pick, ...analysis[pick.id], result: 'pending' })),
      status: 'upcoming',
      correctCount: 0,
      settledCount: 0,
      points: 0,
    };

    const next = [card, ...cards];
    setCards(next);
    writeLocalCards(next);
    if (supabase && userId) {
      try {
        await supabase.rpc('submit_challenge_card', {
          p_id: card.id,
          p_display_name: displayName,
          p_game_pk: card.gamePk,
          p_game_date: card.gameDate,
          p_away_team: card.awayTeam,
          p_home_team: card.homeTeam,
          p_selections: card.selections,
        });
      } catch {}
    }
    setMessage('Prediction locked ✓ ScoutCore saved the analysis that existed when you pressed GO.');
    setSelectedPicks([]);
    setAnalysis({});
    setTab('mine');
    setMyTab('upcoming');
  };

  const refreshResults = async () => {
    setRefreshingResults(true);
    const settled = await Promise.all(cards.map(card => settleCard(card)));
    const updated = applyLocalPointRules(settled);
    setCards(updated);
    writeLocalCards(updated);
    setRefreshingResults(false);
  };

  const upcomingCards = cards.filter(card => card.status === 'upcoming');
  const finishedCards = cards.filter(card => card.status === 'finished');
  const allStats = useMemo(() => cardStats(cards), [cards]);
  const strongStats = useMemo(() => cardStats(cards, selection => selection.chance === 'STRONG CHANCE'), [cards]);
  const batterStats = useMemo(() => cardStats(cards, selection => selection.scope === 'batter'), [cards]);
  const pitcherStats = useMemo(() => cardStats(cards, selection => selection.scope === 'pitcher'), [cards]);
  const gameStats = useMemo(() => cardStats(cards, selection => selection.scope === 'game'), [cards]);

  const subjectForCategory = (category: CategoryDef): RosterPlayer | MlbScheduleGame['awayTeam'] | null => {
    if (!selectedGame) return null;
    if (category.subjectKind === 'hitter') {
      const id = subjectChoice[category.type] ?? hitters[0]?.id;
      return hitters.find(player => player.id === id) ?? hitters[0] ?? null;
    }
    if (category.subjectKind === 'pitcher') {
      const id = subjectChoice[category.type] ?? pitchers[0]?.id;
      return pitchers.find(player => player.id === id) ?? pitchers[0] ?? null;
    }
    if (category.subjectKind === 'team') {
      const id = subjectChoice[category.type] ?? selectedGame.awayTeam.id;
      return id === selectedGame.homeTeam.id ? selectedGame.homeTeam : selectedGame.awayTeam;
    }
    return null;
  };

  const categorySelectionCount = (type: PredictionType) => selectedPicks.filter(pick => pick.type === type).length;

  return <div className="min-h-screen bg-[#07101f] text-[#dae2fd] px-3 py-4 sm:px-5 lg:px-6 pb-28">
    <div className="mx-auto max-w-[1680px] space-y-5">
      <section className="rounded-2xl border border-[#233c58] bg-[radial-gradient(circle_at_12%_0%,rgba(0,240,255,.08),transparent_30%),#0c1728] px-5 py-5">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#00f0ff]/35 bg-[#00f0ff]/8 text-[#00f0ff]"><span className="material-symbols-outlined">target</span></div>
            <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#65f2b5]">ScoutCore Challenge</p><h1 className="mt-1 text-3xl font-extrabold text-white sm:text-4xl">Build your predictions. Analyze before you lock.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#9badc2]">Select baseball milestones, review ScoutCore's pick-specific analysis and verified supporting statistics, edit anything you want, then press GO to make the card official.</p></div>
          </div>
          <FlowSteps selected={selectedPicks.length > 0} analyzed={analysisReady}/>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-[#26364d] pb-3">
        {([['build','BUILD PICKS'],['mine','MY PICKS'],['leaderboard','LEADERBOARD']] as [ChallengeTab,string][]).map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-extrabold tracking-wide ${tab === id ? 'bg-[#00e6f4] text-[#00363a]' : 'border border-[#30415c] bg-[#10192b] text-[#aebbd0] hover:border-[#00e6f4]/45 hover:text-white'}`}>{label}</button>)}
      </div>

      {tab === 'build' && !signedIn && <section className="rounded-2xl border border-[#31506f] bg-[#0f182b] p-8 text-center"><span className="material-symbols-outlined text-5xl text-[#00e6f4]">fact_check</span><h2 className="mt-4 text-2xl font-bold text-white">Log in to build a ScoutCore Challenge</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#91a0b5]">Challenge cards are predictions only—no money, no odds. Your account saves the analysis that existed when you locked each pick.</p><button onClick={onOpenAuth} className="mt-5 rounded-xl bg-[#00e6f4] px-6 py-3 text-sm font-extrabold text-[#00363a]">LOG IN</button></section>}

      {tab === 'build' && signedIn && <>
        <section className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#65f2b5]">Choose a game</p><h2 className="mt-1 text-lg font-bold text-white">Today's MLB matchups</h2></div><span className="text-xs text-[#718090]">Your favorite-team matchup is prioritized when available.</span></div>
          <div className="flex gap-3 overflow-x-auto pb-1">{orderedGames.map(game => { const active = selectedGamePk === game.gamePk; return <button key={game.gamePk} onClick={() => setSelectedGamePk(game.gamePk)} className={`min-w-[230px] rounded-xl border p-3 text-left ${active ? 'border-[#00e6f4] bg-[#00e6f4]/8' : 'border-[#2d3b52] bg-[#0b1425] hover:border-[#50647f]'}`}><div className="text-[10px] text-[#849495]">{gameDateLabel(game.gameDate)} · {gameTime(game.gameDate)}</div><div className="mt-3 flex items-center justify-between gap-2"><TeamMini team={game.awayTeam}/><span className="text-[#596879]">@</span><TeamMini team={game.homeTeam}/></div></button>; })}{!orderedGames.length && <div className="rounded-xl border border-dashed border-[#40516b] px-6 py-5 text-sm text-[#91a0b5]">No MLB games are available in the current schedule response.</div>}</div>
        </section>

        {selectedGame && <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)_380px]">
          <section className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] p-4">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-white">Build Picks</h2><p className="mt-1 text-xs text-[#849495]">Open one category, choose a player/team and line, then close it.</p></div><button onClick={() => { setSelectedPicks([]); setAnalysis({}); }} className="text-xs font-bold text-[#00e6f4]">Clear All</button></div>
            {rosterLoading ? <div className="mt-5 rounded-xl border border-dashed border-[#40516b] p-6 text-center text-sm text-[#91a0b5]">Loading active rosters…</div> : <div className="mt-4 space-y-5">
              <CategoryGroup title="BATTER PICKS" icon="sports_baseball" categories={BATTER_CATEGORIES} openCategory={openCategory} onOpen={setOpenCategory} selectedCount={categorySelectionCount} renderBody={category => <CategoryBody category={category} game={selectedGame} subject={subjectForCategory(category)} hitters={hitters} pitchers={pitchers} subjectChoice={subjectChoice[category.type]} onSubjectChange={id => setSubjectChoice(current => ({ ...current, [category.type]: id }))} selected={selectedPicks} onToggle={togglePick}/>} />
              <CategoryGroup title="PITCHER PICKS" icon="sports" categories={PITCHER_CATEGORIES} openCategory={openCategory} onOpen={setOpenCategory} selectedCount={categorySelectionCount} renderBody={category => <CategoryBody category={category} game={selectedGame} subject={subjectForCategory(category)} hitters={hitters} pitchers={pitchers} subjectChoice={subjectChoice[category.type]} onSubjectChange={id => setSubjectChoice(current => ({ ...current, [category.type]: id }))} selected={selectedPicks} onToggle={togglePick}/>} />
              <CategoryGroup title="GAME PICKS" icon="stadium" categories={GAME_CATEGORIES} openCategory={openCategory} onOpen={setOpenCategory} selectedCount={categorySelectionCount} renderBody={category => <CategoryBody category={category} game={selectedGame} subject={subjectForCategory(category)} hitters={hitters} pitchers={pitchers} subjectChoice={subjectChoice[category.type]} onSubjectChange={id => setSubjectChoice(current => ({ ...current, [category.type]: id }))} selected={selectedPicks} onToggle={togglePick}/>} />
            </div>}
          </section>

          <section id="challenge-analysis" className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-white">ScoutCore Analysis</h2><p className="mt-1 text-xs text-[#849495]">Analysis changes depending on the pick. Scores are support ratings—not guaranteed probabilities.</p></div><button onClick={analyzeAll} disabled={!selectedPicks.length || analyzing} className="rounded-xl border border-[#00e6f4]/40 bg-[#00e6f4]/8 px-4 py-2.5 text-xs font-extrabold text-[#00e6f4] disabled:opacity-35">{analyzing ? 'ANALYZING…' : analysisReady ? 'RE-ANALYZE' : 'ANALYZE PICKS'}</button></div>
            <div className="mt-4 space-y-3">{selectedPicks.length ? selectedPicks.map(pick => <AnalysisCard key={pick.id} pick={pick} analysis={analysis[pick.id]} onRemove={() => togglePick(pick)}/>) : <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-[#40516b] bg-[#0b1425] p-8 text-center"><span className="material-symbols-outlined text-5xl text-[#40516b]">analytics</span><h3 className="mt-3 font-bold text-white">Your analysis will appear here</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#849495]">Build picks on the left. ScoutCore will use different verified MLB signals for hitters, pitchers and team/game selections.</p></div>}</div>
          </section>

          <aside id="challenge-summary" className="h-fit rounded-2xl border border-[#31506f] bg-[#0b1425] p-4 xl:sticky xl:top-20">
            <h2 className="text-xl font-bold text-white">Challenge Summary</h2>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#28384f] bg-[#10192b] p-3"><TeamMini team={selectedGame.awayTeam}/><div className="text-center"><div className="text-xs font-bold text-white">@</div><div className="mt-1 text-[10px] text-[#718090]">{gameDateLabel(selectedGame.gameDate)}</div></div><TeamMini team={selectedGame.homeTeam}/></div>
            <div className="mt-4"><div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#718090]">Your challenge selections ({selectedPicks.length})</div><div className="mt-2 space-y-2">{selectedPicks.map(pick => <div key={pick.id} className="flex items-center gap-3 rounded-xl border border-[#28384f] bg-[#10192b] p-3"><SubjectIcon pick={pick}/><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-white">{pick.subjectName}</div><div className="truncate text-[10px] text-[#9badc2]">{pick.label.replace(`${pick.subjectName} · `, '')}</div></div>{analysis[pick.id] ? <div className="text-right"><div className={`rounded-lg border px-2 py-1 text-[10px] font-extrabold ${chanceClass(analysis[pick.id].chance)}`}>{analysis[pick.id].score || '—'}/100</div><div className="mt-1 text-[8px] font-bold text-[#718090]">{analysis[pick.id].chance}</div></div> : <span className="text-[9px] text-[#718090]">NOT ANALYZED</span>}</div>)}{!selectedPicks.length && <div className="rounded-xl border border-dashed border-[#40516b] p-5 text-center text-xs text-[#718090]">No selections yet.</div>}</div></div>

            {strengthSummary && <div className="mt-4 rounded-xl border border-[#ffd34f]/30 bg-[#ffd34f]/5 p-4"><div className="flex items-center gap-3"><StrengthRing strong={strengthSummary.strong} moderate={strengthSummary.moderate} difficult={strengthSummary.difficult + strengthSummary.limited}/><div><div className="font-bold text-white">Card strength: <span className="text-[#ffd95f]">{strengthSummary.label}</span></div><p className="mt-1 text-xs leading-5 text-[#aebbd0]">{strengthSummary.strong} strong · {strengthSummary.moderate} moderate · {strengthSummary.difficult} difficult{strengthSummary.limited ? ` · ${strengthSummary.limited} limited-data` : ''}. This is a summary of individual statistical support, not a combined winning probability.</p></div></div></div>}

            <div className="mt-4 rounded-xl border border-[#00e6f4]/20 bg-[#00e6f4]/5 p-3 text-xs leading-5 text-[#a9dce1]"><span className="material-symbols-outlined mr-2 align-middle text-[18px] text-[#00e6f4]">verified_user</span>Your full ScoutCore analysis is saved with the prediction at the moment you press GO.</div>
            {message && <div className="mt-3 rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/5 p-3 text-xs leading-5 text-[#b9efd8]">{message}</div>}
            <button onClick={lockPrediction} disabled={!analysisReady || !nextTicketKind || gameStarted} className="mt-4 w-full rounded-xl bg-[#22dfdf] px-4 py-3.5 text-sm font-extrabold text-[#032a2c] disabled:opacity-35">{gameStarted ? 'GAME STARTED · PICKS LOCKED' : 'GO — LOCK MY PICKS'}</button>
            <button onClick={() => document.getElementById('challenge-analysis')?.scrollIntoView({ behavior: 'smooth' })} className="mt-2 w-full rounded-xl border border-[#00e6f4]/35 px-4 py-3 text-xs font-bold text-[#d6faff]">VIEW CHALLENGE CARD</button>
            <p className="mt-3 text-center text-[10px] leading-4 text-[#718090]">Before GO, edit freely. After GO, the card is locked and appears in My Picks → Upcoming. Ranked cards remaining this week: {rankedRemaining}{plan === 'premium' ? ` · extra personal cards: ${extraRemaining}` : ''}.</p>
          </aside>
        </div>}
      </>}

      {tab === 'mine' && !signedIn && <section className="rounded-2xl border border-[#31506f] bg-[#0f182b] p-8 text-center"><h2 className="text-2xl font-bold text-white">Log in to see My Picks</h2><button onClick={onOpenAuth} className="mt-5 rounded-xl bg-[#00e6f4] px-6 py-3 text-sm font-extrabold text-[#00363a]">LOG IN</button></section>}

      {tab === 'mine' && signedIn && <section>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold text-white">My Picks</h2><p className="mt-1 text-sm text-[#91a0b5]">Compare what you predicted, what ScoutCore thought beforehand, and what actually happened.</p></div><button onClick={refreshResults} disabled={refreshingResults} className="rounded-xl border border-[#30415c] px-4 py-2.5 text-xs font-bold text-[#00e6f4] disabled:opacity-50">{refreshingResults ? 'CHECKING RESULTS…' : 'REFRESH RESULTS'}</button></div>
        <div className="mt-4 flex gap-2 overflow-x-auto">{([['upcoming','UPCOMING'],['finished','FINISHED'],['statistics','STATISTICS']] as [MyPicksTab,string][]).map(([id,label]) => <button key={id} onClick={() => setMyTab(id)} className={`rounded-xl px-4 py-2.5 text-xs font-bold ${myTab === id ? 'bg-white text-[#07101f]' : 'border border-[#30415c] bg-[#10192b] text-[#aebbd0]'}`}>{label}</button>)}</div>
        {myTab === 'upcoming' && <div className="mt-5 space-y-4">{upcomingCards.map(card => <SavedCardView key={card.id} card={card}/>)}{!upcomingCards.length && <EmptyState title="No upcoming predictions" copy="Build a Challenge card, analyze it, and press GO to lock your first prediction."/>}</div>}
        {myTab === 'finished' && <div className="mt-5 space-y-4">{finishedCards.map(card => <SavedCardView key={card.id} card={card}/>)}{!finishedCards.length && <EmptyState title="No finished Challenge cards yet" copy="Refresh results after your games finish to compare predictions with outcomes."/>}</div>}
        {myTab === 'statistics' && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><AccuracyCard title="All picks" stats={allStats}/><AccuracyCard title="When ScoutCore said Strong" stats={strongStats}/><AccuracyCard title="Batter picks" stats={batterStats}/><AccuracyCard title="Pitcher picks" stats={pitcherStats}/><AccuracyCard title="Game picks" stats={gameStats}/></div>}
      </section>}

      {tab === 'leaderboard' && <section>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#65f2b5]">ScoutCore Community</p><h2 className="mt-1 text-2xl font-bold text-white">Challenge Leaderboards</h2><p className="mt-1 max-w-3xl text-sm text-[#91a0b5]">Rank is based on prediction accuracy first, then correct picks, current streak and ScoutCore Points. A minimum of {MIN_LEADERBOARD_PICKS} completed ranked picks is required to appear.</p></div><div className="rounded-xl border border-[#00e6f4]/20 bg-[#00e6f4]/5 px-4 py-3 text-xs leading-5 text-[#9edce2]"><b className="text-[#00e6f4]">ScoutCore score</b> = analysis confidence · <b className="text-[#65f2b5]">ScoutCore Points</b> = user Challenge performance</div></div>

        <div className="mt-5 flex gap-2 overflow-x-auto">{([['overall','OVERALL'],['month','THIS MONTH'],['hitting','HITTING'],['pitching','PITCHING'],['team','TEAM PICKS']] as [LeaderboardTab,string][]).map(([id,label]) => <button key={id} onClick={() => setLeaderboardTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-extrabold ${leaderboardTab === id ? 'bg-[#00e6f4] text-[#00363a]' : 'border border-[#30415c] bg-[#10192b] text-[#aebbd0]'}`}>{label}</button>)}</div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6"><PointRule value="+10" label="Correct pick"/><PointRule value="+25" label="Perfect card"/><PointRule value="+10" label="3-pick streak"/><PointRule value="+25" label="5-pick streak"/><PointRule value="+5" label="Daily complete"/><PointRule value="+20" label="Weekly complete"/></div>
        <p className="mt-2 text-[10px] text-[#718090]">Incorrect picks never remove points; they affect accuracy only. ScoutCore Points have no cash value and cannot be bought, exchanged, transferred or withdrawn.</p>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#2d3b52] bg-[#0f182b]">
          <div className="grid min-w-[800px] grid-cols-[60px_minmax(180px,1fr)_100px_110px_120px_100px] gap-3 border-b border-[#2d3b52] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#718090]"><span>Rank</span><span>User</span><span>Accuracy</span><span>Correct Picks</span><span>Current Streak</span><span>Points</span></div>
          {leaderboardRows.length ? leaderboardRows.map((row,index) => { const metric = leaderboardMetric(row, leaderboardTab); const accuracy = metric.total ? Math.round(metric.correct / metric.total * 100) : 0; return <div key={row.user_id ?? index} className={`grid min-w-[800px] grid-cols-[60px_minmax(180px,1fr)_100px_110px_120px_100px] gap-3 border-b border-[#26364d]/70 px-4 py-4 last:border-0 ${row.user_id === userId ? 'bg-[#00e6f4]/5' : ''}`}><span className={index < 3 ? 'font-bold text-[#ffd34f]' : ''}>#{index + 1}</span><div className="min-w-0"><span className="truncate font-bold text-white">{row.display_name || 'ScoutCore User'}</span>{row.user_id === userId && <span className="ml-2 text-[9px] font-bold text-[#00e6f4]">YOU</span>}</div><span className="font-bold text-white">{accuracy}%</span><span>{metric.correct}</span><span>{number(row.current_streak)}</span><span className="font-bold text-[#65f2b5]">{metric.points}</span></div>; }) : <div className="p-8 text-center"><span className="material-symbols-outlined text-4xl text-[#40516b]">leaderboard</span><h3 className="mt-3 font-bold text-white">No eligible predictors in this view yet</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#91a0b5]">Users appear after {MIN_LEADERBOARD_PICKS} completed ranked picks in the selected category. Monthly and category leaderboards will populate when the staged Challenge stats migration is applied.</p></div>}
        </div>
      </section>}
    </div>

    {tab === 'build' && signedIn && selectedGame && <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#50f4f4]/30 bg-[linear-gradient(90deg,#18cfd2,#3ce9df)] px-4 py-3 shadow-[0_-12px_40px_rgba(0,230,244,.12)] lg:left-72"><div className="mx-auto flex max-w-[1680px] flex-col items-center justify-between gap-2 sm:flex-row"><div className="flex items-center gap-3 text-[#063438]"><span className="material-symbols-outlined rounded-full bg-white/90 p-1.5 font-bold">check</span><div><div className="text-sm font-extrabold">{selectedPicks.length} PICK{selectedPicks.length === 1 ? '' : 'S'} SELECTED</div><div className="text-[10px] font-semibold opacity-75">{analysisReady ? 'Analysis ready. Review your Challenge card before GO.' : 'Analyze your selections before locking.'}</div></div></div><button onClick={() => document.getElementById('challenge-summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} disabled={!selectedPicks.length} className="min-w-[280px] rounded-xl bg-[#071927] px-6 py-3 text-xs font-extrabold text-white disabled:opacity-50">VIEW CHALLENGE CARD <span className="ml-2">›</span></button></div></div>}
  </div>;
};

const FlowSteps = ({ selected, analyzed }: { selected: boolean; analyzed: boolean }) => {
  const steps = [
    { label: 'SELECT', copy: 'Build your picks', active: true },
    { label: 'ANALYZE', copy: 'ScoutCore runs analysis', active: selected },
    { label: 'REVIEW STATS', copy: 'Explore key data', active: analyzed },
    { label: 'GO', copy: 'Lock your picks', active: analyzed },
    { label: 'LOCKED', copy: 'Await results', active: false },
  ];
  return <div className="grid min-w-0 grid-cols-5 gap-2 2xl:min-w-[700px]">{steps.map((step,index) => <div key={step.label} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-extrabold ${step.active ? 'border-[#00e6f4] bg-[#00e6f4] text-[#03363a]' : 'border-[#40516b] bg-[#10192b] text-[#718090]'}`}>{index + 1}</div><div className={`mt-1 text-[9px] font-extrabold ${step.active ? 'text-white' : 'text-[#718090]'}`}>{step.label}</div><div className="hidden text-[8px] text-[#718090] sm:block">{step.copy}</div></div>)}</div>;
};

const CategoryGroup = ({ title, icon, categories, openCategory, onOpen, selectedCount, renderBody }: { title: string; icon: string; categories: CategoryDef[]; openCategory: PredictionType | null; onOpen: (type: PredictionType | null) => void; selectedCount: (type: PredictionType) => number; renderBody: (category: CategoryDef) => React.ReactNode }) => <div><div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#8ea1b7]"><span className="material-symbols-outlined text-[16px] text-[#00e6f4]">{icon}</span>{title}</div><div className="space-y-1.5">{categories.map(category => { const open = openCategory === category.type; const count = selectedCount(category.type); return <div key={category.type} className={`overflow-hidden rounded-lg border ${open ? 'border-[#00e6f4]/55 bg-[#00e6f4]/4' : 'border-[#28384f] bg-[#0b1425]'}`}><button onClick={() => onOpen(open ? null : category.type)} className="flex w-full items-center gap-2 px-3 py-2 text-left"><span className="flex-1 text-[11px] font-bold text-[#d4dfec]">{category.shortLabel}</span>{count > 0 && <span className="rounded-full bg-[#00e6f4] px-1.5 py-0.5 text-[8px] font-extrabold text-[#00363a]">{count}</span>}<span className="material-symbols-outlined text-[16px] text-[#718090]">{open ? 'expand_less' : 'expand_more'}</span></button>{open && <div className="border-t border-[#28384f] p-3">{renderBody(category)}</div>}</div>; })}</div></div>;

const CategoryBody = ({ category, game, subject, hitters, pitchers, subjectChoice, onSubjectChange, selected, onToggle }: { category: CategoryDef; game: MlbScheduleGame; subject: RosterPlayer | MlbScheduleGame['awayTeam'] | null; hitters: RosterPlayer[]; pitchers: RosterPlayer[]; subjectChoice?: number; onSubjectChange: (id: number) => void; selected: PickSelection[]; onToggle: (pick: PickSelection) => void }) => {
  const teams = [game.awayTeam, game.homeTeam];
  const playerList = category.subjectKind === 'hitter' ? hitters : pitchers;
  const currentSubject = subject;
  return <div>
    {(category.subjectKind === 'hitter' || category.subjectKind === 'pitcher') && <label className="block text-[9px] font-bold uppercase tracking-wider text-[#718090]">Choose {category.subjectKind === 'hitter' ? 'player' : 'pitcher'}<select value={subjectChoice ?? (currentSubject as RosterPlayer | null)?.id ?? ''} onChange={e => onSubjectChange(Number(e.target.value))} className="mt-1.5 h-9 w-full rounded-lg border border-[#30415c] bg-[#10192b] px-2 text-xs text-white outline-none focus:border-[#00e6f4]"><option value="" disabled>Select</option>{playerList.map(player => <option key={player.id} value={player.id}>{player.name} · {player.teamName}</option>)}</select></label>}
    {category.subjectKind === 'team' && <div><div className="text-[9px] font-bold uppercase tracking-wider text-[#718090]">Choose team</div><div className="mt-1.5 grid grid-cols-2 gap-2">{teams.map(team => { const active = (currentSubject as MlbScheduleGame['awayTeam'] | null)?.id === team.id; return <button key={team.id} onClick={() => onSubjectChange(team.id)} className={`rounded-lg border px-2 py-2 text-[10px] font-bold ${active ? 'border-[#00e6f4] bg-[#00e6f4]/10 text-[#d6fcff]' : 'border-[#30415c] text-[#9badc2]'}`}>{team.abbreviation ?? team.name}</button>; })}</div></div>}
    <div className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#718090]">Choose line</div><div className="mt-1.5 flex flex-wrap gap-2">{category.options.map(option => { if (!currentSubject && category.subjectKind !== 'game') return null; const pick = buildPick(category, game, option, currentSubject); const active = selected.some(item => item.id === pick.id); const label = category.subjectKind === 'team' && (category.type === 'game_first_team_score' || category.type === 'team_winner') ? ((currentSubject as MlbScheduleGame['awayTeam']).abbreviation ?? (currentSubject as MlbScheduleGame['awayTeam']).name) : option.label; return <button key={`${option.label}-${option.choice ?? ''}`} onClick={() => onToggle(pick)} className={`min-w-[70px] rounded-lg border px-3 py-2 text-[10px] font-extrabold ${active ? 'border-[#00e6f4] bg-[#00e6f4] text-[#00363a]' : 'border-[#30415c] bg-[#10192b] text-[#c4d0df] hover:border-[#00e6f4]/50'}`}>{label}</button>; })}</div>
  </div>;
};

const SubjectIcon = ({ pick }: { pick: PickSelection }) => pick.scope === 'game' && pick.teamId ? <div className="h-9 w-9 shrink-0 rounded-full bg-[#e7ebf0] p-1.5"><img src={mlbTeamLogoUrl(pick.teamId)} alt="" className="h-full w-full object-contain"/></div> : pick.scope !== 'game' ? <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#18233a]"><img src={mlbPlayerHeadshotUrl(pick.subjectId,100)} alt="" className="h-full w-full object-contain object-bottom"/></div> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#00e6f4]/25 bg-[#00e6f4]/6 text-[#00e6f4]"><span className="material-symbols-outlined text-[18px]">stadium</span></div>;

const AnalysisCard = ({ pick, analysis, onRemove }: { pick: PickSelection; analysis?: PickAnalysis; onRemove: () => void }) => <article className="rounded-xl border border-[#2d3b52] bg-[#10192b] p-4"><div className="flex items-start gap-3"><SubjectIcon pick={pick}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-bold text-white">{pick.subjectName}</div><div className="text-sm font-semibold text-[#c6d4e2]">{pick.label.replace(`${pick.subjectName} · `, '')}</div></div><div className="flex items-center gap-2">{analysis ? <><span className={`rounded-lg border px-2.5 py-1 text-[9px] font-extrabold ${chanceClass(analysis.chance)}`}>{analysis.chance}</span><span className="text-xl font-extrabold text-white">{analysis.score || '—'}<span className="text-xs text-[#718090]">/100</span></span></> : <span className="rounded-lg border border-[#30415c] px-2.5 py-1 text-[9px] font-bold text-[#849495]">READY TO ANALYZE</span>}<button onClick={onRemove} className="text-[#718090] hover:text-[#ff9da3]"><span className="material-symbols-outlined text-[18px]">close</span></button></div></div>{analysis ? <><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{analysis.stats.map(stat => <div key={stat.label} className="rounded-lg border border-[#28384f] bg-[#0b1425] px-2.5 py-2 text-center"><div className="text-[8px] uppercase tracking-wider text-[#718090]">{stat.label}</div><div className="mt-1 text-xs font-bold text-white">{stat.value}</div></div>)}</div><p className="mt-3 text-xs leading-5 text-[#aebbd0]">{analysis.summary}</p>{analysis.keyFactor && <p className="mt-2 text-[11px] leading-5 text-[#9badc2]"><b className="text-[#00e6f4]">Key Factor:</b> {analysis.keyFactor}</p>}</> : <p className="mt-3 text-xs leading-5 text-[#849495]">ScoutCore will load the statistics that matter for this specific selection after you press Analyze Picks.</p>}</div></div></article>;

const StrengthRing = ({ strong, moderate, difficult }: { strong: number; moderate: number; difficult: number }) => { const total = Math.max(1, strong + moderate + difficult); const strongDeg = strong / total * 360; const moderateDeg = moderate / total * 360; return <div className="h-14 w-14 shrink-0 rounded-full" style={{ background: `conic-gradient(#75e660 0deg ${strongDeg}deg,#ffd34f ${strongDeg}deg ${strongDeg + moderateDeg}deg,#ff8b4f ${strongDeg + moderateDeg}deg 360deg)` }}><div className="m-[7px] h-10 w-10 rounded-full bg-[#0b1425]"/></div>; };

const SavedCardView = ({ card }: { card: SavedCard }) => <div className="overflow-hidden rounded-2xl border border-[#2d3b52] bg-[#0f182b]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d3b52] px-5 py-4"><div className="flex items-center gap-3"><div className="flex -space-x-2"><div className="h-10 w-10 rounded-full bg-[#e7ebf0] p-1.5 ring-2 ring-[#0f182b]"><img src={mlbTeamLogoUrl(card.awayTeam.id)} alt="" className="h-full w-full object-contain"/></div><div className="h-10 w-10 rounded-full bg-[#e7ebf0] p-1.5 ring-2 ring-[#0f182b]"><img src={mlbTeamLogoUrl(card.homeTeam.id)} alt="" className="h-full w-full object-contain"/></div></div><div><div className="font-bold text-white">{card.awayTeam.name} @ {card.homeTeam.name}</div><div className="text-xs text-[#849495]">{gameDateLabel(card.gameDate)} · {gameTime(card.gameDate)}</div></div></div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${card.status === 'finished' ? 'border-[#65f2b5]/35 bg-[#65f2b5]/10 text-[#65f2b5]' : 'border-[#30415c] text-[#aebbd0]'}`}>{card.status.toUpperCase()}</span>{card.status === 'finished' && card.ticketKind !== 'extra' && <span className="text-sm font-bold text-[#ffd34f]">+{card.points} PTS</span>}</div></div><div className="divide-y divide-[#26364d]">{card.selections.map(selection => <div key={selection.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_150px_130px] lg:items-center"><div><div className="font-semibold text-white">{selection.label}</div><div className="mt-1 text-xs text-[#91a0b5]">ScoutCore before GO: {selection.chance} · {selection.score || '—'}/100</div><div className="mt-1 text-[11px] text-[#718090]">{selection.summary}</div></div><span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold ${chanceClass(selection.chance)}`}>{selection.chance}</span><div className="lg:text-right">{selection.result === 'pending' ? <span className="text-xs text-[#849495]">PENDING</span> : selection.result === 'void' ? <span className="text-xs text-[#849495]">VOID</span> : <span className={`text-xs font-extrabold ${selection.result === 'correct' ? 'text-[#65f2b5]' : 'text-[#ff9da3]'}`}>{selection.result === 'correct' ? 'CORRECT ✓ · +10 PTS' : 'MISSED · +0 PTS'}</span>}</div></div>)}</div></div>;

const AccuracyCard = ({ title, stats }: { title: string; stats: ReturnType<typeof cardStats> }) => <div className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] p-5 text-center"><div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#718090]">{title}</div><div className="mt-3 text-3xl font-extrabold text-white">{stats.total ? `${stats.accuracy}%` : '—'}</div><div className="mt-1 text-xs text-[#91a0b5]">{stats.total ? `${stats.correct}/${stats.total} correct` : 'No settled picks yet'}</div></div>;

const PointRule = ({ value, label }: { value: string; label: string }) => <div className="rounded-xl border border-[#2d3b52] bg-[#10192b] px-3 py-3 text-center"><div className="text-lg font-extrabold text-[#65f2b5]">{value}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#849495]">{label}</div></div>;

const EmptyState = ({ title, copy }: { title: string; copy: string }) => <div className="rounded-2xl border border-dashed border-[#40516b] bg-[#0f182b] p-8 text-center"><span className="material-symbols-outlined text-4xl text-[#526275]">fact_check</span><h3 className="mt-3 font-bold text-white">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-[#91a0b5]">{copy}</p></div>;
