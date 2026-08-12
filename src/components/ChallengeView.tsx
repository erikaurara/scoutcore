import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { fetchLiveGameFeed, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { supabase } from '../services/supabaseClient';

type ChallengeTab = 'build' | 'mine' | 'leaderboard';
type MyPicksTab = 'upcoming' | 'finished' | 'statistics';
type PredictionType = 'hitter_hit' | 'hitter_total_base' | 'hitter_reach_base' | 'pitcher_strikeouts' | 'team_winner';
type ResultStatus = 'pending' | 'correct' | 'incorrect' | 'void';
type TicketKind = 'ranked' | 'extra';
type AccountPlan = 'guest' | 'free' | 'premium';

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
  gamePk: number;
  subjectId: number;
  subjectName: string;
  teamId: number;
  teamName: string;
  threshold: number;
  label: string;
  detail: string;
};

type AnalysisStat = { label: string; value: string };

type PickAnalysis = {
  chance: 'STRONG CHANCE' | 'MODERATE CHANCE' | 'LOWER CHANCE' | 'LIMITED DATA';
  score: number;
  summary: string;
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
  best_streak?: number;
};

interface ChallengeViewProps {
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
}

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const LOCAL_KEY = 'scoutcore:challenge-cards:v2';
const OLD_LOCAL_KEY = 'scoutcore:challenge-cards:v1';
const MAX_PICKS = 8;
const WEEKLY_RANKED_TICKETS = 5;
const PREMIUM_EXTRA_TICKETS = 10;

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
const pct = (value: number) => `${Math.round(value)}%`;
const stat3 = (value: unknown) => number(value).toFixed(3).replace(/^0/, '');

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
  const diff = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + diff);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

const chanceFromScore = (score: number): PickAnalysis['chance'] => {
  if (!Number.isFinite(score)) return 'LIMITED DATA';
  if (score >= 70) return 'STRONG CHANCE';
  if (score >= 48) return 'MODERATE CHANCE';
  return 'LOWER CHANCE';
};

const chanceClass = (chance?: PickAnalysis['chance']) => {
  if (chance === 'STRONG CHANCE') return 'border-[#65f2b5]/35 bg-[#65f2b5]/10 text-[#65f2b5]';
  if (chance === 'MODERATE CHANCE') return 'border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffd166]';
  if (chance === 'LOWER CHANCE') return 'border-[#ff8d94]/35 bg-[#ff8d94]/10 text-[#ff9da3]';
  return 'border-[#526275] bg-[#526275]/10 text-[#9ba9b7]';
};

const normalizeSavedCard = (card: any): SavedCard => ({
  ...card,
  weekKey: card.weekKey || weekKeyFor(card.createdAt || new Date()),
  ticketKind: card.ticketKind === 'extra' ? 'extra' : 'ranked',
  selections: Array.isArray(card.selections) ? card.selections.map((selection: any) => ({ ...selection, stats: Array.isArray(selection.stats) ? selection.stats : [] })) : [],
});

const readLocalCards = (): SavedCard[] => {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY) || window.localStorage.getItem(OLD_LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
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

async function fetchRecentLogs(playerId: number, group: 'hitting' | 'pitching', limit = 6) {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=${group}`);
  return (data.stats?.[0]?.splits ?? []).slice(-limit).reverse().map((split: any) => split.stat ?? {});
}

async function fetchRecentTeamGames(teamId: number, limit = 6) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 28);
  const key = (date: Date) => date.toISOString().slice(0, 10);
  const data = await json(`${MLB_API}/schedule?sportId=1&teamId=${teamId}&startDate=${key(start)}&endDate=${key(end)}&hydrate=linescore`);
  return (data.dates ?? [])
    .flatMap((day: any) => day.games ?? [])
    .filter((game: any) => game.status?.abstractGameState === 'Final')
    .sort((a: any, b: any) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
    .slice(0, limit)
    .map((game: any) => {
      const awayId = Number(game.teams?.away?.team?.id);
      const homeId = Number(game.teams?.home?.team?.id);
      const awayRuns = number(game.teams?.away?.score);
      const homeRuns = number(game.teams?.home?.score);
      const isAway = awayId === teamId;
      const teamRuns = isAway ? awayRuns : homeRuns;
      const opponentRuns = isAway ? homeRuns : awayRuns;
      return { won: teamRuns > opponentRuns, teamRuns, opponentRuns, opponentId: isAway ? homeId : awayId };
    });
}

function makePlayerPick(type: PredictionType, player: RosterPlayer, game: MlbScheduleGame, threshold: number): PickSelection {
  const labels: Record<PredictionType, string> = {
    hitter_hit: `${player.name} · 1+ Hit`,
    hitter_total_base: `${player.name} · 1+ Total Base`,
    hitter_reach_base: `${player.name} · Reach Base 1+ Time`,
    pitcher_strikeouts: `${player.name} · ${threshold}+ Strikeouts`,
    team_winner: `${player.teamName} to Win`,
  };
  const details: Record<PredictionType, string> = {
    hitter_hit: 'Records at least one hit in the game.',
    hitter_total_base: 'Records at least one total base from hits.',
    hitter_reach_base: 'Reaches base by hit, walk or hit-by-pitch at least once.',
    pitcher_strikeouts: `Records at least ${threshold} strikeouts.`,
    team_winner: 'Optional game-winner pick.',
  };
  return {
    id: `${game.gamePk}-${type}-${player.id}-${threshold}`,
    type,
    gamePk: game.gamePk,
    subjectId: player.id,
    subjectName: player.name,
    teamId: player.teamId,
    teamName: player.teamName,
    threshold,
    label: labels[type],
    detail: details[type],
  };
}

function makeWinnerPick(team: MlbScheduleGame['awayTeam'], game: MlbScheduleGame): PickSelection {
  return {
    id: `${game.gamePk}-team_winner-${team.id}`,
    type: 'team_winner',
    gamePk: game.gamePk,
    subjectId: team.id,
    subjectName: team.name,
    teamId: team.id,
    teamName: team.name,
    threshold: 1,
    label: `${team.name} to Win`,
    detail: 'Optional winner pick. Team outcomes are treated as more volatile than individual stat picks.',
  };
}

async function analyzeSelection(selection: PickSelection, game: MlbScheduleGame): Promise<PickAnalysis> {
  if (selection.type === 'team_winner') {
    const opponent = game.awayTeam.id === selection.teamId ? game.homeTeam : game.awayTeam;
    const selectedPitcher = game.awayTeam.id === selection.teamId ? game.awayProbablePitcher : game.homeProbablePitcher;
    const opponentPitcher = game.awayTeam.id === selection.teamId ? game.homeProbablePitcher : game.awayProbablePitcher;
    const [teamGames, selectedPitcherStats, opponentPitcherStats] = await Promise.all([
      fetchRecentTeamGames(selection.teamId, 6).catch(() => []),
      selectedPitcher?.id ? fetchSeasonStats(selectedPitcher.id, 'pitching').catch(() => null) : Promise.resolve(null),
      opponentPitcher?.id ? fetchSeasonStats(opponentPitcher.id, 'pitching').catch(() => null) : Promise.resolve(null),
    ]);
    const wins = teamGames.filter((item: any) => item.won).length;
    const recentRate = teamGames.length ? wins / teamGames.length : 0.5;
    const ownEra = selectedPitcherStats ? number(selectedPitcherStats.era) : 0;
    const oppEra = opponentPitcherStats ? number(opponentPitcherStats.era) : 0;
    const starterEdge = ownEra && oppEra ? clamp(50 + (oppEra - ownEra) * 8, 20, 80) : 50;
    const score = clamp(recentRate * 55 + starterEdge * .45);
    return {
      chance: chanceFromScore(score),
      score: Math.round(score),
      summary: `${selection.teamName} is ${wins}-${Math.max(teamGames.length - wins, 0)} over its latest completed games. ScoutCore also compares the probable starters, but team results remain more volatile than individual milestones.`,
      stats: [
        { label: 'Recent record', value: teamGames.length ? `${wins}-${teamGames.length - wins}` : '—' },
        { label: `${selectedPitcher?.name ?? 'Selected starter'} ERA`, value: ownEra ? ownEra.toFixed(2) : '—' },
        { label: `${opponentPitcher?.name ?? `${opponent.name} starter`} ERA`, value: oppEra ? oppEra.toFixed(2) : '—' },
      ],
    };
  }

  if (selection.type === 'pitcher_strikeouts') {
    const [season, recent] = await Promise.all([
      fetchSeasonStats(selection.subjectId, 'pitching').catch(() => ({})),
      fetchRecentLogs(selection.subjectId, 'pitching', 6).catch(() => []),
    ]);
    if (!recent.length && !Object.keys(season).length) return { chance: 'LIMITED DATA', score: 0, summary: 'ScoutCore does not have enough verified pitching data to rate this selection yet.', stats: [] };
    const successes = recent.filter((stat: any) => number(stat.strikeOuts) >= selection.threshold).length;
    const recentRate = recent.length ? successes / recent.length : .5;
    const k9 = number(season.strikeoutsPer9Inn);
    const era = number(season.era);
    const whip = number(season.whip);
    const kScore = k9 ? clamp(k9 * 8.5) : 50;
    const score = clamp(recentRate * 68 + kScore * .32);
    return {
      chance: chanceFromScore(score),
      score: Math.round(score),
      summary: `${selection.subjectName} reached ${selection.threshold}+ strikeouts in ${successes} of the last ${recent.length || 'available'} tracked starts/appearances. ScoutCore weighs recent strikeout results most heavily for this pick.`,
      stats: [
        { label: `Last ${recent.length || 0}`, value: recent.length ? `${successes}/${recent.length} reached ${selection.threshold}+ K` : '—' },
        { label: 'Season K/9', value: k9 ? k9.toFixed(2) : '—' },
        { label: 'Season ERA', value: era ? era.toFixed(2) : '—' },
        { label: 'Season WHIP', value: whip ? whip.toFixed(2) : '—' },
      ],
    };
  }

  const [season, recent] = await Promise.all([
    fetchSeasonStats(selection.subjectId, 'hitting').catch(() => ({})),
    fetchRecentLogs(selection.subjectId, 'hitting', 6).catch(() => []),
  ]);
  if (!recent.length && !Object.keys(season).length) return { chance: 'LIMITED DATA', score: 0, summary: 'ScoutCore does not have enough verified hitting data to rate this selection yet.', stats: [] };

  const success = (stat: any) => {
    if (selection.type === 'hitter_hit') return number(stat.hits) >= 1;
    if (selection.type === 'hitter_total_base') return number(stat.totalBases) >= 1;
    return number(stat.hits) + number(stat.baseOnBalls) + number(stat.hitByPitch) >= 1;
  };
  const successes = recent.filter(success).length;
  const recentRate = recent.length ? successes / recent.length : .5;
  const avg = number(season.avg);
  const obp = number(season.obp);
  const slg = number(season.slg);
  const ops = number(season.ops);
  const seasonSignal = selection.type === 'hitter_hit'
    ? clamp(avg * 220)
    : selection.type === 'hitter_total_base'
      ? clamp(slg * 125)
      : clamp(obp * 180);
  const score = clamp(recentRate * 70 + seasonSignal * .30);
  const seasonText = selection.type === 'hitter_hit'
    ? `AVG ${avg ? stat3(avg) : '—'}`
    : selection.type === 'hitter_total_base'
      ? `SLG ${slg ? stat3(slg) : '—'}`
      : `OBP ${obp ? stat3(obp) : '—'}`;
  return {
    chance: chanceFromScore(score),
    score: Math.round(score),
    summary: `${selection.subjectName} cleared this line in ${successes} of the last ${recent.length || 'available'} tracked games. Season ${seasonText}. Recent results and the relevant season rate drive this informational rating.`,
    stats: [
      { label: `Last ${recent.length || 0}`, value: recent.length ? `${successes}/${recent.length} cleared` : '—' },
      { label: 'AVG', value: avg ? stat3(avg) : '—' },
      { label: 'OBP', value: obp ? stat3(obp) : '—' },
      { label: 'SLG', value: slg ? stat3(slg) : '—' },
      { label: 'OPS', value: ops ? stat3(ops) : '—' },
    ],
  };
}

function cardStats(cards: SavedCard[]) {
  const settledSelections = cards.flatMap(card => card.selections).filter(selection => selection.result === 'correct' || selection.result === 'incorrect');
  const correct = settledSelections.filter(selection => selection.result === 'correct').length;
  const total = settledSelections.length;
  const points = cards.reduce((sum, card) => sum + number(card.points), 0);
  const chronological = [...cards]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .flatMap(card => card.selections)
    .filter(selection => selection.result === 'correct' || selection.result === 'incorrect');
  let streak = 0; let bestStreak = 0;
  for (const selection of chronological) {
    if (selection.result === 'correct') { streak += 1; bestStreak = Math.max(bestStreak, streak); }
    else streak = 0;
  }
  let currentStreak = 0;
  for (const selection of [...chronological].reverse()) {
    if (selection.result !== 'correct') break;
    currentStreak += 1;
  }
  return { correct, total, accuracy: total ? Math.round((correct / total) * 100) : 0, points, currentStreak, bestStreak };
}

async function settleCard(card: SavedCard): Promise<SavedCard> {
  if (card.status === 'finished') return card;
  const feed = await fetchLiveGameFeed(card.gamePk).catch(() => null);
  const status = feed?.gameData?.status;
  if (!feed || (status?.abstractGameState !== 'Final' && status?.detailedState !== 'Final')) return card;

  const boxTeams = feed?.liveData?.boxscore?.teams ?? {};
  const findPlayer = (id: number) => boxTeams.away?.players?.[`ID${id}`] ?? boxTeams.home?.players?.[`ID${id}`] ?? null;
  const awayRuns = number(feed?.liveData?.linescore?.teams?.away?.runs);
  const homeRuns = number(feed?.liveData?.linescore?.teams?.home?.runs);
  const winnerId = awayRuns === homeRuns ? null : awayRuns > homeRuns ? card.awayTeam.id : card.homeTeam.id;

  const selections = card.selections.map(selection => {
    let value: number | null = null;
    let passed: boolean | null = null;
    if (selection.type === 'team_winner') {
      if (winnerId === null) return { ...selection, result: 'void' as ResultStatus, resultValue: null };
      value = winnerId;
      passed = selection.teamId === winnerId;
    } else {
      const player = findPlayer(selection.subjectId);
      if (!player) return { ...selection, result: 'void' as ResultStatus, resultValue: null };
      if (selection.type === 'pitcher_strikeouts') value = number(player.stats?.pitching?.strikeOuts);
      if (selection.type === 'hitter_hit') value = number(player.stats?.batting?.hits);
      if (selection.type === 'hitter_total_base') value = number(player.stats?.batting?.totalBases);
      if (selection.type === 'hitter_reach_base') value = number(player.stats?.batting?.hits) + number(player.stats?.batting?.baseOnBalls) + number(player.stats?.batting?.hitByPitch);
      passed = value >= selection.threshold;
    }
    return { ...selection, result: passed ? 'correct' as ResultStatus : 'incorrect' as ResultStatus, resultValue: value };
  });

  const settled = selections.filter(selection => selection.result === 'correct' || selection.result === 'incorrect');
  const correctCount = settled.filter(selection => selection.result === 'correct').length;
  const perfectBonus = settled.length > 1 && settled.every(selection => selection.result === 'correct') ? 5 : 0;
  return {
    ...card,
    status: 'finished',
    selections,
    correctCount,
    settledCount: settled.length,
    points: card.ticketKind === 'ranked' ? correctCount * 10 + perfectBonus : 0,
  };
}

export const ChallengeView: React.FC<ChallengeViewProps> = ({ signedIn, userEmail, onOpenAuth }) => {
  const [tab, setTab] = useState<ChallengeTab>('build');
  const [myTab, setMyTab] = useState<MyPicksTab>('upcoming');
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
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
  const currentWeekKey = useMemo(() => weekKeyFor(new Date()), []);

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
      const premium = metadata.plan === 'premium' || metadata.subscription_tier === 'premium' || metadata.is_premium === true;
      setPlan(premium ? 'premium' : 'free');
    });
  }, [signedIn, userEmail]);

  useEffect(() => {
    if (!games.length || !favoriteTeamId || selectedGamePk) return;
    const favoriteGame = games.find(game => game.awayTeam.id === favoriteTeamId || game.homeTeam.id === favoriteTeamId);
    if (favoriteGame) setSelectedGamePk(favoriteGame.gamePk);
  }, [games, favoriteTeamId, selectedGamePk]);

  useEffect(() => {
    if (!selectedGame) return;
    setRosterLoading(true);
    setSelectedPicks([]);
    setAnalysis({});
    Promise.all([
      fetchTeamRoster(selectedGame.awayTeam.id, selectedGame.awayTeam.name).catch(() => []),
      fetchTeamRoster(selectedGame.homeTeam.id, selectedGame.homeTeam.name).catch(() => []),
    ]).then(([away, home]) => {
      setAwayRoster(away);
      setHomeRoster(home);
    }).finally(() => setRosterLoading(false));
  }, [selectedGamePk]);

  useEffect(() => {
    if (!supabase || !signedIn) return;
    supabase.from('challenge_scores')
      .select('user_id,display_name,points,correct_picks,total_picks,best_streak')
      .order('points', { ascending: false })
      .order('correct_picks', { ascending: false })
      .limit(50)
      .then(({ data }) => setLeaderboard((data ?? []) as LeaderboardRow[]));
  }, [signedIn, tab]);

  const orderedGames = useMemo(() => [...games].sort((a, b) => {
    const aFav = favoriteTeamId && (a.awayTeam.id === favoriteTeamId || a.homeTeam.id === favoriteTeamId);
    const bFav = favoriteTeamId && (b.awayTeam.id === favoriteTeamId || b.homeTeam.id === favoriteTeamId);
    if (Boolean(aFav) !== Boolean(bFav)) return aFav ? -1 : 1;
    return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
  }), [games, favoriteTeamId]);

  const hitters = useMemo(() => [...awayRoster, ...homeRoster].filter(player => player.position !== 'P'), [awayRoster, homeRoster]);
  const probablePitchers = useMemo(() => {
    if (!selectedGame) return [];
    return [
      selectedGame.awayProbablePitcher ? { id: selectedGame.awayProbablePitcher.id, name: selectedGame.awayProbablePitcher.name, position: 'P', teamId: selectedGame.awayTeam.id, teamName: selectedGame.awayTeam.name } : null,
      selectedGame.homeProbablePitcher ? { id: selectedGame.homeProbablePitcher.id, name: selectedGame.homeProbablePitcher.name, position: 'P', teamId: selectedGame.homeTeam.id, teamName: selectedGame.homeTeam.name } : null,
    ].filter(Boolean) as RosterPlayer[];
  }, [selectedGame]);

  const cardsThisWeek = useMemo(() => cards.filter(card => (card.weekKey || weekKeyFor(card.createdAt)) === currentWeekKey), [cards, currentWeekKey]);
  const rankedUsed = cardsThisWeek.filter(card => card.ticketKind !== 'extra').length;
  const extraUsed = cardsThisWeek.filter(card => card.ticketKind === 'extra').length;
  const rankedRemaining = signedIn ? Math.max(0, WEEKLY_RANKED_TICKETS - rankedUsed) : 0;
  const extraRemaining = plan === 'premium' ? Math.max(0, PREMIUM_EXTRA_TICKETS - extraUsed) : 0;
  const nextTicketKind: TicketKind | null = rankedRemaining > 0 ? 'ranked' : extraRemaining > 0 ? 'extra' : null;
  const totalRemaining = rankedRemaining + extraRemaining;
  const analysisReady = selectedPicks.length > 0 && selectedPicks.every(pick => Boolean(analysis[pick.id]));
  const gameStarted = selectedGame ? new Date(selectedGame.gameDate).getTime() <= Date.now() : false;

  const cardStrength = useMemo(() => {
    if (!analysisReady) return null;
    const values = selectedPicks.map(pick => analysis[pick.id]?.score ?? 0).filter(value => value > 0);
    if (!values.length) return { label: 'LIMITED DATA', score: 0 };
    const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const label = score >= 70 ? 'STRONG SUPPORT' : score >= 48 ? 'MODERATE SUPPORT' : 'LOWER SUPPORT';
    return { label, score };
  }, [analysis, analysisReady, selectedPicks]);

  const togglePick = (pick: PickSelection) => {
    if (!signedIn) {
      onOpenAuth();
      return;
    }
    setMessage(null);
    setAnalysis({});
    setSelectedPicks(current => {
      if (current.some(item => item.id === pick.id)) return current.filter(item => item.id !== pick.id);
      if (pick.type === 'team_winner') {
        const withoutWinner = current.filter(item => item.type !== 'team_winner');
        return withoutWinner.length >= MAX_PICKS ? withoutWinner : [...withoutWinner, pick];
      }
      if (current.length >= MAX_PICKS) {
        setMessage(`Choose up to ${MAX_PICKS} predictions on one Challenge Card.`);
        return current;
      }
      return [...current, pick];
    });
  };

  const analyzeAll = async () => {
    if (!signedIn) {
      onOpenAuth();
      return;
    }
    if (!selectedGame || !selectedPicks.length) return;
    setAnalyzing(true);
    setMessage(null);
    const entries = await Promise.all(selectedPicks.map(async pick => [pick.id, await analyzeSelection(pick, selectedGame).catch(() => ({ chance: 'LIMITED DATA' as const, score: 0, summary: 'ScoutCore could not load enough verified data for this selection right now.', stats: [] }))] as const));
    setAnalysis(Object.fromEntries(entries));
    setAnalyzing(false);
  };

  const lockPrediction = async () => {
    if (!signedIn) {
      onOpenAuth();
      return;
    }
    if (!selectedGame || !selectedPicks.length) return;
    if (gameStarted) {
      setMessage('This game has already started, so new Challenge predictions are locked.');
      return;
    }
    if (!analysisReady) {
      setMessage('Analyze every selection and review the statistics before pressing GO.');
      return;
    }
    if (!nextTicketKind) {
      setMessage(plan === 'premium' ? 'You used all 15 Challenge Tickets for this week. Tickets reset on Monday.' : 'You used all 5 ranked Challenge Tickets for this week. Tickets reset on Monday.');
      return;
    }

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

    let synced = false;
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
      synced = !error;
    }

    const ticketText = nextTicketKind === 'ranked'
      ? '1 ranked ticket used. This card can earn leaderboard points.'
      : '1 Premium extra ticket used. This card counts toward your personal statistics but not leaderboard points.';
    setMessage(synced ? `Prediction locked. ${ticketText}` : `Prediction locked on this device. ${ticketText} Account sync will activate when the Challenge backend is published.`);
    setSelectedPicks([]);
    setAnalysis({});
    setTab('mine');
    setMyTab('upcoming');
  };

  const refreshResults = async () => {
    setRefreshingResults(true);
    const updated = await Promise.all(cards.map(card => settleCard(card)));
    setCards(updated);
    writeLocalCards(updated);
    setRefreshingResults(false);
  };

  const ownStats = useMemo(() => cardStats(cards), [cards]);
  const rankedStats = useMemo(() => cardStats(cards.filter(card => card.ticketKind !== 'extra')), [cards]);
  const monthCutoff = useMemo(() => Date.now() - 30 * 24 * 60 * 60 * 1000, []);
  const monthStats = useMemo(() => cardStats(cards.filter(card => new Date(card.createdAt).getTime() >= monthCutoff)), [cards, monthCutoff]);
  const upcomingCards = cards.filter(card => card.status === 'upcoming');
  const finishedCards = cards.filter(card => card.status === 'finished');
  const myRank = leaderboard.findIndex(row => row.user_id === userId) + 1;

  return <div className="min-h-screen bg-[#07101f] text-[#dae2fd] p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="rounded-2xl border border-[#23405f] bg-[radial-gradient(circle_at_top_left,rgba(0,240,255,.08),transparent_38%),#0d1729] p-5 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em]"><span className="text-[#65f2b5]">ScoutCore Challenge</span><span className="rounded-full border border-[#30415c] px-2.5 py-1 text-[#91a0b5]">No money</span><span className="rounded-full border border-[#30415c] px-2.5 py-1 text-[#91a0b5]">No odds</span><span className="rounded-full border border-[#30415c] px-2.5 py-1 text-[#91a0b5]">No prizes</span></div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white">Analyze it first. Review the stats. Then GO.</h1>
            <p className="mt-2 max-w-3xl text-sm sm:text-base leading-7 text-[#aebbd0]">Build a baseball prediction card, let ScoutCore analyze every selection using verified MLB data, review the supporting statistics, and only then lock it as your official prediction.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0 xl:min-w-[520px]">
            <MiniMetric label="WEEKLY TICKETS" value={signedIn ? totalRemaining : 0}/>
            <MiniMetric label="RANKED POINTS" value={rankedStats.points}/>
            <MiniMetric label="ACCURACY" value={ownStats.total ? `${ownStats.accuracy}%` : '—'}/>
            <MiniMetric label="RANK" value={myRank ? `#${myRank}` : '—'}/>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          {!signedIn ? <span className="rounded-full border border-[#ffd166]/35 bg-[#ffd166]/10 px-3 py-1.5 text-[#ffd166]">Guest · 0 tickets · account required to play</span> : <>
            <span className="rounded-full border border-[#00f0ff]/35 bg-[#00f0ff]/10 px-3 py-1.5 text-[#7df4ff]">🎟 Ranked {rankedRemaining}/{WEEKLY_RANKED_TICKETS}</span>
            {plan === 'premium' && <span className="rounded-full border border-[#b69cff]/35 bg-[#b69cff]/10 px-3 py-1.5 text-[#d5c6ff]">Premium Extra {extraRemaining}/{PREMIUM_EXTRA_TICKETS}</span>}
            <span className="text-[#718090]">Tickets reset every Monday. Extra Premium tickets are unranked.</span>
          </>}
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-[#26364d] pb-3">
        {([['build','BUILD PICKS'],['mine','MY PICKS'],['leaderboard','LEADERBOARD']] as [ChallengeTab,string][]).map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-extrabold tracking-wide ${tab === id ? 'bg-[#00f0ff] text-[#00363a]' : 'border border-[#30415c] bg-[#10192b] text-[#aebbd0] hover:border-[#00f0ff]/45 hover:text-white'}`}>{label}</button>)}
      </div>

      {tab === 'build' && !signedIn && <section className="rounded-2xl border border-[#31506f] bg-[#0f182b] p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-[#00f0ff]">confirmation_number</span>
        <h2 className="mt-4 text-2xl font-bold text-white">Challenge Tickets are for ScoutCore accounts</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#91a0b5]">Guests can view the leaderboard, but building, analyzing and locking predictions requires an account. Free accounts receive 5 ranked Challenge Tickets each week.</p>
        <button onClick={onOpenAuth} className="mt-5 rounded-xl bg-[#00f0ff] px-6 py-3 text-sm font-extrabold text-[#00363a]">LOG IN OR CREATE ACCOUNT</button>
      </section>}

      {tab === 'build' && signedIn && <>
        <section>
          <div className="flex items-end justify-between gap-3 mb-3"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#65f2b5]">1 · Choose a game</p><h2 className="mt-1 text-xl font-bold text-white">Today's MLB games</h2></div><span className="text-xs text-[#718090]">Favorite-team game appears first.</span></div>
          <div className="flex gap-3 overflow-x-auto pb-2">{orderedGames.map(game => { const active = selectedGamePk === game.gamePk; const favorite = Boolean(favoriteTeamId && (game.awayTeam.id === favoriteTeamId || game.homeTeam.id === favoriteTeamId)); return <button key={game.gamePk} onClick={() => setSelectedGamePk(game.gamePk)} className={`min-w-[245px] rounded-xl border p-4 text-left transition ${active ? 'border-[#00f0ff] bg-[#00f0ff]/8' : favorite ? 'border-[#00f0ff]/35 bg-[#101c31]' : 'border-[#2d3b52] bg-[#10192b] hover:border-[#58708d]'}`}><div className="flex items-center justify-between"><span className="text-[10px] text-[#91a0b5]">{gameDateLabel(game.gameDate)} · {gameTime(game.gameDate)}</span>{favorite && <span className="material-symbols-outlined text-[#00f0ff] text-lg" style={{fontVariationSettings:"'FILL' 1"}}>star</span>}</div><div className="mt-4 flex items-center justify-between gap-3"><TeamMini team={game.awayTeam}/><span className="text-[#596879]">@</span><TeamMini team={game.homeTeam}/></div></button>; })}</div>
        </section>

        {selectedGame && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#65f2b5]">2 · Build your card</p><h2 className="mt-1 text-xl font-bold text-white">Choose the milestones you want to predict</h2><p className="mt-1 text-sm text-[#91a0b5]">Up to {MAX_PICKS} selections. Changing a pick clears the previous analysis so ScoutCore can recalculate it.</p></div><span className="rounded-lg border border-[#30415c] px-3 py-2 text-xs text-[#aebbd0]">{selectedPicks.length}/{MAX_PICKS}</span></div>

              {rosterLoading ? <div className="mt-6 rounded-xl bg-[#10192b] p-6 text-center text-sm text-[#91a0b5]">Loading active rosters…</div> : <>
                <div className="mt-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#8ea1b7]">Hitter picks</p><div className="mt-3 grid gap-3 md:grid-cols-2">{hitters.map(player => <PlayerPickRow key={player.id} player={player} selected={selectedPicks} onToggle={togglePick} game={selectedGame}/>)}</div></div>
                <div className="mt-7"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#8ea1b7]">Probable pitcher strikeout picks</p><div className="mt-3 grid gap-3 md:grid-cols-2">{probablePitchers.map(player => <PitcherPickRow key={player.id} player={player} selected={selectedPicks} onToggle={togglePick} game={selectedGame}/>)}{!probablePitchers.length && <div className="rounded-xl border border-dashed border-[#40516b] p-5 text-sm text-[#91a0b5]">Probable pitchers are not posted yet.</div>}</div></div>
              </>}
            </section>

            <section className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#65f2b5]">3 · Optional</p><h2 className="mt-1 text-xl font-bold text-white">Who will win?</h2><p className="mt-1 text-sm text-[#91a0b5]">You can leave this blank. Team-result predictions are analyzed separately because they are more volatile.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{[selectedGame.awayTeam, selectedGame.homeTeam].map(team => { const pick = makeWinnerPick(team, selectedGame); const active = selectedPicks.some(item => item.id === pick.id); return <button key={team.id} onClick={() => togglePick(pick)} className={`rounded-xl border p-4 flex items-center gap-4 text-left ${active ? 'border-[#00f0ff] bg-[#00f0ff]/10' : 'border-[#30415c] bg-[#10192b] hover:border-[#00f0ff]/45'}`}><div className="h-14 w-14 rounded-xl bg-[#e7ebf0] p-2"><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-full w-full object-contain"/></div><div className="flex-1"><div className="font-bold text-white">{team.name}</div><div className="text-xs text-[#91a0b5]">Optional winner prediction</div></div><span className={`material-symbols-outlined ${active ? 'text-[#00f0ff]' : 'text-[#526275]'}`}>{active ? 'check_circle' : 'circle'}</span></button>; })}</div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-20 h-fit rounded-2xl border border-[#31506f] bg-[#0b1425] overflow-hidden">
            <div className="border-b border-[#26364d] px-5 py-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#65f2b5]">Your Challenge Card</p><h2 className="mt-1 text-xl font-bold text-white">{selectedGame.awayTeam.abbreviation ?? selectedGame.awayTeam.name} @ {selectedGame.homeTeam.abbreviation ?? selectedGame.homeTeam.name}</h2></div><span className="material-symbols-outlined text-[#00f0ff]">fact_check</span></div></div>
            <div className="p-4 space-y-3">
              {selectedPicks.length ? selectedPicks.map(pick => <div key={pick.id} className="rounded-xl border border-[#2d3b52] bg-[#10192b] p-3">
                <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-white">{pick.label}</div><div className="mt-1 text-[11px] text-[#849495]">{pick.detail}</div></div><button onClick={() => togglePick(pick)} className="text-[#718090] hover:text-[#ff9da3]"><span className="material-symbols-outlined text-lg">close</span></button></div>
                {analysis[pick.id] && <div className="mt-3 border-t border-[#26364d] pt-3"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${chanceClass(analysis[pick.id].chance)}`}>{analysis[pick.id].chance}</span><span className="text-[10px] font-bold text-[#8ea1b7]">SCOUTCORE {analysis[pick.id].score || '—'}/100</span></div><p className="mt-2 text-xs leading-5 text-[#aebbd0]">{analysis[pick.id].summary}</p>{analysis[pick.id].stats?.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{analysis[pick.id].stats.map(stat => <div key={`${pick.id}-${stat.label}`} className="rounded-lg border border-[#28384f] bg-[#0b1425] px-2.5 py-2"><div className="text-[9px] uppercase tracking-wide text-[#718090]">{stat.label}</div><div className="mt-0.5 text-xs font-bold text-white">{stat.value}</div></div>)}</div>}</div>}
              </div>) : <div className="rounded-xl border border-dashed border-[#40516b] p-6 text-center"><span className="material-symbols-outlined text-3xl text-[#526275]">playlist_add</span><p className="mt-2 text-sm text-[#91a0b5]">Add player predictions to build your card.</p></div>}

              {analysisReady && cardStrength && <div className="rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/5 p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#65f2b5]">4 · Review</div><div className="mt-1 font-bold text-white">Card summary: {cardStrength.label}</div></div><div className="text-xl font-extrabold text-[#65f2b5]">{cardStrength.score}/100</div></div><p className="mt-2 text-xs leading-5 text-[#aebbd0]">This is the average strength of ScoutCore's individual selection ratings, not a combined outcome probability. Review each statistic above and edit anything you do not want to lock.</p></div>}

              <div className="rounded-xl border border-[#30415c] bg-[#0f182b] p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#8ea1b7]">Ticket used when you press GO</div><div className="mt-1 text-sm font-bold text-white">{nextTicketKind === 'ranked' ? '🎟 1 Ranked Ticket' : nextTicketKind === 'extra' ? '🎟 1 Premium Extra Ticket' : 'No tickets remaining'}</div></div><div className="text-right"><div className="text-[10px] text-[#718090]">THIS WEEK</div><div className="font-bold text-[#00f0ff]">{totalRemaining} left</div></div></div>{nextTicketKind === 'extra' && <p className="mt-2 text-[10px] leading-4 text-[#b9a8e8]">Extra tickets count toward your personal prediction statistics, but not leaderboard points or rank.</p>}</div>

              {message && <div className="rounded-xl border border-[#00f0ff]/25 bg-[#00f0ff]/5 p-3 text-xs leading-5 text-[#bceff4]">{message}</div>}
              <button disabled={!selectedPicks.length || analyzing} onClick={analyzeAll} className="w-full rounded-xl border border-[#00f0ff]/40 bg-[#00f0ff]/10 px-4 py-3 text-sm font-extrabold text-[#00f0ff] hover:bg-[#00f0ff]/16 disabled:opacity-40">{analyzing ? 'ANALYZING VERIFIED MLB DATA…' : analysisReady ? 'RE-ANALYZE MY PICKS' : 'ANALYZE MY PICKS'}</button>
              <button disabled={!analysisReady || !nextTicketKind || gameStarted} onClick={lockPrediction} className="w-full rounded-xl bg-[#65e8f7] px-4 py-3.5 text-sm font-extrabold text-[#03242b] hover:brightness-105 disabled:opacity-35">{gameStarted ? 'GAME STARTED · PICKS LOCKED' : 'GO — LOCK MY PICKS'}</button>
              <p className="text-center text-[10px] leading-4 text-[#718090]">You can edit freely before GO. Pressing GO makes this your official ScoutCore prediction and consumes one weekly ticket. Challenge Points have no cash value.</p>
            </div>
          </aside>
        </div>}
      </>}

      {tab === 'mine' && !signedIn && <section className="rounded-2xl border border-[#31506f] bg-[#0f182b] p-8 text-center"><span className="material-symbols-outlined text-5xl text-[#00f0ff]">person</span><h2 className="mt-4 text-2xl font-bold text-white">Log in to see My Picks</h2><p className="mt-2 text-sm text-[#91a0b5]">Your locked Challenge predictions and personal statistics belong to your ScoutCore account.</p><button onClick={onOpenAuth} className="mt-5 rounded-xl bg-[#00f0ff] px-6 py-3 text-sm font-extrabold text-[#00363a]">LOG IN</button></section>}

      {tab === 'mine' && signedIn && <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h2 className="text-2xl font-bold text-white">My Picks</h2><p className="mt-1 text-sm text-[#91a0b5]">Track locked predictions, finished results, weekly ticket use and your statistics.</p></div><button onClick={refreshResults} disabled={refreshingResults} className="rounded-xl border border-[#30415c] bg-[#10192b] px-4 py-2.5 text-xs font-bold text-[#00f0ff] hover:border-[#00f0ff]/45 disabled:opacity-50">{refreshingResults ? 'CHECKING RESULTS…' : 'REFRESH RESULTS'}</button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniMetric label="RANKED LEFT" value={`${rankedRemaining}/${WEEKLY_RANKED_TICKETS}`}/><MiniMetric label="EXTRA LEFT" value={plan === 'premium' ? `${extraRemaining}/${PREMIUM_EXTRA_TICKETS}` : '—'}/><MiniMetric label="WEEKLY USED" value={cardsThisWeek.length}/><MiniMetric label="CURRENT STREAK" value={ownStats.currentStreak}/></div>
        <div className="mt-5 flex gap-2 overflow-x-auto">{([['upcoming','UPCOMING'],['finished','FINISHED'],['statistics','STATISTICS']] as [MyPicksTab,string][]).map(([id,label]) => <button key={id} onClick={() => setMyTab(id)} className={`rounded-xl px-4 py-2.5 text-xs font-bold ${myTab === id ? 'bg-white text-[#07101f]' : 'border border-[#30415c] bg-[#10192b] text-[#aebbd0]'}`}>{label}</button>)}</div>
        {myTab === 'upcoming' && <div className="mt-5 space-y-4">{upcomingCards.map(card => <SavedCardView key={card.id} card={card}/>) }{!upcomingCards.length && <EmptyState icon="event_upcoming" title="No upcoming Challenge predictions" copy="Build a card, analyze the statistics and press GO to lock your first prediction."/>}</div>}
        {myTab === 'finished' && <div className="mt-5 space-y-4">{finishedCards.map(card => <SavedCardView key={card.id} card={card}/>) }{!finishedCards.length && <EmptyState icon="task_alt" title="No finished cards yet" copy="Use Refresh Results after your games finish to score your Challenge predictions."/>}</div>}
        {myTab === 'statistics' && <div className="mt-5 grid gap-5 lg:grid-cols-3"><StatsPanel title="Last 30 days" stats={monthStats} rank={myRank}/><StatsPanel title="All predictions" stats={ownStats} rank={myRank}/><StatsPanel title="Ranked only" stats={rankedStats} rank={myRank}/></div>}
      </section>}

      {tab === 'leaderboard' && <section>
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#65f2b5]">ScoutCore Community</p><h2 className="mt-1 text-2xl font-bold text-white">Challenge Leaderboard</h2><p className="mt-1 max-w-3xl text-sm text-[#91a0b5]">Everyone gets the same 5 ranked tickets each week. Premium's 10 extra tickets are personal-only, so paying never gives more leaderboard attempts.</p></div>
        <div className="mt-5 rounded-2xl border border-[#2d3b52] bg-[#0f182b] overflow-hidden">
          <div className="grid grid-cols-[54px_minmax(0,1fr)_80px_90px_90px] gap-3 border-b border-[#2d3b52] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#718090]"><span>Rank</span><span>User</span><span>Correct</span><span>Accuracy</span><span>Points</span></div>
          {leaderboard.length ? leaderboard.map((row,index) => { const total = number(row.total_picks); const correct = number(row.correct_picks); return <div key={row.user_id ?? index} className={`grid grid-cols-[54px_minmax(0,1fr)_80px_90px_90px] gap-3 items-center border-b border-[#26364d]/70 px-4 py-4 last:border-0 ${row.user_id === userId ? 'bg-[#00f0ff]/6' : ''}`}><span className={`font-bold ${index < 3 ? 'text-[#ffd166]' : 'text-[#aebbd0]'}`}>#{index + 1}</span><div className="min-w-0"><div className="truncate font-bold text-white">{row.display_name || 'ScoutCore User'}</div>{row.user_id === userId && <div className="text-[10px] text-[#00f0ff]">YOU</div>}</div><span>{correct}</span><span>{total ? pct((correct / total) * 100) : '—'}</span><span className="font-bold text-[#65f2b5]">{number(row.points)}</span></div>; }) : <div className="p-8 text-center"><span className="material-symbols-outlined text-4xl text-[#526275]">leaderboard</span><h3 className="mt-3 font-bold text-white">Leaderboard backend is staged for launch</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#91a0b5]">The interface is ready. Cross-user rankings will populate after the Challenge database migration and secure result-settling job are published with the final release.</p></div>}
        </div>
      </section>}
    </div>
  </div>;
};

const TeamMini = ({ team }: { team: MlbScheduleGame['awayTeam'] }) => <div className="min-w-0 flex items-center gap-2"><div className="h-9 w-9 shrink-0 rounded-lg bg-[#e7ebf0] p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-full w-full object-contain"/></div><span className="truncate text-sm font-bold text-white">{team.abbreviation ?? team.name}</span></div>;

const PlayerPickRow = ({ player, selected, onToggle, game }: { player: RosterPlayer; selected: PickSelection[]; onToggle: (pick: PickSelection) => void; game: MlbScheduleGame }) => {
  const options: { type: PredictionType; threshold: number; short: string }[] = [
    { type: 'hitter_hit', threshold: 1, short: '1+ HIT' },
    { type: 'hitter_total_base', threshold: 1, short: '1+ TB' },
    { type: 'hitter_reach_base', threshold: 1, short: 'REACH BASE' },
  ];
  return <div className="rounded-xl border border-[#2d3b52] bg-[#10192b] p-3"><div className="flex items-center gap-3"><div className="h-12 w-12 overflow-hidden rounded-xl bg-[#18233a]"><img src={mlbPlayerHeadshotUrl(player.id,120)} alt="" className="h-full w-full object-contain object-bottom"/></div><div className="min-w-0"><div className="truncate font-bold text-white">{player.name}</div><div className="text-[10px] uppercase tracking-wider text-[#718090]">{player.teamName} · {player.position || 'HITTER'}</div></div></div><div className="mt-3 flex flex-wrap gap-2">{options.map(option => { const pick = makePlayerPick(option.type, player, game, option.threshold); const active = selected.some(item => item.id === pick.id); return <button key={option.type} onClick={() => onToggle(pick)} className={`rounded-lg border px-2.5 py-2 text-[10px] font-extrabold ${active ? 'border-[#00f0ff] bg-[#00f0ff] text-[#00363a]' : 'border-[#30415c] bg-[#0b1425] text-[#aebbd0] hover:border-[#00f0ff]/45'}`}>{option.short}</button>; })}</div></div>;
};

const PitcherPickRow = ({ player, selected, onToggle, game }: { player: RosterPlayer; selected: PickSelection[]; onToggle: (pick: PickSelection) => void; game: MlbScheduleGame }) => <div className="rounded-xl border border-[#2d3b52] bg-[#10192b] p-3"><div className="flex items-center gap-3"><div className="h-14 w-14 overflow-hidden rounded-xl bg-[#18233a]"><img src={mlbPlayerHeadshotUrl(player.id,140)} alt="" className="h-full w-full object-contain object-bottom"/></div><div><div className="font-bold text-white">{player.name}</div><div className="text-[10px] uppercase tracking-wider text-[#718090]">{player.teamName} · PROBABLE STARTER</div></div></div><div className="mt-3 flex gap-2">{[4,6,8].map(threshold => { const pick = makePlayerPick('pitcher_strikeouts', player, game, threshold); const active = selected.some(item => item.id === pick.id); return <button key={threshold} onClick={() => onToggle(pick)} className={`flex-1 rounded-lg border px-2 py-2 text-[10px] font-extrabold ${active ? 'border-[#00f0ff] bg-[#00f0ff] text-[#00363a]' : 'border-[#30415c] bg-[#0b1425] text-[#aebbd0] hover:border-[#00f0ff]/45'}`}>{threshold}+ K</button>; })}</div></div>;

const SavedCardView = ({ card }: { card: SavedCard }) => <div className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d3b52] px-5 py-4"><div className="flex items-center gap-3"><div className="flex -space-x-2"><div className="h-10 w-10 rounded-full bg-[#e7ebf0] p-1.5 ring-2 ring-[#0f182b]"><img src={mlbTeamLogoUrl(card.awayTeam.id)} alt="" className="h-full w-full object-contain"/></div><div className="h-10 w-10 rounded-full bg-[#e7ebf0] p-1.5 ring-2 ring-[#0f182b]"><img src={mlbTeamLogoUrl(card.homeTeam.id)} alt="" className="h-full w-full object-contain"/></div></div><div><div className="font-bold text-white">{card.awayTeam.name} @ {card.homeTeam.name}</div><div className="text-xs text-[#849495]">{gameDateLabel(card.gameDate)} · {gameTime(card.gameDate)}</div></div></div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${card.ticketKind === 'extra' ? 'border-[#b69cff]/35 bg-[#b69cff]/10 text-[#d5c6ff]' : 'border-[#00f0ff]/35 bg-[#00f0ff]/10 text-[#00f0ff]'}`}>{card.ticketKind === 'extra' ? 'PREMIUM EXTRA · UNRANKED' : 'RANKED'}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${card.status === 'finished' ? 'border-[#65f2b5]/35 bg-[#65f2b5]/10 text-[#65f2b5]' : 'border-[#30415c] bg-[#10192b] text-[#aebbd0]'}`}>{card.status.toUpperCase()}</span>{card.status === 'finished' && card.ticketKind !== 'extra' && <span className="text-sm font-bold text-[#ffd166]">+{card.points} PTS</span>}</div></div><div className="divide-y divide-[#26364d]">{card.selections.map(selection => <div key={selection.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_150px_90px] sm:items-center"><div><div className="font-semibold text-white">{selection.label}</div><div className="mt-1 text-xs text-[#91a0b5]">{selection.summary}</div></div><span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold ${chanceClass(selection.chance)}`}>{selection.chance}</span><div className="sm:text-right">{selection.result === 'pending' ? <span className="text-xs text-[#849495]">PENDING</span> : selection.result === 'void' ? <span className="text-xs text-[#849495]">VOID</span> : <span className={`text-xs font-extrabold ${selection.result === 'correct' ? 'text-[#65f2b5]' : 'text-[#ff9da3]'}`}>{selection.result === 'correct' ? 'CORRECT ✓' : 'MISSED'}</span>}</div></div>)}</div></div>;

const StatsPanel = ({ title, stats, rank }: { title: string; stats: ReturnType<typeof cardStats>; rank: number }) => <div className="rounded-2xl border border-[#2d3b52] bg-[#0f182b] p-5"><h3 className="text-xl font-bold text-white text-center">{title}</h3><div className="mt-5 space-y-4"><StatLine label="Correct predictions" value={stats.total ? `${stats.correct}/${stats.total} (${stats.accuracy}%)` : '—'}/><StatLine label="Challenge Points" value={stats.points}/><StatLine label="Current streak" value={stats.currentStreak}/><StatLine label="Best streak" value={stats.bestStreak}/><StatLine label="Leaderboard rank" value={rank ? `#${rank}` : '—'}/></div></div>;

const StatLine = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="flex items-center justify-between gap-4"><span className="text-[#aebbd0]">{label}</span><span className="font-bold text-white">{value}</span></div>;
const MiniMetric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="rounded-xl border border-[#2d3b52] bg-[#10192b] px-3 py-3 text-center"><div className="text-[9px] font-bold uppercase tracking-wider text-[#718090]">{label}</div><div className="mt-1 text-xl font-extrabold text-white">{value}</div></div>;
const EmptyState = ({ icon, title, copy }: { icon: string; title: string; copy: string }) => <div className="rounded-2xl border border-dashed border-[#40516b] bg-[#0f182b] p-8 text-center"><span className="material-symbols-outlined text-4xl text-[#526275]">{icon}</span><h3 className="mt-3 font-bold text-white">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-[#91a0b5]">{copy}</p></div>;
