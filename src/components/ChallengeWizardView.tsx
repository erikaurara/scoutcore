import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { easternDateKey, fetchPlayerCareerStats, fetchPlayerRecentGameLogs, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { supabase } from '../services/supabaseClient';

type Step = 1 | 2 | 3 | 4 | 5;
type PickScope = 'batter' | 'pitcher' | 'game';
type SubjectKind = 'batter' | 'pitcher' | 'team' | 'game';
type Direction = 'gte' | 'lte' | 'eq';
type Chance = 'STRONG CHANCE' | 'MODERATE CHANCE' | 'DIFFICULT' | 'LIMITED DATA';
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
  kind: 'batter' | 'pitcher';
};

type PickOption = { label: string; threshold: number; direction?: Direction; choice?: string };
type PickDef = {
  type: PredictionType;
  scope: PickScope;
  subjectKind: SubjectKind;
  label: string;
  shortLabel: string;
  options: PickOption[];
  optional?: boolean;
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

type PickAnalysis = {
  chance: Chance;
  score: number;
  summary: string;
  keyFactor: string;
  stats: { label: string; value: string }[];
};

type CareerMap = Record<number, any>;
type TeamRecentGame = {
  won: boolean;
  teamRuns: number;
  teamHits: number;
  firstInningRuns: number;
  teamScoredFirst: boolean | null;
  extraInnings: boolean;
};

interface ChallengeWizardViewProps {
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
}

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const LOCAL_KEY = 'scoutcore:challenge-cards:v3';
const MAX_PICKS = 8;

const BATTER_DEFS: PickDef[] = [
  { type: 'hitter_hit', scope: 'batter', subjectKind: 'batter', label: 'HITS', shortLabel: 'Hits', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_total_base', scope: 'batter', subjectKind: 'batter', label: 'TOTAL BASES', shortLabel: 'Total Bases', options: [1, 2, 3, 4].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_reach_base', scope: 'batter', subjectKind: 'batter', label: 'REACH BASE', shortLabel: 'Reach Base', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_home_run', scope: 'batter', subjectKind: 'batter', label: 'HOME RUNS', shortLabel: 'Home Runs', options: [{ label: '1+ HR', threshold: 1 }] },
  { type: 'hitter_runs', scope: 'batter', subjectKind: 'batter', label: 'RUNS SCORED', shortLabel: 'Runs', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_rbi', scope: 'batter', subjectKind: 'batter', label: 'RBI', shortLabel: 'RBI', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_walks', scope: 'batter', subjectKind: 'batter', label: 'WALKS', shortLabel: 'Walks', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_stolen_bases', scope: 'batter', subjectKind: 'batter', label: 'STOLEN BASES', shortLabel: 'Stolen Bases', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_extra_base_hit', scope: 'batter', subjectKind: 'batter', label: 'EXTRA-BASE HIT', shortLabel: 'Extra-Base Hit', options: [{ label: '1+', threshold: 1 }] },
  { type: 'hitter_hrr', scope: 'batter', subjectKind: 'batter', label: 'HITS + RUNS + RBI', shortLabel: 'H + R + RBI', options: [2, 3, 4].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_strikeouts', scope: 'batter', subjectKind: 'batter', label: 'BATTER STRIKEOUTS', shortLabel: 'Batter Strikeouts', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
];

const PITCHER_DEFS: PickDef[] = [
  { type: 'pitcher_strikeouts', scope: 'pitcher', subjectKind: 'pitcher', label: 'PITCHER STRIKEOUTS', shortLabel: 'Strikeouts', options: [4, 5, 6, 7, 8].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'pitcher_innings', scope: 'pitcher', subjectKind: 'pitcher', label: 'PITCHER INNINGS', shortLabel: 'Innings', options: [5, 6].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'pitcher_hits_allowed', scope: 'pitcher', subjectKind: 'pitcher', label: 'PITCHER HITS ALLOWED', shortLabel: 'Hits Allowed', options: [4, 5, 6].map(threshold => ({ label: `${threshold} or fewer`, threshold, direction: 'lte' as Direction })) },
  { type: 'pitcher_earned_runs', scope: 'pitcher', subjectKind: 'pitcher', label: 'PITCHER EARNED RUNS', shortLabel: 'Earned Runs', options: [1, 2, 3].map(threshold => ({ label: `${threshold} or fewer`, threshold, direction: 'lte' as Direction })) },
  { type: 'pitcher_walks', scope: 'pitcher', subjectKind: 'pitcher', label: 'PITCHER WALKS', shortLabel: 'Walks', options: [1, 2, 3].map(threshold => ({ label: `${threshold} or fewer`, threshold, direction: 'lte' as Direction })) },
  { type: 'pitcher_quality_start', scope: 'pitcher', subjectKind: 'pitcher', label: 'QUALITY START', shortLabel: 'Quality Start', options: [{ label: 'Yes', threshold: 1, direction: 'eq', choice: 'yes' }, { label: 'No', threshold: 0, direction: 'eq', choice: 'no' }] },
];

const GAME_DEFS: PickDef[] = [
  { type: 'game_first_inning', scope: 'game', subjectKind: 'game', label: 'FIRST INNING', shortLabel: 'First Inning', options: [{ label: 'Run scored', threshold: 1, direction: 'eq', choice: 'run' }, { label: 'No run scored', threshold: 0, direction: 'eq', choice: 'no_run' }] },
  { type: 'game_first_team_score', scope: 'game', subjectKind: 'team', label: 'FIRST TEAM TO SCORE', shortLabel: 'First Team to Score', options: [{ label: 'Selected team', threshold: 1, direction: 'eq' }] },
  { type: 'team_runs', scope: 'game', subjectKind: 'team', label: 'TEAM RUNS', shortLabel: 'Team Runs', options: [3, 4, 5].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'team_hits', scope: 'game', subjectKind: 'team', label: 'TEAM HITS', shortLabel: 'Team Hits', options: [7, 9, 11].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'game_extra_innings', scope: 'game', subjectKind: 'game', label: 'EXTRA INNINGS', shortLabel: 'Extra Innings', options: [{ label: 'Yes', threshold: 1, direction: 'eq', choice: 'yes' }, { label: 'No', threshold: 0, direction: 'eq', choice: 'no' }] },
  { type: 'team_winner', scope: 'game', subjectKind: 'team', label: 'WHO WINS?', shortLabel: 'Winner', options: [{ label: 'Selected team', threshold: 1, direction: 'eq' }], optional: true },
];

const ALL_DEFS = [...BATTER_DEFS, ...PITCHER_DEFS, ...GAME_DEFS];
const DEF_BY_TYPE = Object.fromEntries(ALL_DEFS.map(def => [def.type, def])) as Record<PredictionType, PickDef>;

const json = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));

const tomorrowKey = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return easternDateKey(date);
};

const weekKeyFor = (value: string | Date = new Date()) => {
  const date = new Date(value);
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay();
  local.setDate(local.getDate() + (day === 0 ? -6 : 1 - day));
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

const fetchRoster = async (teamId: number, teamName: string): Promise<RosterPlayer[]> => {
  const data = await json(`${MLB_API}/teams/${teamId}/roster?rosterType=active`);
  return (data.roster ?? []).filter((entry: any) => entry?.person?.id).map((entry: any) => {
    const position = String(entry.position?.abbreviation ?? '');
    return {
      id: Number(entry.person.id),
      name: entry.person.fullName ?? 'MLB Player',
      position,
      teamId,
      teamName,
      kind: position === 'P' ? 'pitcher' as const : 'batter' as const,
    };
  });
};

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
      const isAway = Number(game.teams?.away?.team?.id) === teamId;
      const awayRuns = n(game.teams?.away?.score ?? game.linescore?.teams?.away?.runs);
      const homeRuns = n(game.teams?.home?.score ?? game.linescore?.teams?.home?.runs);
      const awayHits = n(game.linescore?.teams?.away?.hits);
      const homeHits = n(game.linescore?.teams?.home?.hits);
      const innings = game.linescore?.innings ?? [];
      const firstInningRuns = n(innings?.[0]?.away?.runs) + n(innings?.[0]?.home?.runs);
      let firstScoringSide: 'away' | 'home' | null = null;
      for (const inning of innings) {
        if (n(inning?.away?.runs) > 0) { firstScoringSide = 'away'; break; }
        if (n(inning?.home?.runs) > 0) { firstScoringSide = 'home'; break; }
      }
      const inningCount = n(game.linescore?.currentInning || innings.length);
      return {
        won: isAway ? awayRuns > homeRuns : homeRuns > awayRuns,
        teamRuns: isAway ? awayRuns : homeRuns,
        teamHits: isAway ? awayHits : homeHits,
        firstInningRuns,
        teamScoredFirst: firstScoringSide ? (isAway ? firstScoringSide === 'away' : firstScoringSide === 'home') : null,
        extraInnings: inningCount > 9 || innings.length > 9,
      };
    });
}

const passes = (value: number, pick: PickSelection) => pick.direction === 'lte' ? value <= pick.threshold : pick.direction === 'eq' ? value === pick.threshold : value >= pick.threshold;

const hitterValue = (type: PredictionType, stat: any) => {
  if (type === 'hitter_hit') return n(stat.hits);
  if (type === 'hitter_total_base') return n(stat.totalBases);
  if (type === 'hitter_reach_base') return n(stat.hits) + n(stat.baseOnBalls) + n(stat.hitByPitch);
  if (type === 'hitter_home_run') return n(stat.homeRuns);
  if (type === 'hitter_runs') return n(stat.runs);
  if (type === 'hitter_rbi') return n(stat.rbi);
  if (type === 'hitter_walks') return n(stat.baseOnBalls);
  if (type === 'hitter_stolen_bases') return n(stat.stolenBases);
  if (type === 'hitter_extra_base_hit') return n(stat.doubles) + n(stat.triples) + n(stat.homeRuns);
  if (type === 'hitter_hrr') return n(stat.hits) + n(stat.runs) + n(stat.rbi);
  if (type === 'hitter_strikeouts') return n(stat.strikeOuts);
  return 0;
};

const inningsToOuts = (value: unknown) => {
  const [wholeRaw, fractionRaw = '0'] = String(value ?? '0').split('.');
  return (Number(wholeRaw) || 0) * 3 + Math.max(0, Math.min(2, Number(fractionRaw) || 0));
};

const pitcherValue = (type: PredictionType, stat: any) => {
  if (type === 'pitcher_strikeouts') return n(stat.strikeOuts);
  if (type === 'pitcher_innings') return inningsToOuts(stat.inningsPitched);
  if (type === 'pitcher_hits_allowed') return n(stat.hits);
  if (type === 'pitcher_earned_runs') return n(stat.earnedRuns);
  if (type === 'pitcher_walks') return n(stat.baseOnBalls);
  if (type === 'pitcher_quality_start') return inningsToOuts(stat.inningsPitched) >= 18 && n(stat.earnedRuns) <= 3 ? 1 : 0;
  return 0;
};

const chanceFor = (score: number): Chance => score >= 70 ? 'STRONG CHANCE' : score >= 48 ? 'MODERATE CHANCE' : score > 0 ? 'DIFFICULT' : 'LIMITED DATA';
const chanceStyle = (chance: Chance) => chance === 'STRONG CHANCE' ? 'text-[#8df5a8] border-[#65f2b5]/35 bg-[#65f2b5]/8' : chance === 'MODERATE CHANCE' ? 'text-[#ffd76a] border-[#ffd166]/35 bg-[#ffd166]/8' : chance === 'DIFFICULT' ? 'text-[#ff9c76] border-[#ff875f]/35 bg-[#ff875f]/8' : 'text-[#9aa8bc] border-[#40516b] bg-[#40516b]/8';

function pickLabel(def: PickDef, option: PickOption, subjectName: string) {
  if (def.type === 'hitter_hit') return `${subjectName} — ${option.threshold}+ Hit${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_total_base') return `${subjectName} — ${option.threshold}+ Total Base${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_reach_base') return `${subjectName} — Reach Base ${option.threshold}+ Time${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_home_run') return `${subjectName} — 1+ Home Run`;
  if (def.type === 'hitter_runs') return `${subjectName} — ${option.threshold}+ Run${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_rbi') return `${subjectName} — ${option.threshold}+ RBI`;
  if (def.type === 'hitter_walks') return `${subjectName} — ${option.threshold}+ Walk${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_stolen_bases') return `${subjectName} — ${option.threshold}+ Stolen Base${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_extra_base_hit') return `${subjectName} — 1+ Extra-Base Hit`;
  if (def.type === 'hitter_hrr') return `${subjectName} — ${option.threshold}+ Hits + Runs + RBI`;
  if (def.type === 'hitter_strikeouts') return `${subjectName} — ${option.threshold}+ Batter Strikeout${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'pitcher_strikeouts') return `${subjectName} — ${option.threshold}+ Strikeouts`;
  if (def.type === 'pitcher_innings') return `${subjectName} — ${option.threshold}+ Innings`;
  if (def.type === 'pitcher_hits_allowed') return `${subjectName} — ${option.threshold} or Fewer Hits Allowed`;
  if (def.type === 'pitcher_earned_runs') return `${subjectName} — ${option.threshold} or Fewer Earned Runs`;
  if (def.type === 'pitcher_walks') return `${subjectName} — ${option.threshold} or Fewer Walks`;
  if (def.type === 'pitcher_quality_start') return `${subjectName} — Quality Start: ${option.choice === 'yes' ? 'Yes' : 'No'}`;
  if (def.type === 'game_first_inning') return `First Inning — ${option.choice === 'run' ? 'Run Scored' : 'No Run Scored'}`;
  if (def.type === 'game_first_team_score') return `${subjectName} — First Team to Score`;
  if (def.type === 'team_runs') return `${subjectName} — ${option.threshold}+ Team Runs`;
  if (def.type === 'team_hits') return `${subjectName} — ${option.threshold}+ Team Hits`;
  if (def.type === 'game_extra_innings') return `Extra Innings — ${option.choice === 'yes' ? 'Yes' : 'No'}`;
  if (def.type === 'team_winner') return `${subjectName} — Win`;
  return `${subjectName} — ${def.shortLabel} ${option.label}`;
}

function pickDetail(def: PickDef, option: PickOption) {
  if (def.type === 'hitter_extra_base_hit') return 'Records at least one double, triple, or home run.';
  if (def.type === 'pitcher_quality_start') return option.choice === 'yes' ? 'Records at least 6.0 innings with 3 or fewer earned runs.' : 'Does not record a quality start.';
  if (def.type === 'game_first_inning') return option.choice === 'run' ? 'At least one run is scored in the first inning.' : 'No run is scored in the first inning.';
  if (def.type === 'game_first_team_score') return 'Selected team scores the first run of the game.';
  if (def.type === 'game_extra_innings') return option.choice === 'yes' ? 'Game reaches the 10th inning or later.' : 'Game ends in nine innings or fewer.';
  if (def.type === 'team_winner') return 'Selected team wins the game.';
  return `${def.shortLabel}: ${option.label}.`;
}

function buildPick(def: PickDef, option: PickOption, game: MlbScheduleGame, subject: RosterPlayer | MlbScheduleGame['awayTeam'] | null): PickSelection {
  const playerSubject = subject && 'position' in subject ? subject : null;
  const teamSubject = subject && !('position' in subject) ? subject : null;
  const subjectId = playerSubject?.id ?? teamSubject?.id ?? game.gamePk;
  const subjectName = playerSubject?.name ?? teamSubject?.name ?? `${game.awayTeam.abbreviation ?? game.awayTeam.name} @ ${game.homeTeam.abbreviation ?? game.homeTeam.name}`;
  const teamId = playerSubject?.teamId ?? teamSubject?.id ?? 0;
  const teamName = playerSubject?.teamName ?? teamSubject?.name ?? 'Game';
  return {
    id: `${game.gamePk}-${def.type}-${subjectId}-${option.threshold}-${option.choice ?? ''}`,
    type: def.type,
    scope: def.scope,
    gamePk: game.gamePk,
    subjectId,
    subjectName,
    teamId,
    teamName,
    threshold: option.threshold,
    direction: option.direction ?? 'gte',
    choice: option.choice,
    label: pickLabel(def, option, subjectName),
    detail: pickDetail(def, option),
  };
}

const careerSummary = (player: RosterPlayer, stats: any) => player.kind === 'pitcher'
  ? `${stats?.era ?? '—'} ERA · ${stats?.whip ?? '—'} WHIP · ${stats?.strikeOuts ?? '—'} SO · ${stats?.inningsPitched ?? '—'} IP`
  : `${stats?.avg ?? '—'} AVG · ${stats?.homeRuns ?? '—'} HR · ${stats?.rbi ?? '—'} RBI · ${stats?.ops ?? '—'} OPS`;

async function analyzeGamePick(pick: PickSelection, game: MlbScheduleGame): Promise<PickAnalysis> {
  if (pick.type === 'game_first_inning' || pick.type === 'game_extra_innings') {
    const [away, home] = await Promise.all([
      fetchRecentTeamGames(game.awayTeam.id, 5).catch(() => []),
      fetchRecentTeamGames(game.homeTeam.id, 5).catch(() => []),
    ]);
    const recent = [...away, ...home];
    const values = recent.map(item => pick.type === 'game_first_inning' ? (item.firstInningRuns > 0 ? 1 : 0) : (item.extraInnings ? 1 : 0));
    const hits = values.filter(value => passes(value, pick)).length;
    const rate = values.length ? hits / values.length : .5;
    const score = clamp(Math.round(28 + rate * 60));
    return {
      chance: chanceFor(score),
      score,
      summary: `${hits}/${values.length || 0} recent team games matched this game condition.`,
      keyFactor: 'ScoutCore compares recent results from both clubs; this is not a guaranteed probability.',
      stats: [{ label: 'Recent match rate', value: values.length ? `${hits}/${values.length}` : 'Limited data' }, { label: 'Matchup', value: `${game.awayTeam.abbreviation ?? game.awayTeam.name} @ ${game.homeTeam.abbreviation ?? game.homeTeam.name}` }],
    };
  }

  const recent = await fetchRecentTeamGames(pick.teamId, 10).catch(() => []);
  const values = recent.map(item => {
    if (pick.type === 'game_first_team_score') return item.teamScoredFirst ? 1 : 0;
    if (pick.type === 'team_runs') return item.teamRuns;
    if (pick.type === 'team_hits') return item.teamHits;
    if (pick.type === 'team_winner') return item.won ? 1 : 0;
    return 0;
  });
  const hits = values.filter(value => passes(value, pick)).length;
  const rate = values.length ? hits / values.length : .5;
  const score = clamp(Math.round(28 + rate * 60));
  return {
    chance: chanceFor(score),
    score,
    summary: `${hits}/${values.length || 0} recent ${pick.teamName} games met this exact condition.`,
    keyFactor: 'Recent team form is the primary verified input for this game selection.',
    stats: [{ label: 'Last 10', value: values.length ? `${hits}/${values.length}` : 'Limited data' }, { label: 'Team', value: pick.teamName }],
  };
}

async function analyzePick(pick: PickSelection, game: MlbScheduleGame, careers: CareerMap): Promise<PickAnalysis> {
  if (pick.scope === 'game') return analyzeGamePick(pick, game);

  const group = pick.scope === 'pitcher' ? 'pitching' : 'hitting';
  const logs = await fetchPlayerRecentGameLogs(pick.subjectId, group, 10).catch(() => [] as any[]);
  const values = logs.map((log: any) => pick.scope === 'pitcher' ? pitcherValue(pick.type, log.stat ?? {}) : hitterValue(pick.type, log.stat ?? {}));
  const hits = values.filter(value => passes(value, pick)).length;
  const recentRate = values.length ? hits / values.length : .45;
  const career = careers[pick.subjectId] ?? await fetchPlayerCareerStats(pick.subjectId, group).catch(() => ({}));

  let context = 0;
  if (pick.scope === 'batter') {
    const opposing = pick.teamId === game.awayTeam.id ? game.homeProbablePitcher : game.awayProbablePitcher;
    const opposingCareer = opposing?.id ? await fetchPlayerCareerStats(opposing.id, 'pitching').catch(() => ({})) : {};
    const whip = n(opposingCareer?.whip);
    const era = n(opposingCareer?.era);
    if (whip >= 1.28) context += 7;
    else if (whip > 0 && whip <= 1.08) context -= 5;
    if (era >= 4.2) context += 5;
    else if (era > 0 && era <= 3.0) context -= 4;
    if (n(career?.ops) >= .850) context += 5;
    const score = clamp(Math.round(28 + recentRate * 58 + context));
    return {
      chance: chanceFor(score),
      score,
      summary: `${hits}/${values.length || 0} recent games met this exact line. Career production and the opposing starter are supporting inputs.`,
      keyFactor: opposing?.name ? `Opposing starter: ${opposing.name}` : 'Opposing starter is not confirmed yet.',
      stats: [
        { label: 'Last 10', value: values.length ? `${hits}/${values.length}` : 'Limited data' },
        { label: 'Career AVG', value: career?.avg ?? '—' },
        { label: 'Career OPS', value: career?.ops ?? '—' },
        { label: 'Opp. starter ERA', value: opposingCareer?.era ?? '—' },
        { label: 'Opp. starter WHIP', value: opposingCareer?.whip ?? '—' },
      ],
    };
  }

  const k9 = n(career?.strikeoutsPer9Inn);
  const whip = n(career?.whip);
  if (pick.type === 'pitcher_strikeouts' && k9 >= 9) context += 8;
  if (pick.type === 'pitcher_hits_allowed' && whip > 0 && whip <= 1.15) context += 6;
  if (pick.type === 'pitcher_earned_runs' && n(career?.era) > 0 && n(career?.era) <= 3.4) context += 6;
  const score = clamp(Math.round(28 + recentRate * 58 + context));
  return {
    chance: chanceFor(score),
    score,
    summary: `${hits}/${values.length || 0} recent starts met this exact line. ScoutCore also checks career workload, run prevention and strikeout profile.`,
    keyFactor: `Career workload: ${career?.inningsPitched ?? '—'} innings.`,
    stats: [
      { label: 'Recent starts', value: values.length ? `${hits}/${values.length}` : 'Limited data' },
      { label: 'Career ERA', value: career?.era ?? '—' },
      { label: 'Career WHIP', value: career?.whip ?? '—' },
      { label: 'Career K/9', value: career?.strikeoutsPer9Inn ?? '—' },
      { label: 'Career IP', value: career?.inningsPitched ?? '—' },
    ],
  };
}

export const ChallengeWizardView: React.FC<ChallengeWizardViewProps> = ({ signedIn, userEmail, onOpenAuth }) => {
  const [step, setStep] = useState<Step>(1);
  const [todayGames, setTodayGames] = useState<MlbScheduleGame[]>([]);
  const [tomorrowGames, setTomorrowGames] = useState<MlbScheduleGame[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [career, setCareer] = useState<CareerMap>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [openCategory, setOpenCategory] = useState<PredictionType>('hitter_hit');
  const [subjectChoice, setSubjectChoice] = useState<Partial<Record<PredictionType, number>>>({});
  const [picks, setPicks] = useState<PickSelection[]>([]);
  const [analysis, setAnalysis] = useState<Record<string, PickAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(userEmail?.split('@')[0] || 'ScoutCore User');
  const [userId, setUserId] = useState<string | null>(null);
  const [lockedCard, setLockedCard] = useState<any | null>(null);
  const [locking, setLocking] = useState(false);

  const allGames = useMemo(() => [...todayGames, ...tomorrowGames], [todayGames, tomorrowGames]);
  const selectedGame = useMemo(() => allGames.find(game => game.gamePk === selectedGamePk) ?? null, [allGames, selectedGamePk]);
  const allBatters = useMemo(() => [...awayRoster, ...homeRoster].filter(player => player.kind === 'batter'), [awayRoster, homeRoster]);
  const allPitchers = useMemo(() => {
    if (!selectedGame) return [];
    const probable = [
      selectedGame.awayProbablePitcher?.id ? { id: selectedGame.awayProbablePitcher.id, name: selectedGame.awayProbablePitcher.name, position: 'P', teamId: selectedGame.awayTeam.id, teamName: selectedGame.awayTeam.name, kind: 'pitcher' as const } : null,
      selectedGame.homeProbablePitcher?.id ? { id: selectedGame.homeProbablePitcher.id, name: selectedGame.homeProbablePitcher.name, position: 'P', teamId: selectedGame.homeTeam.id, teamName: selectedGame.homeTeam.name, kind: 'pitcher' as const } : null,
    ].filter(Boolean) as RosterPlayer[];
    const rosterPitchers = [...awayRoster, ...homeRoster].filter(player => player.kind === 'pitcher');
    return [...probable, ...rosterPitchers.filter(player => !probable.some(p => p.id === player.id))];
  }, [selectedGame, awayRoster, homeRoster]);
  const analysisReady = picks.length > 0 && picks.every(pick => Boolean(analysis[pick.id]));
  const gameStarted = selectedGame ? Date.now() >= new Date(selectedGame.gameDate).getTime() : false;
  const activeDef = DEF_BY_TYPE[openCategory];

  const subjectFor = (def: PickDef): RosterPlayer | MlbScheduleGame['awayTeam'] | null => {
    if (!selectedGame) return null;
    if (def.subjectKind === 'batter') {
      const id = subjectChoice[def.type] ?? allBatters[0]?.id;
      return allBatters.find(player => player.id === id) ?? allBatters[0] ?? null;
    }
    if (def.subjectKind === 'pitcher') {
      const id = subjectChoice[def.type] ?? allPitchers[0]?.id;
      return allPitchers.find(player => player.id === id) ?? allPitchers[0] ?? null;
    }
    if (def.subjectKind === 'team') {
      const id = subjectChoice[def.type] ?? selectedGame.awayTeam.id;
      return id === selectedGame.homeTeam.id ? selectedGame.homeTeam : selectedGame.awayTeam;
    }
    return null;
  };

  const activeSubject = subjectFor(activeDef);

  useEffect(() => {
    setScheduleLoading(true);
    Promise.all([fetchSchedule(easternDateKey()), fetchSchedule(tomorrowKey())])
      .then(([today, tomorrow]) => {
        setTodayGames(today);
        setTomorrowGames(tomorrow);
        setSelectedGamePk(current => current ?? today[0]?.gamePk ?? tomorrow[0]?.gamePk ?? null);
      })
      .catch(() => setMessage('ScoutCore could not load the MLB schedule right now.'))
      .finally(() => setScheduleLoading(false));
  }, []);

  useEffect(() => {
    if (!signedIn || !supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const metadata = data.user.user_metadata ?? {};
      setDisplayName(metadata.display_name || metadata.full_name || data.user.email?.split('@')[0] || 'ScoutCore User');
    });
  }, [signedIn, userEmail]);

  useEffect(() => {
    if (!selectedGame) return;
    setStep(1);
    setPicks([]);
    setAnalysis({});
    setSubjectChoice({});
    setOpenCategory('hitter_hit');
    setLockedCard(null);
    setCareer({});
    setRosterLoading(true);
    Promise.all([
      fetchRoster(selectedGame.awayTeam.id, selectedGame.awayTeam.name).catch(() => []),
      fetchRoster(selectedGame.homeTeam.id, selectedGame.homeTeam.name).catch(() => []),
    ]).then(([away, home]) => {
      setAwayRoster(away);
      setHomeRoster(home);
    }).finally(() => setRosterLoading(false));
  }, [selectedGamePk]);

  useEffect(() => {
    if (!activeSubject || !('position' in activeSubject) || career[activeSubject.id]) return;
    const group = activeSubject.kind === 'pitcher' ? 'pitching' : 'hitting';
    let cancelled = false;
    fetchPlayerCareerStats(activeSubject.id, group).then(stats => {
      if (!cancelled) setCareer(current => ({ ...current, [activeSubject.id]: stats }));
    }).catch(() => {
      if (!cancelled) setCareer(current => ({ ...current, [activeSubject.id]: {} }));
    });
    return () => { cancelled = true; };
  }, [activeSubject && 'position' in activeSubject ? activeSubject.id : null, openCategory]);

  const togglePick = (pick: PickSelection) => {
    if (!signedIn) { onOpenAuth(); return; }
    setMessage(null);
    const existing = picks.some(item => item.id === pick.id);
    if (existing) {
      const next = picks.filter(item => item.id !== pick.id);
      setPicks(next);
      setAnalysis(current => Object.fromEntries(Object.entries(current).filter(([id]) => next.some(item => item.id === id))));
      return;
    }
    const exclusiveType = pick.type === 'team_winner' || pick.type === 'game_first_team_score' || pick.type === 'game_first_inning' || pick.type === 'game_extra_innings';
    const withoutSame = picks.filter(item => exclusiveType ? item.type !== pick.type : !(item.type === pick.type && item.subjectId === pick.subjectId));
    if (withoutSame.length >= MAX_PICKS) {
      setMessage(`Choose up to ${MAX_PICKS} Challenge selections on one card.`);
      return;
    }
    const next = [...withoutSame, pick];
    setPicks(next);
    setAnalysis(current => Object.fromEntries(Object.entries(current).filter(([id]) => next.some(item => item.id === id))));
  };

  const submitForAnalysis = async () => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!selectedGame || !picks.length) { setMessage('Choose at least one player or game prediction first.'); return; }
    if (gameStarted) { setMessage('This game has already started, so its Challenge is locked.'); return; }
    setAnalyzing(true);
    setMessage(null);
    const rows = await Promise.all(picks.map(async pick => [pick.id, await analyzePick(pick, selectedGame, career).catch(() => ({ chance: 'LIMITED DATA' as Chance, score: 0, summary: 'ScoutCore could not load enough verified data for this pick.', keyFactor: 'Try again when more data is available.', stats: [] }))] as const));
    setAnalysis(Object.fromEntries(rows));
    setAnalyzing(false);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const lockPicks = async () => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!selectedGame || !analysisReady || !picks.length) return;
    if (gameStarted) { setMessage('This game has already started, so these picks cannot be locked.'); return; }
    setLocking(true);
    setMessage(null);
    const card = {
      id: crypto.randomUUID(),
      userId,
      displayName,
      createdAt: new Date().toISOString(),
      weekKey: weekKeyFor(),
      ticketKind: 'ranked',
      gamePk: selectedGame.gamePk,
      gameDate: selectedGame.gameDate,
      awayTeam: selectedGame.awayTeam,
      homeTeam: selectedGame.homeTeam,
      selections: picks.map(pick => ({ ...pick, ...analysis[pick.id], result: 'pending' })),
      status: 'upcoming',
      correctCount: 0,
      settledCount: 0,
      points: 0,
    };
    if (supabase && userId) {
      const { error } = await supabase.rpc('submit_challenge_card', {
        p_id: card.id,
        p_display_name: displayName,
        p_game_pk: card.gamePk,
        p_game_date: card.gameDate,
        p_away_team: card.awayTeam,
        p_home_team: card.homeTeam,
        p_selections: card.selections,
      });
      if (error) {
        setMessage('ScoutCore could not save this card yet. Your picks are still editable.');
        setLocking(false);
        return;
      }
    }
    try {
      const existing = JSON.parse(window.localStorage.getItem(LOCAL_KEY) || '[]');
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify([card, ...(Array.isArray(existing) ? existing : [])]));
    } catch {}
    setLockedCard(card);
    setStep(5);
    setLocking(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!signedIn) {
    return <div className="min-h-screen bg-[#07101f] px-4 py-10 text-[#dae2fd]"><div className="mx-auto max-w-xl rounded-3xl border border-[#2b405b] bg-[#0d1727] p-8 text-center"><span className="material-symbols-outlined text-5xl text-[#00e6f4]">fact_check</span><h1 className="mt-4 text-2xl font-extrabold text-white">Log in to build a ScoutCore Challenge</h1><p className="mt-2 text-sm leading-6 text-[#91a0b5]">Build predictions, review ScoutCore analysis, inspect supporting stats, then lock your card before game time.</p><button onClick={onOpenAuth} className="mt-5 rounded-xl bg-[#00e6f4] px-6 py-3 text-sm font-extrabold text-[#062029]">LOG IN</button></div></div>;
  }

  return <div className="min-h-screen bg-[#07101f] px-4 py-5 text-[#dae2fd] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1760px]">
      <WizardHeader step={step} />
      {message && <div className="mt-4 rounded-xl border border-[#ffd166]/30 bg-[#ffd166]/8 px-4 py-3 text-sm text-[#f0dda6]">{message}</div>}

      {step === 1 && <div className="mt-5 space-y-5">
        <GameChooser today={todayGames} tomorrow={tomorrowGames} loading={scheduleLoading} selected={selectedGamePk} onSelect={setSelectedGamePk} />
        {selectedGame && <>
          <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#26364e] pb-4">
              <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#65f2b5]">Build Picks</p><h2 className="mt-1 text-2xl font-extrabold text-white">Choose any category. ScoutCore shows the right players automatically.</h2><p className="mt-1 text-xs text-[#8495aa]">No batter/pitcher mode switch. Mix players from both teams and game predictions on the same card.</p></div>
              <div className="flex items-center gap-4"><TeamBadge team={selectedGame.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={selectedGame.homeTeam}/></div>
            </div>

            {rosterLoading ? <div className="py-16 text-center text-sm text-[#91a0b5]">Loading both teams…</div> : <div className="mt-4 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="space-y-4">
                <CategoryGroup title="BATTER PICKS" icon="sports_baseball" defs={BATTER_DEFS} open={openCategory} onOpen={setOpenCategory} picks={picks}/>
                <CategoryGroup title="PITCHER PICKS" icon="sports" defs={PITCHER_DEFS} open={openCategory} onOpen={setOpenCategory} picks={picks}/>
                <CategoryGroup title="GAME PICKS" icon="stadium" defs={GAME_DEFS} open={openCategory} onOpen={setOpenCategory} picks={picks}/>
              </div>
              <CategoryDetail def={activeDef} game={selectedGame} batters={allBatters} pitchers={allPitchers} subject={activeSubject} career={career} subjectChoice={subjectChoice[activeDef.type]} onSubjectChange={id => setSubjectChoice(current => ({ ...current, [activeDef.type]: id }))} picks={picks} onToggle={togglePick}/>
            </div>}
          </section>

          <SelectedPicksBar picks={picks} analysis={analysis} onRemove={togglePick} onSubmit={() => void submitForAnalysis()} analyzing={analyzing} gameStarted={gameStarted}/>
        </>}
      </div>}

      {step === 2 && selectedGame && <StepShell title="ScoutCore Analysis" subtitle="ScoutCore runs category-specific analysis for every pick. Scores are support ratings—not guaranteed probabilities.">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{picks.map(pick => <AnalysisCard key={pick.id} pick={pick} analysis={analysis[pick.id]} />)}</div>
        <BottomActions left="BACK TO PICKS" onLeft={() => setStep(1)} right="PROCEED → REVIEW STATS" onRight={() => { setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={!analysisReady}/>
      </StepShell>}

      {step === 3 && selectedGame && <StepShell title="Review Stats" subtitle="Explore the verified data ScoutCore used for each selection. Go back if you want to change anything.">
        <div className="space-y-3">{picks.map(pick => <StatsReviewCard key={pick.id} pick={pick} analysis={analysis[pick.id]} />)}</div>
        <BottomActions left="BACK TO ANALYZE" onLeft={() => setStep(2)} right="PROCEED → GO" onRight={() => { setStep(4); window.scrollTo({ top: 0, behavior: 'smooth' }); }}/>
      </StepShell>}

      {step === 4 && selectedGame && <StepShell title="GO — Lock Your Picks" subtitle="Review one last time. Once you press GO, the prediction and ScoutCore analysis snapshot cannot be edited.">
        <FinalReview game={selectedGame} picks={picks} analysis={analysis}/>
        <div className="mt-5 rounded-2xl border border-[#65f2b5]/25 bg-[#65f2b5]/7 p-4 text-center"><p className="text-xs text-[#a5ddc4]">ScoutCore score = analytical confidence. ScoutCore Points = your Challenge performance after results settle.</p><button onClick={() => void lockPicks()} disabled={locking || gameStarted} className="mt-4 w-full max-w-xl rounded-xl bg-[#65e7e4] px-7 py-4 text-sm font-black text-[#05262b] disabled:opacity-40">{locking ? 'LOCKING…' : 'GO — LOCK MY PICKS'}</button></div>
        <BottomActions left="BACK TO REVIEW STATS" onLeft={() => setStep(3)} />
      </StepShell>}

      {step === 5 && selectedGame && <LockedPage game={selectedGame} card={lockedCard} />}
    </div>
  </div>;
};

const WizardHeader = ({ step }: { step: Step }) => {
  const steps = [
    { id: 1, label: 'SELECT', sub: 'Build your picks' },
    { id: 2, label: 'ANALYZE', sub: 'ScoutCore runs analysis' },
    { id: 3, label: 'REVIEW STATS', sub: 'Explore key data' },
    { id: 4, label: 'GO', sub: 'Lock your picks' },
    { id: 5, label: 'LOCKED', sub: 'Await results' },
  ];
  return <section className="rounded-2xl border border-[#263a54] bg-[#0a1525] p-3 sm:p-4"><div className="grid gap-2 md:grid-cols-5">{steps.map(item => <div key={item.id} className={`rounded-xl border px-3 py-3 ${step === item.id ? 'border-[#00e6f4] bg-[#00e6f4]/10' : step > item.id ? 'border-[#65f2b5]/25 bg-[#65f2b5]/5' : 'border-[#263a54] bg-[#0d1727]'}`}><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black ${step === item.id ? 'border-[#78f6ff] bg-[#00e6f4] text-[#05262b]' : 'border-[#42536b] text-[#9aabc0]'}`}>{item.id}</span><div><p className="text-[11px] font-black tracking-wide text-white">{item.label}</p><p className="text-[9px] text-[#8495aa]">{item.sub}</p></div></div></div>)}</div></section>;
};

const GameChooser = ({ today, tomorrow, loading, selected, onSelect }: { today: MlbScheduleGame[]; tomorrow: MlbScheduleGame[]; loading: boolean; selected: number | null; onSelect: (id: number) => void }) => <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-5"><div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#65f2b5]">Step 1</p><h1 className="mt-1 text-2xl font-extrabold text-white">Choose a matchup</h1><p className="mt-1 text-xs text-[#8495aa]">Then build one Challenge Card using players from either team.</p></div>{loading ? <div className="py-8 text-center text-sm text-[#91a0b5]">Loading MLB schedule…</div> : <div className="grid gap-4 xl:grid-cols-2"><GameDay title="TODAY'S GAMES" games={today} selected={selected} onSelect={onSelect}/><GameDay title="TOMORROW'S GAMES" games={tomorrow} selected={selected} onSelect={onSelect}/></div>}</section>;

const GameDay = ({ title, games, selected, onSelect }: { title: string; games: MlbScheduleGame[]; selected: number | null; onSelect: (id: number) => void }) => <div><p className="mb-2 text-[10px] font-black tracking-[.13em] text-[#8fa0b7]">{title}</p><div className="grid gap-2 sm:grid-cols-2">{games.map(game => <button key={game.gamePk} onClick={() => onSelect(game.gamePk)} className={`rounded-xl border p-3 text-left transition ${selected === game.gamePk ? 'border-[#00e6f4] bg-[#00e6f4]/8' : 'border-[#2b405b] bg-[#08111f] hover:border-[#50647f]'}`}><div className="flex items-center justify-between gap-2"><TeamBadge team={game.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={game.homeTeam}/></div><p className="mt-2 text-[9px] text-[#718198]">{dateLabel(game.gameDate)} · {timeLabel(game.gameDate)}</p></button>)}{!games.length && <div className="rounded-xl border border-dashed border-[#40516b] p-4 text-xs text-[#718198]">No games listed.</div>}</div></div>;

const TeamBadge = ({ team }: { team: MlbScheduleGame['awayTeam'] }) => <div className="flex min-w-0 items-center gap-2"><div className="h-9 w-9 shrink-0 rounded-lg bg-[#eef2f6] p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-full w-full object-contain"/></div><div className="min-w-0"><p className="truncate text-xs font-black text-white">{team.abbreviation ?? team.name}</p><p className="hidden truncate text-[9px] text-[#718198] sm:block">{team.name}</p></div></div>;

const CategoryGroup = ({ title, icon, defs, open, onOpen, picks }: { title: string; icon: string; defs: PickDef[]; open: PredictionType; onOpen: (type: PredictionType) => void; picks: PickSelection[] }) => <section className="overflow-hidden rounded-2xl border border-[#2a3d56] bg-[#091321]"><div className="flex items-center gap-2 border-b border-[#26364e] px-4 py-3"><span className="material-symbols-outlined text-[18px] text-[#00e6f4]">{icon}</span><p className="text-[10px] font-black tracking-[.14em] text-[#8fa0b7]">{title}</p></div><div className="divide-y divide-[#1d2d42]">{defs.map(def => { const count = picks.filter(pick => pick.type === def.type).length; return <button key={def.type} onClick={() => onOpen(def.type)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${open === def.type ? 'bg-[#00e6f4]/8' : 'hover:bg-[#101c2d]'}`}><div className="min-w-0 flex-1"><p className={`text-[11px] font-black ${open === def.type ? 'text-[#65eff7]' : 'text-[#d7e1ee]'}`}>{def.label} {def.optional && <span className="ml-1 text-[8px] font-bold text-[#7e8da1]">OPTIONAL</span>}</p></div>{count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#65f2b5]/15 px-1.5 text-[9px] font-black text-[#65f2b5]">{count}</span>}<span className="material-symbols-outlined text-[18px] text-[#62738a]">{open === def.type ? 'expand_less' : 'chevron_right'}</span></button>; })}</div></section>;

const CategoryDetail = ({ def, game, batters, pitchers, subject, career, subjectChoice, onSubjectChange, picks, onToggle }: { def: PickDef; game: MlbScheduleGame; batters: RosterPlayer[]; pitchers: RosterPlayer[]; subject: RosterPlayer | MlbScheduleGame['awayTeam'] | null; career: CareerMap; subjectChoice?: number; onSubjectChange: (id: number) => void; picks: PickSelection[]; onToggle: (pick: PickSelection) => void }) => {
  const playerPool = def.subjectKind === 'batter' ? batters : def.subjectKind === 'pitcher' ? pitchers : [];
  const player = subject && 'position' in subject ? subject : null;
  const selectedTeam = subject && !('position' in subject) ? subject : null;
  const currentPicks = picks.filter(pick => pick.type === def.type);

  return <section className="rounded-2xl border border-[#2a3d56] bg-[#091321] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#26364e] pb-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">{def.scope === 'batter' ? 'Batter Pick' : def.scope === 'pitcher' ? 'Pitcher Pick' : 'Game Pick'}</p><h3 className="mt-1 text-2xl font-extrabold text-white">{def.label}</h3><p className="mt-1 text-xs text-[#8495aa]">{def.subjectKind === 'batter' ? 'Choose any batter from either team, then choose a line.' : def.subjectKind === 'pitcher' ? 'Choose any pitcher from either team, then choose a line.' : def.subjectKind === 'team' ? 'Choose either team, then choose the prediction.' : 'Choose the game outcome you want to predict.'}</p></div><span className="rounded-lg border border-[#30415c] bg-[#10192b] px-3 py-1.5 text-[10px] font-bold text-[#91a2b8]">{currentPicks.length} selected in this category</span></div>

    {playerPool.length > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,380px)_1fr]">
      <div><label className="text-[9px] font-black uppercase tracking-wider text-[#7f90a6]">Choose player</label><select value={subjectChoice ?? playerPool[0]?.id ?? ''} onChange={event => onSubjectChange(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-[#30415c] bg-[#08111f] px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#00e6f4]">{[game.awayTeam, game.homeTeam].map(team => <optgroup key={team.id} label={team.name}>{playerPool.filter(item => item.teamId === team.id).map(item => <option key={item.id} value={item.id}>{item.name} · {item.position}</option>)}</optgroup>)}</select></div>
      {player && <div className="flex items-center gap-4 rounded-xl border border-[#26364e] bg-[#08111f] p-3"><img src={mlbPlayerHeadshotUrl(player.id, 160)} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-[#e5eaef] object-contain"/><div className="min-w-0"><div className="flex items-center gap-2"><img src={mlbTeamLogoUrl(player.teamId)} alt="" className="h-5 w-5 object-contain"/><p className="truncate text-lg font-black text-white">{player.name}</p><span className="rounded border border-[#33465f] px-1.5 py-0.5 text-[8px] font-bold text-[#91a2b8]">{player.position}</span></div><p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-[#65f2b5]">Career Regular Season</p><p className="mt-1 text-xs text-[#aab8ca]">{career[player.id] ? careerSummary(player, career[player.id]) : 'Loading career stats…'}</p></div></div>}
    </div>}

    {def.subjectKind === 'team' && <div className="mt-4"><p className="text-[9px] font-black uppercase tracking-wider text-[#7f90a6]">Choose team</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{[game.awayTeam, game.homeTeam].map(team => <button key={team.id} onClick={() => onSubjectChange(team.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selectedTeam?.id === team.id ? 'border-[#00e6f4] bg-[#00e6f4]/8' : 'border-[#30415c] bg-[#08111f]'}`}><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-9 w-9 object-contain"/><div><p className="text-sm font-black text-white">{team.name}</p><p className="text-[9px] text-[#718198]">{team.abbreviation ?? ''}</p></div></button>)}</div></div>}

    <div className="mt-5"><p className="text-[9px] font-black uppercase tracking-wider text-[#7f90a6]">Choose prediction</p><div className="mt-2 flex flex-wrap gap-2">{def.options.map(option => { const pick = buildPick(def, option, game, subject); const active = picks.some(item => item.id === pick.id); return <button key={`${option.label}-${option.threshold}-${option.choice ?? ''}`} onClick={() => onToggle(pick)} disabled={(def.subjectKind === 'batter' || def.subjectKind === 'pitcher' || def.subjectKind === 'team') && !subject} className={`rounded-xl border px-4 py-2.5 text-xs font-black transition disabled:opacity-30 ${active ? 'border-[#00e6f4] bg-[#00e6f4] text-[#05262b] shadow-[0_0_18px_rgba(0,230,244,.18)]' : 'border-[#30415c] bg-[#10192b] text-[#d0d9e5] hover:border-[#00e6f4]/55'}`}>{def.type === 'game_first_team_score' || def.type === 'team_winner' ? (selectedTeam?.abbreviation ?? selectedTeam?.name ?? option.label) : option.label}</button>; })}</div><p className="mt-2 text-[10px] text-[#718198]">{def.options[0] ? pickDetail(def, def.options[0]) : ''}</p></div>

    {currentPicks.length > 0 && <div className="mt-6 border-t border-[#26364e] pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-wider text-[#7f90a6]">Selections in {def.shortLabel}</p><span className="text-[9px] text-[#718198]">Click × to remove</span></div><div className="space-y-2">{currentPicks.map(pick => <div key={pick.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#26364e] bg-[#08111f] px-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{pick.label}</p><p className="mt-0.5 text-[9px] text-[#718198]">{pick.teamName}</p></div><button onClick={() => onToggle(pick)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#3a4a61] text-[#9aa8bc] hover:border-[#ff8d8d]/50 hover:text-[#ff9f9f]" aria-label={`Remove ${pick.label}`}><span className="material-symbols-outlined text-[17px]">close</span></button></div>)}</div></div>}
  </section>;
};

const SelectedPicksBar = ({ picks, analysis, onRemove, onSubmit, analyzing, gameStarted }: { picks: PickSelection[]; analysis: Record<string, PickAnalysis>; onRemove: (pick: PickSelection) => void; onSubmit: () => void; analyzing: boolean; gameStarted: boolean }) => <section className="sticky bottom-3 z-30 rounded-2xl border border-[#00e6f4]/30 bg-[#08202a]/95 p-3 shadow-2xl backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-extrabold text-white">{picks.length}/{MAX_PICKS} PICKS SELECTED</p><p className="text-[10px] text-[#8fb3bd]">Nothing is locked yet. Mix batter, pitcher and game selections freely.</p></div><button onClick={onSubmit} disabled={!picks.length || analyzing || gameStarted} className="rounded-xl bg-[#65e7e4] px-7 py-3 text-xs font-black text-[#05262b] disabled:opacity-35">{analyzing ? 'ANALYZING…' : gameStarted ? 'GAME STARTED · PICKS LOCKED' : 'SUBMIT PICKS → ANALYZE'}</button></div>{picks.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{picks.map(pick => <div key={pick.id} className="flex shrink-0 items-center gap-2 rounded-lg border border-[#2c5161] bg-[#071722] px-3 py-2"><div><p className="max-w-[260px] truncate text-[10px] font-bold text-white">{pick.label}</p>{analysis[pick.id] && <p className="text-[8px] text-[#65f2b5]">{analysis[pick.id].score}/100</p>}</div><button onClick={() => onRemove(pick)} className="text-[#8192a7] hover:text-white"><span className="material-symbols-outlined text-[16px]">close</span></button></div>)}</div>}</section>;

const StepShell = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => <section className="mt-5 rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-6"><div className="mb-5"><h1 className="text-2xl font-extrabold text-white">{title}</h1><p className="mt-1 text-sm text-[#8495aa]">{subtitle}</p></div>{children}</section>;

const AnalysisCard = ({ pick, analysis }: { pick: PickSelection; analysis?: PickAnalysis }) => <div className="rounded-xl border border-[#293d57] bg-[#08111f] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-white">{pick.label}</p><p className="mt-1 text-[9px] text-[#718198]">{pick.teamName}</p></div>{analysis && <span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${chanceStyle(analysis.chance)}`}>{analysis.chance} · {analysis.score}/100</span>}</div>{analysis ? <><p className="mt-3 text-xs leading-5 text-[#b8c5d5]">{analysis.summary}</p><p className="mt-2 text-[10px] text-[#65f2b5]">{analysis.keyFactor}</p><div className="mt-3 grid grid-cols-2 gap-2">{analysis.stats.slice(0, 4).map(stat => <div key={stat.label} className="rounded-lg border border-[#22344b] bg-[#0d1727] px-2 py-2"><p className="text-[8px] uppercase tracking-wider text-[#65758b]">{stat.label}</p><p className="mt-1 text-[11px] font-bold text-white">{stat.value}</p></div>)}</div></> : <p className="mt-3 text-xs text-[#718198]">Waiting for analysis…</p>}</div>;

const StatsReviewCard = ({ pick, analysis }: { pick: PickSelection; analysis?: PickAnalysis }) => <div className="grid gap-3 rounded-xl border border-[#293d57] bg-[#08111f] p-4 lg:grid-cols-[minmax(260px,.8fr)_1.2fr]"><div><p className="text-sm font-extrabold text-white">{pick.label}</p><p className="mt-1 text-[10px] text-[#718198]">{pick.detail}</p>{analysis && <div className={`mt-3 inline-flex rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${chanceStyle(analysis.chance)}`}>{analysis.chance} · {analysis.score}/100</div>}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(analysis?.stats ?? []).map(stat => <div key={stat.label} className="rounded-lg border border-[#24364e] bg-[#0d1727] p-3"><p className="text-[8px] uppercase tracking-wider text-[#65758b]">{stat.label}</p><p className="mt-1 text-sm font-black text-white">{stat.value}</p></div>)}</div></div>;

const FinalReview = ({ game, picks, analysis }: { game: MlbScheduleGame; picks: PickSelection[]; analysis: Record<string, PickAnalysis> }) => <div className="grid gap-4 xl:grid-cols-[340px_1fr]"><div className="rounded-xl border border-[#293d57] bg-[#08111f] p-4"><div className="flex items-center justify-center gap-4"><TeamBadge team={game.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={game.homeTeam}/></div><p className="mt-3 text-center text-[10px] text-[#718198]">{dateLabel(game.gameDate)} · {timeLabel(game.gameDate)}</p><p className="mt-4 text-center text-2xl font-black text-white">{picks.length} PICKS</p><p className="text-center text-[9px] text-[#718198]">The analysis snapshot is saved when you press GO.</p></div><div className="space-y-2">{picks.map(pick => <div key={pick.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#293d57] bg-[#08111f] px-4 py-3"><div><p className="text-xs font-extrabold text-white">{pick.label}</p><p className="mt-1 text-[9px] text-[#718198]">{pick.teamName}</p></div><span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${chanceStyle(analysis[pick.id]?.chance ?? 'LIMITED DATA')}`}>{analysis[pick.id]?.score ?? 0}/100</span></div>)}</div></div>;

const BottomActions = ({ left, onLeft, right, onRight, disabled }: { left: string; onLeft: () => void; right?: string; onRight?: () => void; disabled?: boolean }) => <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button onClick={onLeft} className="rounded-xl border border-[#30415c] bg-[#10192b] px-5 py-3 text-xs font-black text-[#c3cedc]">← {left}</button>{right && onRight && <button onClick={onRight} disabled={disabled} className="rounded-xl bg-[#65e7e4] px-6 py-3 text-xs font-black text-[#05262b] disabled:opacity-35">{right}</button>}</div>;

const LockedPage = ({ game, card }: { game: MlbScheduleGame; card: any }) => <section className="mt-5 rounded-3xl border border-[#65f2b5]/30 bg-[radial-gradient(circle_at_50%_0%,rgba(101,242,181,.10),transparent_40%),#0d1727] p-6 text-center sm:p-10"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#65f2b5]/50 bg-[#65f2b5]/10 text-[#65f2b5] shadow-[0_0_45px_rgba(101,242,181,.18)]"><span className="material-symbols-outlined text-5xl">check</span></div><h1 className="mt-5 text-3xl font-extrabold text-white">Your Picks Are Locked!</h1><p className="mt-2 text-sm text-[#9eacbe]">ScoutCore saved the analysis snapshot that existed when you pressed GO. Await game results.</p><div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-[#293d57] bg-[#08111f] p-5"><div className="flex items-center justify-center gap-5"><TeamBadge team={game.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={game.homeTeam}/></div><p className="mt-3 text-[10px] text-[#718198]">{dateLabel(game.gameDate)} · {timeLabel(game.gameDate)}</p><div className="mt-5 grid gap-2 text-left sm:grid-cols-2">{(card?.selections ?? []).map((pick: any) => <div key={pick.id} className="rounded-xl border border-[#26364e] bg-[#0d1727] p-3"><p className="text-xs font-bold text-white">{pick.label}</p><p className="mt-1 text-[9px] text-[#65f2b5]">ScoutCore: {pick.chance} · {pick.score}/100</p></div>)}</div></div><p className="mt-5 text-xs text-[#718198]">Results affect accuracy and ScoutCore Points. Incorrect picks do not subtract points.</p></section>;
