import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { easternDateKey, fetchPlayerCareerStats, fetchPlayerRecentGameLogs, fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { supabase } from '../services/supabaseClient';

type Step = 1 | 2 | 3 | 4 | 5;
type PickScope = 'batter' | 'pitcher' | 'game';
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
  | 'pitcher_strikeouts'
  | 'pitcher_innings'
  | 'pitcher_hits_allowed'
  | 'pitcher_earned_runs'
  | 'pitcher_walks'
  | 'pitcher_quality_start'
  | 'game_first_inning'
  | 'team_runs'
  | 'team_hits'
  | 'team_winner';

type RosterPlayer = {
  id: number;
  name: string;
  position: string;
  teamId: number;
  teamName: string;
  kind: 'batter' | 'pitcher';
};

type PickDef = {
  type: PredictionType;
  scope: PickScope;
  label: string;
  options: { label: string; threshold: number; direction?: Direction; choice?: string }[];
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

interface ChallengeWizardViewProps {
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
}

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const LOCAL_KEY = 'scoutcore:challenge-cards:v3';
const MAX_PICKS = 8;

const BATTER_DEFS: PickDef[] = [
  { type: 'hitter_hit', scope: 'batter', label: 'HITS', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_rbi', scope: 'batter', label: 'RBI', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_runs', scope: 'batter', label: 'RUNS', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_total_base', scope: 'batter', label: 'TOTAL BASES', options: [1, 2, 3, 4].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_reach_base', scope: 'batter', label: 'REACH BASE', options: [1, 2, 3].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_home_run', scope: 'batter', label: 'HOME RUN', options: [{ label: '1+', threshold: 1 }] },
  { type: 'hitter_walks', scope: 'batter', label: 'WALKS', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'hitter_stolen_bases', scope: 'batter', label: 'STOLEN BASES', options: [1, 2].map(threshold => ({ label: `${threshold}+`, threshold })) },
];

const PITCHER_DEFS: PickDef[] = [
  { type: 'pitcher_strikeouts', scope: 'pitcher', label: 'STRIKEOUTS', options: [4, 5, 6, 7, 8].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'pitcher_innings', scope: 'pitcher', label: 'INNINGS', options: [5, 6].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'pitcher_hits_allowed', scope: 'pitcher', label: 'HITS ALLOWED', options: [4, 5, 6].map(threshold => ({ label: `≤${threshold}`, threshold, direction: 'lte' as Direction })) },
  { type: 'pitcher_earned_runs', scope: 'pitcher', label: 'EARNED RUNS', options: [1, 2, 3].map(threshold => ({ label: `≤${threshold}`, threshold, direction: 'lte' as Direction })) },
  { type: 'pitcher_walks', scope: 'pitcher', label: 'WALKS', options: [1, 2, 3].map(threshold => ({ label: `≤${threshold}`, threshold, direction: 'lte' as Direction })) },
  { type: 'pitcher_quality_start', scope: 'pitcher', label: 'QUALITY START', options: [{ label: 'YES', threshold: 1, direction: 'eq', choice: 'yes' }, { label: 'NO', threshold: 0, direction: 'eq', choice: 'no' }] },
];

const GAME_DEFS: PickDef[] = [
  { type: 'game_first_inning', scope: 'game', label: '1ST INNING RUN', options: [{ label: 'YES', threshold: 1, direction: 'eq', choice: 'run' }, { label: 'NO', threshold: 0, direction: 'eq', choice: 'no_run' }] },
  { type: 'team_runs', scope: 'game', label: 'TEAM RUNS', options: [3, 4, 5].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'team_hits', scope: 'game', label: 'TEAM HITS', options: [7, 9, 11].map(threshold => ({ label: `${threshold}+`, threshold })) },
  { type: 'team_winner', scope: 'game', label: 'WHO WINS?', options: [{ label: 'WIN', threshold: 1, direction: 'eq' }] },
];

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
const stat3 = (value: unknown) => n(value).toFixed(3).replace(/^0/, '');
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));

const tomorrowKey = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return easternDateKey(date);
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
  return 0;
};

const pitcherValue = (type: PredictionType, stat: any) => {
  if (type === 'pitcher_strikeouts') return n(stat.strikeOuts);
  if (type === 'pitcher_innings') return n(stat.inningsPitched);
  if (type === 'pitcher_hits_allowed') return n(stat.hits);
  if (type === 'pitcher_earned_runs') return n(stat.earnedRuns);
  if (type === 'pitcher_walks') return n(stat.baseOnBalls);
  if (type === 'pitcher_quality_start') return n(stat.inningsPitched) >= 6 && n(stat.earnedRuns) <= 3 ? 1 : 0;
  return 0;
};

const chanceFor = (score: number): Chance => score >= 70 ? 'STRONG CHANCE' : score >= 48 ? 'MODERATE CHANCE' : score > 0 ? 'DIFFICULT' : 'LIMITED DATA';
const chanceStyle = (chance: Chance) => chance === 'STRONG CHANCE' ? 'text-[#8df5a8] border-[#65f2b5]/35 bg-[#65f2b5]/8' : chance === 'MODERATE CHANCE' ? 'text-[#ffd76a] border-[#ffd166]/35 bg-[#ffd166]/8' : chance === 'DIFFICULT' ? 'text-[#ff9c76] border-[#ff875f]/35 bg-[#ff875f]/8' : 'text-[#9aa8bc] border-[#40516b] bg-[#40516b]/8';

function pickLabel(def: PickDef, option: PickDef['options'][number], subjectName: string) {
  if (def.type === 'hitter_hit') return `${subjectName} — ${option.threshold}+ Hit${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_home_run') return `${subjectName} — 1+ Home Run`;
  if (def.type === 'hitter_rbi') return `${subjectName} — ${option.threshold}+ RBI`;
  if (def.type === 'hitter_runs') return `${subjectName} — ${option.threshold}+ Run${option.threshold === 1 ? '' : 's'}`;
  if (def.type === 'hitter_total_base') return `${subjectName} — ${option.threshold}+ Total Bases`;
  if (def.type === 'hitter_reach_base') return `${subjectName} — Reach Base ${option.threshold}+`;
  if (def.type === 'pitcher_strikeouts') return `${subjectName} — ${option.threshold}+ Strikeouts`;
  if (def.type === 'pitcher_innings') return `${subjectName} — ${option.threshold}+ Innings`;
  if (def.type === 'pitcher_hits_allowed') return `${subjectName} — ${option.threshold} or Fewer Hits Allowed`;
  if (def.type === 'pitcher_earned_runs') return `${subjectName} — ${option.threshold} or Fewer Earned Runs`;
  if (def.type === 'pitcher_walks') return `${subjectName} — ${option.threshold} or Fewer Walks`;
  if (def.type === 'pitcher_quality_start') return `${subjectName} — Quality Start ${option.choice === 'yes' ? 'Yes' : 'No'}`;
  if (def.type === 'team_runs') return `${subjectName} — ${option.threshold}+ Team Runs`;
  if (def.type === 'team_hits') return `${subjectName} — ${option.threshold}+ Team Hits`;
  if (def.type === 'team_winner') return `${subjectName} — Win`;
  if (def.type === 'game_first_inning') return `First Inning — ${option.choice === 'run' ? 'Run Scored' : 'No Run Scored'}`;
  return `${subjectName} — ${def.label} ${option.label}`;
}

function buildPick(def: PickDef, option: PickDef['options'][number], game: MlbScheduleGame, subject: RosterPlayer | MlbScheduleGame['awayTeam'] | null): PickSelection {
  const subjectId = subject && 'position' in subject ? subject.id : subject?.id ?? game.gamePk;
  const subjectName = subject && 'position' in subject ? subject.name : subject?.name ?? `${game.awayTeam.name} @ ${game.homeTeam.name}`;
  const teamId = subject && 'position' in subject ? subject.teamId : subject?.id ?? 0;
  const teamName = subject && 'position' in subject ? subject.teamName : subject?.name ?? 'Game';
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
    detail: `${def.label}: ${option.label}`,
  };
}

const careerSummary = (player: RosterPlayer, stats: any) => player.kind === 'pitcher'
  ? `${stats?.era ?? '—'} ERA · ${stats?.whip ?? '—'} WHIP · ${stats?.strikeOuts ?? '—'} SO · ${stats?.inningsPitched ?? '—'} IP`
  : `${stats?.avg ?? '—'} AVG · ${stats?.homeRuns ?? '—'} HR · ${stats?.rbi ?? '—'} RBI · ${stats?.ops ?? '—'} OPS`;

async function analyzePick(pick: PickSelection, game: MlbScheduleGame, careers: CareerMap): Promise<PickAnalysis> {
  if (pick.scope === 'game') {
    return {
      chance: 'MODERATE CHANCE',
      score: 55,
      summary: 'Game selections use matchup context rather than a single player trend. ScoutCore keeps this support score separate from Challenge Points.',
      keyFactor: 'Review team and starter context on the next page.',
      stats: [{ label: 'Matchup', value: `${game.awayTeam.abbreviation ?? game.awayTeam.name} @ ${game.homeTeam.abbreviation ?? game.homeTeam.name}` }],
    };
  }

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
    const ops = n(career?.ops);
    if (ops >= .850) context += 5;
    else if (ops > 0 && ops <= .650) context -= 4;
    const score = clamp(Math.round(28 + recentRate * 58 + context));
    return {
      chance: chanceFor(score),
      score,
      summary: `${hits}/${values.length || 0} recent games met this exact line. Career production and the opposing starter are used as supporting context.`,
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
    summary: `${hits}/${values.length || 0} recent starts met this exact line. ScoutCore also checks career run prevention and strikeout profile.`,
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
  const awayBatters = awayRoster.filter(player => player.kind === 'batter').slice(0, 9);
  const homeBatters = homeRoster.filter(player => player.kind === 'batter').slice(0, 9);
  const awayPitchers = useMemo(() => {
    if (!selectedGame) return [];
    const probable = selectedGame.awayProbablePitcher?.id ? { id: selectedGame.awayProbablePitcher.id, name: selectedGame.awayProbablePitcher.name, position: 'P', teamId: selectedGame.awayTeam.id, teamName: selectedGame.awayTeam.name, kind: 'pitcher' as const } : null;
    return [probable, ...awayRoster.filter(player => player.kind === 'pitcher' && player.id !== probable?.id)].filter(Boolean).slice(0, 3) as RosterPlayer[];
  }, [selectedGame, awayRoster]);
  const homePitchers = useMemo(() => {
    if (!selectedGame) return [];
    const probable = selectedGame.homeProbablePitcher?.id ? { id: selectedGame.homeProbablePitcher.id, name: selectedGame.homeProbablePitcher.name, position: 'P', teamId: selectedGame.homeTeam.id, teamName: selectedGame.homeTeam.name, kind: 'pitcher' as const } : null;
    return [probable, ...homeRoster.filter(player => player.kind === 'pitcher' && player.id !== probable?.id)].filter(Boolean).slice(0, 3) as RosterPlayer[];
  }, [selectedGame, homeRoster]);
  const analysisReady = picks.length > 0 && picks.every(pick => analysis[pick.id]);
  const gameStarted = selectedGame ? Date.now() >= new Date(selectedGame.gameDate).getTime() : false;

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
    setLockedCard(null);
    setRosterLoading(true);
    setCareer({});
    Promise.all([
      fetchRoster(selectedGame.awayTeam.id, selectedGame.awayTeam.name).catch(() => []),
      fetchRoster(selectedGame.homeTeam.id, selectedGame.homeTeam.name).catch(() => []),
    ]).then(async ([away, home]) => {
      setAwayRoster(away);
      setHomeRoster(home);
      const probableIds = [selectedGame.awayProbablePitcher?.id, selectedGame.homeProbablePitcher?.id].filter(Boolean) as number[];
      const visible = [
        ...away.filter(player => player.kind === 'batter').slice(0, 9),
        ...home.filter(player => player.kind === 'batter').slice(0, 9),
        ...away.filter(player => player.kind === 'pitcher').slice(0, 3),
        ...home.filter(player => player.kind === 'pitcher').slice(0, 3),
      ];
      const ids = [...new Set([...probableIds, ...visible.map(player => player.id)])];
      const kindById = new Map(visible.map(player => [player.id, player.kind] as const));
      probableIds.forEach(id => kindById.set(id, 'pitcher'));
      const rows = await Promise.all(ids.map(async id => {
        const kind = kindById.get(id) ?? 'batter';
        const stats = await fetchPlayerCareerStats(id, kind === 'pitcher' ? 'pitching' : 'hitting').catch(() => ({}));
        return [id, stats] as const;
      }));
      setCareer(Object.fromEntries(rows));
    }).finally(() => setRosterLoading(false));
  }, [selectedGamePk]);

  const togglePick = (pick: PickSelection) => {
    if (!signedIn) { onOpenAuth(); return; }
    setMessage(null);
    const existing = picks.find(item => item.id === pick.id);
    if (existing) {
      setPicks(current => current.filter(item => item.id !== pick.id));
      return;
    }
    const withoutSame = picks.filter(item => !(item.type === pick.type && item.subjectId === pick.subjectId));
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
      weekKey: new Date().toISOString().slice(0, 10),
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
              <div className="flex items-center gap-4"><TeamBadge team={selectedGame.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={selectedGame.homeTeam}/></div>
              <div className="text-right"><p className="text-xs font-bold text-white">{dateLabel(selectedGame.gameDate)} · {timeLabel(selectedGame.gameDate)}</p><p className="mt-1 text-[10px] text-[#718198]">Pick players from either team. Mix Yankees and Dodgers selections on the same card.</p></div>
            </div>
            {rosterLoading ? <div className="py-16 text-center text-sm text-[#91a0b5]">Loading both teams and career regular-season stats…</div> : <div className="mt-4 grid gap-4 2xl:grid-cols-2">
              <TeamRosterPanel team={selectedGame.awayTeam} batters={awayBatters} pitchers={awayPitchers} career={career} game={selectedGame} picks={picks} onToggle={togglePick}/>
              <TeamRosterPanel team={selectedGame.homeTeam} batters={homeBatters} pitchers={homePitchers} career={career} game={selectedGame} picks={picks} onToggle={togglePick}/>
            </div>}
          </section>
          <GamePickPanel game={selectedGame} picks={picks} onToggle={togglePick}/>
          <div className="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#00e6f4]/30 bg-[#08202a]/95 p-3 shadow-2xl backdrop-blur">
            <div><p className="text-sm font-extrabold text-white">{picks.length}/{MAX_PICKS} PICKS SELECTED</p><p className="text-[10px] text-[#8fb3bd]">Nothing is locked yet. You can change any selection.</p></div>
            <button onClick={() => void submitForAnalysis()} disabled={!picks.length || analyzing || gameStarted} className="rounded-xl bg-[#65e7e4] px-7 py-3 text-xs font-black text-[#05262b] disabled:opacity-35">{analyzing ? 'ANALYZING…' : gameStarted ? 'GAME STARTED · PICKS LOCKED' : 'SUBMIT PICKS → ANALYZE'}</button>
          </div>
        </>}
      </div>}

      {step === 2 && selectedGame && <StepShell title="ScoutCore Analysis" subtitle="ScoutCore runs pick-specific analysis. These 0–100 numbers are support ratings, not guaranteed probabilities.">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{picks.map(pick => <AnalysisCard key={pick.id} pick={pick} analysis={analysis[pick.id]} />)}</div>
        <BottomActions left="BACK TO PICKS" onLeft={() => setStep(1)} right="PROCEED → REVIEW STATS" onRight={() => { setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={!analysisReady}/>
      </StepShell>}

      {step === 3 && selectedGame && <StepShell title="Review Stats" subtitle="Explore the verified data ScoutCore used for each selection before you decide whether to continue.">
        <div className="space-y-3">{picks.map(pick => <StatsReviewCard key={pick.id} pick={pick} analysis={analysis[pick.id]} />)}</div>
        <BottomActions left="BACK TO ANALYZE" onLeft={() => setStep(2)} right="PROCEED → FINAL REVIEW" onRight={() => { setStep(4); window.scrollTo({ top: 0, behavior: 'smooth' }); }}/>
      </StepShell>}

      {step === 4 && selectedGame && <StepShell title="GO — Lock Your Picks" subtitle="Review one last time. Once you press GO, the card and ScoutCore analysis snapshot cannot be edited.">
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

const GameChooser = ({ today, tomorrow, loading, selected, onSelect }: { today: MlbScheduleGame[]; tomorrow: MlbScheduleGame[]; loading: boolean; selected: number | null; onSelect: (id: number) => void }) => <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-5"><div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#65f2b5]">Step 1</p><h1 className="mt-1 text-2xl font-extrabold text-white">Choose a game, then build picks from both teams</h1><p className="mt-1 text-xs text-[#8495aa]">Today's and tomorrow's games are separated so the matchup is easy to find.</p></div>{loading ? <div className="py-8 text-center text-sm text-[#91a0b5]">Loading MLB schedule…</div> : <div className="grid gap-4 xl:grid-cols-2"><GameDay title="TODAY'S GAMES" games={today} selected={selected} onSelect={onSelect}/><GameDay title="TOMORROW'S GAMES" games={tomorrow} selected={selected} onSelect={onSelect}/></div>}</section>;

const GameDay = ({ title, games, selected, onSelect }: { title: string; games: MlbScheduleGame[]; selected: number | null; onSelect: (id: number) => void }) => <div><p className="mb-2 text-[10px] font-black tracking-[.13em] text-[#8fa0b7]">{title}</p><div className="grid gap-2 sm:grid-cols-2">{games.map(game => <button key={game.gamePk} onClick={() => onSelect(game.gamePk)} className={`rounded-xl border p-3 text-left transition ${selected === game.gamePk ? 'border-[#00e6f4] bg-[#00e6f4]/8' : 'border-[#2b405b] bg-[#08111f] hover:border-[#50647f]'}`}><div className="flex items-center justify-between gap-2"><TeamBadge team={game.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={game.homeTeam}/></div><p className="mt-2 text-[9px] text-[#718198]">{dateLabel(game.gameDate)} · {timeLabel(game.gameDate)}</p></button>)}{!games.length && <div className="rounded-xl border border-dashed border-[#40516b] p-4 text-xs text-[#718198]">No games listed.</div>}</div></div>;

const TeamBadge = ({ team }: { team: MlbScheduleGame['awayTeam'] }) => <div className="flex min-w-0 items-center gap-2"><div className="h-9 w-9 shrink-0 rounded-lg bg-[#eef2f6] p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-full w-full object-contain"/></div><div className="min-w-0"><p className="truncate text-xs font-black text-white">{team.abbreviation ?? team.name}</p><p className="hidden truncate text-[9px] text-[#718198] sm:block">{team.name}</p></div></div>;

const TeamRosterPanel = ({ team, batters, pitchers, career, game, picks, onToggle }: { team: MlbScheduleGame['awayTeam']; batters: RosterPlayer[]; pitchers: RosterPlayer[]; career: CareerMap; game: MlbScheduleGame; picks: PickSelection[]; onToggle: (pick: PickSelection) => void }) => <div className="overflow-hidden rounded-2xl border border-[#2a3d56] bg-[#091321]"><div className="flex items-center gap-3 border-b border-[#26364e] px-4 py-3"><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-9 w-9 object-contain"/><div><h2 className="font-extrabold text-white">{team.name}</h2><p className="text-[9px] uppercase tracking-wider text-[#00e6f4]">Pick batters and pitchers</p></div></div><div className="p-3"><SectionLabel title="BATTERS"/><div className="space-y-2">{batters.map(player => <PlayerPickRow key={player.id} player={player} stats={career[player.id]} defs={BATTER_DEFS} game={game} picks={picks} onToggle={onToggle}/>)}</div><div className="mt-5"><SectionLabel title="PITCHERS"/></div><div className="space-y-2">{pitchers.map(player => <PlayerPickRow key={player.id} player={player} stats={career[player.id]} defs={PITCHER_DEFS} game={game} picks={picks} onToggle={onToggle}/>)}</div></div></div>;

const SectionLabel = ({ title }: { title: string }) => <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black tracking-[.14em] text-[#8fa0b7]">{title}</p><span className="text-[9px] text-[#607086]">Career regular season</span></div>;

const PlayerPickRow = ({ player, stats, defs, game, picks, onToggle }: { player: RosterPlayer; stats: any; defs: PickDef[]; game: MlbScheduleGame; picks: PickSelection[]; onToggle: (pick: PickSelection) => void }) => <div className="rounded-xl border border-[#24364e] bg-[#0d1727] p-3"><div className="flex items-center gap-3"><img src={mlbPlayerHeadshotUrl(player.id, 120)} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-[#dfe5eb] object-contain"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-white">{player.name}</p><span className="rounded border border-[#33465f] px-1.5 py-0.5 text-[8px] font-bold text-[#91a2b8]">{player.position}</span></div><p className="mt-1 text-[9px] text-[#65f2b5]">CAREER REGULAR SEASON</p><p className="mt-1 truncate text-[10px] text-[#9aa8bc]">{stats ? careerSummary(player, stats) : 'Loading career stats…'}</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{defs.map(def => <div key={def.type} className="rounded-lg border border-[#22334a] bg-[#08111f] p-2"><p className="text-[8px] font-black tracking-wide text-[#7f90a6]">{def.label}</p><div className="mt-1.5 flex flex-wrap gap-1">{def.options.map(option => { const pick = buildPick(def, option, game, player); const active = picks.some(item => item.id === pick.id); return <button key={`${option.label}-${option.threshold}`} onClick={() => onToggle(pick)} className={`min-w-8 rounded-md border px-2 py-1 text-[9px] font-black ${active ? 'border-[#00e6f4] bg-[#00e6f4] text-[#05262b]' : 'border-[#30415c] bg-[#10192b] text-[#c0ccdc] hover:border-[#00e6f4]/50'}`}>{option.label}</button>; })}</div></div>)}</div></div>;

const GamePickPanel = ({ game, picks, onToggle }: { game: MlbScheduleGame; picks: PickSelection[]; onToggle: (pick: PickSelection) => void }) => <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4"><div><p className="text-[10px] font-black tracking-[.14em] text-[#65f2b5]">OPTIONAL GAME PICKS</p><p className="mt-1 text-xs text-[#8495aa]">Keep game predictions separate from player analysis, but they can live on the same Challenge Card.</p></div><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{GAME_DEFS.map(def => <div key={def.type} className="rounded-xl border border-[#26364e] bg-[#08111f] p-3"><p className="text-[9px] font-black text-white">{def.label}</p>{def.type === 'game_first_inning' ? <div className="mt-2 flex gap-1">{def.options.map(option => { const pick = buildPick(def, option, game, null); const active = picks.some(item => item.id === pick.id); return <button key={option.label} onClick={() => onToggle(pick)} className={`rounded-lg border px-3 py-1.5 text-[9px] font-black ${active ? 'border-[#00e6f4] bg-[#00e6f4] text-[#05262b]' : 'border-[#30415c] text-[#c4cfdd]'}`}>{option.label}</button>; })}</div> : <div className="mt-2 space-y-2">{[game.awayTeam, game.homeTeam].map(team => <div key={team.id} className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold text-[#9aa8bc]">{team.abbreviation ?? team.name}</span><div className="flex flex-wrap justify-end gap-1">{def.options.map(option => { const pick = buildPick(def, option, game, team); const active = picks.some(item => item.id === pick.id); return <button key={option.label} onClick={() => onToggle(pick)} className={`rounded-md border px-2 py-1 text-[8px] font-black ${active ? 'border-[#00e6f4] bg-[#00e6f4] text-[#05262b]' : 'border-[#30415c] text-[#c4cfdd]'}`}>{option.label}</button>; })}</div></div>)}</div>}</div>)}</div></section>;

const StepShell = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => <section className="mt-5 rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-6"><div className="mb-5"><h1 className="text-2xl font-extrabold text-white">{title}</h1><p className="mt-1 text-sm text-[#8495aa]">{subtitle}</p></div>{children}</section>;

const AnalysisCard = ({ pick, analysis }: { pick: PickSelection; analysis?: PickAnalysis }) => <div className="rounded-xl border border-[#293d57] bg-[#08111f] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-white">{pick.label}</p><p className="mt-1 text-[9px] text-[#718198]">{pick.teamName}</p></div>{analysis && <span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${chanceStyle(analysis.chance)}`}>{analysis.chance} · {analysis.score}/100</span>}</div>{analysis ? <><p className="mt-3 text-xs leading-5 text-[#b8c5d5]">{analysis.summary}</p><p className="mt-2 text-[10px] text-[#65f2b5]">{analysis.keyFactor}</p><div className="mt-3 grid grid-cols-2 gap-2">{analysis.stats.slice(0, 4).map(stat => <div key={stat.label} className="rounded-lg border border-[#22334a] bg-[#0d1727] p-2"><p className="text-[8px] uppercase text-[#607086]">{stat.label}</p><p className="mt-1 text-xs font-black text-white">{stat.value}</p></div>)}</div></> : <p className="mt-3 text-xs text-[#718198]">Analysis unavailable.</p>}</div>;

const StatsReviewCard = ({ pick, analysis }: { pick: PickSelection; analysis?: PickAnalysis }) => <div className="rounded-xl border border-[#293d57] bg-[#08111f] p-4"><div className="grid gap-4 lg:grid-cols-[minmax(260px,.8fr)_1.2fr]"><div><p className="text-sm font-extrabold text-white">{pick.label}</p>{analysis && <span className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-[9px] font-black ${chanceStyle(analysis.chance)}`}>{analysis.chance} · {analysis.score}/100</span>}<p className="mt-3 text-xs leading-5 text-[#9eacbe]">{analysis?.summary}</p></div><div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">{analysis?.stats.map(stat => <div key={stat.label} className="rounded-lg border border-[#25364d] bg-[#0d1727] p-3"><p className="text-[8px] uppercase tracking-wider text-[#607086]">{stat.label}</p><p className="mt-1 text-sm font-black text-white">{stat.value}</p></div>)}</div></div></div>;

const FinalReview = ({ game, picks, analysis }: { game: MlbScheduleGame; picks: PickSelection[]; analysis: Record<string, PickAnalysis> }) => <div className="grid gap-4 xl:grid-cols-[340px_1fr]"><div className="rounded-xl border border-[#293d57] bg-[#08111f] p-4"><div className="flex items-center justify-center gap-4"><TeamBadge team={game.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={game.homeTeam}/></div><p className="mt-3 text-center text-[10px] text-[#718198]">{dateLabel(game.gameDate)} · {timeLabel(game.gameDate)}</p><p className="mt-4 text-center text-2xl font-black text-white">{picks.length} PICKS</p><p className="text-center text-[9px] text-[#718198]">Analysis snapshot will be saved when you press GO.</p></div><div className="space-y-2">{picks.map(pick => <div key={pick.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#293d57] bg-[#08111f] px-4 py-3"><div><p className="text-xs font-extrabold text-white">{pick.label}</p><p className="mt-1 text-[9px] text-[#718198]">{pick.teamName}</p></div><span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${chanceStyle(analysis[pick.id]?.chance ?? 'LIMITED DATA')}`}>{analysis[pick.id]?.score ?? 0}/100</span></div>)}</div></div>;

const BottomActions = ({ left, onLeft, right, onRight, disabled }: { left: string; onLeft: () => void; right?: string; onRight?: () => void; disabled?: boolean }) => <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button onClick={onLeft} className="rounded-xl border border-[#30415c] bg-[#10192b] px-5 py-3 text-xs font-black text-[#c3cedc]">← {left}</button>{right && onRight && <button onClick={onRight} disabled={disabled} className="rounded-xl bg-[#65e7e4] px-6 py-3 text-xs font-black text-[#05262b] disabled:opacity-35">{right}</button>}</div>;

const LockedPage = ({ game, card }: { game: MlbScheduleGame; card: any }) => <section className="mt-5 rounded-3xl border border-[#65f2b5]/30 bg-[radial-gradient(circle_at_50%_0%,rgba(101,242,181,.10),transparent_40%),#0d1727] p-6 text-center sm:p-10"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#65f2b5]/50 bg-[#65f2b5]/10 text-[#65f2b5] shadow-[0_0_45px_rgba(101,242,181,.18)]"><span className="material-symbols-outlined text-5xl">check</span></div><h1 className="mt-5 text-3xl font-extrabold text-white">Your Picks Are Locked!</h1><p className="mt-2 text-sm text-[#9eacbe]">ScoutCore saved the analysis snapshot that existed when you pressed GO. Await game results.</p><div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-[#293d57] bg-[#08111f] p-5"><div className="flex items-center justify-center gap-5"><TeamBadge team={game.awayTeam}/><span className="text-[#607086]">@</span><TeamBadge team={game.homeTeam}/></div><p className="mt-3 text-[10px] text-[#718198]">{dateLabel(game.gameDate)} · {timeLabel(game.gameDate)}</p><div className="mt-5 grid gap-2 text-left sm:grid-cols-2">{(card?.selections ?? []).map((pick: any) => <div key={pick.id} className="rounded-xl border border-[#26364e] bg-[#0d1727] p-3"><p className="text-xs font-bold text-white">{pick.label}</p><p className="mt-1 text-[9px] text-[#65f2b5]">ScoutCore: {pick.chance} · {pick.score}/100</p></div>)}</div></div><p className="mt-5 text-xs text-[#718198]">Results will affect accuracy and ScoutCore Points. Incorrect picks do not subtract points.</p></section>;
