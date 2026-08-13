import React, { useEffect, useMemo, useState } from 'react';
import { getSchedule, getTeamRoster, type MlbScheduleGame } from '../services/mlbApi';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import './challenge-fullscreen.css';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Scope = 'batter' | 'pitcher' | 'game';
type Direction = 'gte' | 'lte' | 'eq';
type Chance = 'STRONG' | 'MODERATE' | 'DIFFICULT' | 'LIMITED DATA';

type RosterPlayer = {
  id: number;
  name: string;
  position: string;
  teamId: number;
  teamName: string;
};

type GameLog = {
  date: string;
  opponent: string;
  stat: any;
};

type Pick = {
  id: string;
  scope: Scope;
  type: string;
  label: string;
  subjectId: number;
  subjectName: string;
  teamId: number;
  teamName: string;
  threshold: number;
  direction: Direction;
  choice?: string;
  display: string;
};

type Analysis = {
  chance: Chance;
  score: number | null;
  summary: string;
  factors: string[];
};

type PlayerEvidence = {
  season: any | null;
  career: any | null;
  recent: GameLog[];
};

type TeamForm = {
  games: number;
  wins: number;
  runsPerGame: number;
  hitsPerGame: number;
};

type Props = {
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
  onExit: () => void;
};

type PickDef = {
  type: string;
  label: string;
  options: { label: string; threshold: number; direction?: Direction; choice?: string }[];
};

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const STORAGE_KEY = 'scoutcore:challenge-cards:v3';

const BATTER_DEFS: PickDef[] = [
  { type: 'hitter_hit', label: 'HITS', options: [1, 2, 3].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_total_base', label: 'TOTAL BASES', options: [1, 2, 3, 4].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_reach_base', label: 'REACH BASE', options: [1, 2, 3].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_home_run', label: 'HOME RUNS', options: [{ label: '1+ HR', threshold: 1 }] },
  { type: 'hitter_runs', label: 'RUNS SCORED', options: [1, 2].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_rbi', label: 'RBI', options: [1, 2, 3].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_walks', label: 'WALKS', options: [1, 2].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_stolen_bases', label: 'STOLEN BASES', options: [1, 2].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_extra_base_hit', label: 'EXTRA-BASE HIT', options: [{ label: '1+ (2B / 3B / HR)', threshold: 1 }] },
  { type: 'hitter_hrr', label: 'HITS + RUNS + RBI', options: [2, 3, 4].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'hitter_strikeouts', label: 'BATTER STRIKEOUTS', options: [1, 2].map(v => ({ label: `${v}+`, threshold: v })) },
];

const PITCHER_DEFS: PickDef[] = [
  { type: 'pitcher_strikeouts', label: 'PITCHER STRIKEOUTS', options: [4, 5, 6, 7, 8].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'pitcher_innings', label: 'PITCHER INNINGS', options: [5, 6].map(v => ({ label: `${v}+`, threshold: v })) },
  { type: 'pitcher_hits_allowed', label: 'PITCHER HITS ALLOWED', options: [4, 5, 6].map(v => ({ label: `${v} or fewer`, threshold: v, direction: 'lte' as Direction })) },
  { type: 'pitcher_earned_runs', label: 'PITCHER EARNED RUNS', options: [1, 2, 3].map(v => ({ label: `${v} or fewer`, threshold: v, direction: 'lte' as Direction })) },
  { type: 'pitcher_walks', label: 'PITCHER WALKS', options: [1, 2, 3].map(v => ({ label: `${v} or fewer`, threshold: v, direction: 'lte' as Direction })) },
];

const json = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
};

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
};

const statValue = (type: string, stat: any) => {
  if (type === 'hitter_hit') return num(stat?.hits);
  if (type === 'hitter_total_base') return num(stat?.totalBases);
  if (type === 'hitter_reach_base') return num(stat?.hits) + num(stat?.baseOnBalls) + num(stat?.hitByPitch);
  if (type === 'hitter_home_run') return num(stat?.homeRuns);
  if (type === 'hitter_runs') return num(stat?.runs);
  if (type === 'hitter_rbi') return num(stat?.rbi);
  if (type === 'hitter_walks') return num(stat?.baseOnBalls);
  if (type === 'hitter_stolen_bases') return num(stat?.stolenBases);
  if (type === 'hitter_extra_base_hit') return num(stat?.doubles) + num(stat?.triples) + num(stat?.homeRuns);
  if (type === 'hitter_hrr') return num(stat?.hits) + num(stat?.runs) + num(stat?.rbi);
  if (type === 'hitter_strikeouts') return num(stat?.strikeOuts);
  if (type === 'pitcher_strikeouts') return num(stat?.strikeOuts);
  if (type === 'pitcher_innings') return num(stat?.inningsPitched);
  if (type === 'pitcher_hits_allowed') return num(stat?.hits);
  if (type === 'pitcher_earned_runs') return num(stat?.earnedRuns);
  if (type === 'pitcher_walks') return num(stat?.baseOnBalls);
  return 0;
};

const passes = (pick: Pick, value: number) => pick.direction === 'lte' ? value <= pick.threshold : pick.direction === 'eq' ? value === pick.threshold : value >= pick.threshold;

const lineSummary = (log: GameLog, scope: Scope) => {
  const stat = log.stat ?? {};
  if (scope === 'pitcher') {
    return `${stat.inningsPitched ?? '—'} IP · ${stat.strikeOuts ?? 0} K · ${stat.hits ?? 0} H · ${stat.earnedRuns ?? 0} ER`;
  }
  const bits = [`${stat.hits ?? 0}-${stat.atBats ?? 0}`];
  if (num(stat.homeRuns)) bits.push(`${stat.homeRuns} HR`);
  if (num(stat.rbi)) bits.push(`${stat.rbi} RBI`);
  if (num(stat.runs)) bits.push(`${stat.runs} R`);
  if (num(stat.stolenBases)) bits.push(`${stat.stolenBases} SB`);
  return bits.join(' · ');
};

const pickKey = (scope: Scope, subjectId: number, type: string) => `${scope}:${subjectId}:${type}`;

const chanceForScore = (score: number | null): Chance => {
  if (score === null) return 'LIMITED DATA';
  if (score >= 70) return 'STRONG';
  if (score >= 52) return 'MODERATE';
  return 'DIFFICULT';
};

const fetchGameLogs = async (playerId: number, group: 'hitting' | 'pitching'): Promise<GameLog[]> => {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=${group}`);
  const splits = data?.stats?.[0]?.splits ?? [];
  return splits.slice(-3).reverse().map((split: any) => ({
    date: split?.date ?? '',
    opponent: split?.opponent?.name ?? 'Opponent',
    stat: split?.stat ?? {},
  }));
};

const fetchStatSplit = async (playerId: number, group: 'hitting' | 'pitching', stats: 'season' | 'career') => {
  const season = new Date().getFullYear();
  const suffix = stats === 'season' ? `&season=${season}` : '';
  const data = await json(`${MLB_API}/people/${playerId}/stats?stats=${stats}&group=${group}${suffix}`);
  return data?.stats?.[0]?.splits?.[0]?.stat ?? null;
};

const fetchTeamForm = async (teamId: number): Promise<TeamForm> => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 35);
  const key = (date: Date) => date.toISOString().slice(0, 10);
  const data = await json(`${MLB_API}/schedule?sportId=1&teamId=${teamId}&startDate=${key(start)}&endDate=${key(end)}&hydrate=linescore`);
  const games = (data?.dates ?? []).flatMap((day: any) => day?.games ?? [])
    .filter((game: any) => game?.status?.abstractGameState === 'Final')
    .sort((a: any, b: any) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
    .slice(0, 10);
  let wins = 0;
  let runs = 0;
  let hits = 0;
  games.forEach((game: any) => {
    const away = Number(game?.teams?.away?.team?.id) === teamId;
    const tr = away ? num(game?.teams?.away?.score) : num(game?.teams?.home?.score);
    const or = away ? num(game?.teams?.home?.score) : num(game?.teams?.away?.score);
    const th = away ? num(game?.linescore?.teams?.away?.hits) : num(game?.linescore?.teams?.home?.hits);
    if (tr > or) wins += 1;
    runs += tr;
    hits += th;
  });
  return { games: games.length, wins, runsPerGame: games.length ? runs / games.length : 0, hitsPerGame: games.length ? hits / games.length : 0 };
};

const teamName = (game: MlbScheduleGame, teamId: number) => game.awayTeam.id === teamId ? game.awayTeam.name : game.homeTeam.name;
const gameTitle = (game: MlbScheduleGame) => `${game.awayTeam.name} @ ${game.homeTeam.name}`;

export const ChallengeFullscreenView: React.FC<Props> = ({ signedIn, onOpenAuth, onExit }) => {
  const [step, setStep] = useState<Step>(1);
  const [todayGames, setTodayGames] = useState<MlbScheduleGame[]>([]);
  const [tomorrowGames, setTomorrowGames] = useState<MlbScheduleGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<MlbScheduleGame | null>(null);
  const [batters, setBatters] = useState<RosterPlayer[]>([]);
  const [expandedBatter, setExpandedBatter] = useState<number | null>(null);
  const [expandedPitcher, setExpandedPitcher] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<number, GameLog[]>>({});
  const [picks, setPicks] = useState<Pick[]>([]);
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({});
  const [evidence, setEvidence] = useState<Record<number, PlayerEvidence>>({});
  const [teamForms, setTeamForms] = useState<Record<number, TeamForm>>({});
  const [reviewTab, setReviewTab] = useState<'players' | 'teams' | 'matchup'>('players');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [today, next] = await Promise.all([getSchedule(new Date()), getSchedule(tomorrow())]);
        if (!cancelled) {
          setTodayGames(today);
          setTomorrowGames(next);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Unable to load MLB schedule.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const confirmedPitchers = useMemo(() => {
    if (!selectedGame) return [] as RosterPlayer[];
    const rows: RosterPlayer[] = [];
    if (selectedGame.awayProbablePitcher?.id) rows.push({ id: selectedGame.awayProbablePitcher.id, name: selectedGame.awayProbablePitcher.name, position: 'P', teamId: selectedGame.awayTeam.id, teamName: selectedGame.awayTeam.name });
    if (selectedGame.homeProbablePitcher?.id) rows.push({ id: selectedGame.homeProbablePitcher.id, name: selectedGame.homeProbablePitcher.name, position: 'P', teamId: selectedGame.homeTeam.id, teamName: selectedGame.homeTeam.name });
    return rows;
  }, [selectedGame]);

  const selectedBatterPicks = picks.filter(p => p.scope === 'batter').length;
  const selectedPitcherPicks = picks.filter(p => p.scope === 'pitcher').length;
  const selectedGamePicks = picks.filter(p => p.scope === 'game').length;

  const loadGamePlayers = async (game: MlbScheduleGame) => {
    setLoading(true);
    setMessage(null);
    setSelectedGame(game);
    setPicks([]);
    setAnalysis({});
    setEvidence({});
    setTeamForms({});
    try {
      const [awayRosterData, homeRosterData] = await Promise.all([getTeamRoster(game.awayTeam.id), getTeamRoster(game.homeTeam.id)]);
      const normalize = (data: any, teamId: number, name: string) => (data?.roster ?? [])
        .filter((entry: any) => entry?.person?.id && entry?.position?.abbreviation !== 'P')
        .map((entry: any): RosterPlayer => ({ id: Number(entry.person.id), name: entry.person.fullName ?? 'Player', position: entry.position?.abbreviation ?? '', teamId, teamName: name }));
      const rows = [...normalize(awayRosterData, game.awayTeam.id, game.awayTeam.name), ...normalize(homeRosterData, game.homeTeam.id, game.homeTeam.name)];
      setBatters(rows);

      const allForLogs = [...rows, ...([
        game.awayProbablePitcher?.id ? { id: game.awayProbablePitcher.id, name: game.awayProbablePitcher.name, position: 'P', teamId: game.awayTeam.id, teamName: game.awayTeam.name } : null,
        game.homeProbablePitcher?.id ? { id: game.homeProbablePitcher.id, name: game.homeProbablePitcher.name, position: 'P', teamId: game.homeTeam.id, teamName: game.homeTeam.name } : null,
      ].filter(Boolean) as RosterPlayer[])];

      const nextLogs: Record<number, GameLog[]> = {};
      const queue = [...allForLogs];
      const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
        while (queue.length) {
          const player = queue.shift();
          if (!player) return;
          try { nextLogs[player.id] = await fetchGameLogs(player.id, player.position === 'P' ? 'pitching' : 'hitting'); }
          catch { nextLogs[player.id] = []; }
        }
      });
      await Promise.all(workers);
      setLogs(nextLogs);
      setStep(3);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load players for this game.');
    } finally {
      setLoading(false);
    }
  };

  const setPlayerPick = (scope: 'batter' | 'pitcher', player: RosterPlayer, def: PickDef, raw: string) => {
    const id = pickKey(scope, player.id, def.type);
    if (!raw) {
      setPicks(current => current.filter(pick => pick.id !== id));
      return;
    }
    const option = def.options[Number(raw)];
    if (!option) return;
    const pick: Pick = {
      id,
      scope,
      type: def.type,
      label: def.label,
      subjectId: player.id,
      subjectName: player.name,
      teamId: player.teamId,
      teamName: player.teamName,
      threshold: option.threshold,
      direction: option.direction ?? 'gte',
      choice: option.choice,
      display: option.label,
    };
    setPicks(current => [...current.filter(item => item.id !== id), pick]);
  };

  const setGamePick = (type: string, label: string, value: string) => {
    const id = `game:${type}`;
    if (!selectedGame || !value) {
      setPicks(current => current.filter(pick => pick.id !== id));
      return;
    }
    const [teamIdRaw, thresholdRaw, directionRaw, choice] = value.split('|');
    const teamId = Number(teamIdRaw || 0);
    const threshold = Number(thresholdRaw || 0);
    const subjectName = teamId ? teamName(selectedGame, teamId) : gameTitle(selectedGame);
    const display = choice || subjectName;
    const pick: Pick = {
      id,
      scope: 'game',
      type,
      label,
      subjectId: teamId || selectedGame.gamePk,
      subjectName,
      teamId,
      teamName: subjectName,
      threshold,
      direction: (directionRaw as Direction) || 'eq',
      choice,
      display,
    };
    setPicks(current => [...current.filter(item => item.id !== id), pick]);
  };

  const buildAnalysis = async () => {
    if (!selectedGame) return;
    setLoading(true);
    setMessage(null);
    const playerIds = Array.from(new Set(picks.filter(p => p.scope !== 'game').map(p => p.subjectId)));
    const nextEvidence: Record<number, PlayerEvidence> = { ...evidence };

    const queue = [...playerIds];
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
      while (queue.length) {
        const playerId = queue.shift();
        if (!playerId) return;
        const pick = picks.find(p => p.subjectId === playerId)!;
        const group = pick.scope === 'pitcher' ? 'pitching' : 'hitting';
        try {
          const [season, career] = await Promise.all([
            fetchStatSplit(playerId, group, 'season'),
            fetchStatSplit(playerId, group, 'career'),
          ]);
          nextEvidence[playerId] = { season, career, recent: logs[playerId] ?? [] };
        } catch {
          nextEvidence[playerId] = { season: null, career: null, recent: logs[playerId] ?? [] };
        }
      }
    }));

    const [awayForm, homeForm] = await Promise.all([
      fetchTeamForm(selectedGame.awayTeam.id).catch(() => ({ games: 0, wins: 0, runsPerGame: 0, hitsPerGame: 0 })),
      fetchTeamForm(selectedGame.homeTeam.id).catch(() => ({ games: 0, wins: 0, runsPerGame: 0, hitsPerGame: 0 })),
    ]);
    const forms = { [selectedGame.awayTeam.id]: awayForm, [selectedGame.homeTeam.id]: homeForm };
    setEvidence(nextEvidence);
    setTeamForms(forms);

    const nextAnalysis: Record<string, Analysis> = {};
    picks.forEach(pick => {
      if (pick.scope === 'batter' || pick.scope === 'pitcher') {
        const recent = nextEvidence[pick.subjectId]?.recent ?? [];
        if (!recent.length) {
          nextAnalysis[pick.id] = { chance: 'LIMITED DATA', score: null, summary: 'ScoutCore does not have enough recent verified game-log data to rate this selection confidently.', factors: ['Recent game logs unavailable'] };
          return;
        }
        const hits = recent.filter(log => passes(pick, statValue(pick.type, log.stat))).length;
        const recentRate = hits / recent.length;
        const season = nextEvidence[pick.subjectId]?.season ?? {};
        const gamesPlayed = Math.max(1, num(season.gamesPlayed) || num(season.gamesStarted));
        const seasonPerGame = statValue(pick.type, season) / gamesPlayed;
        const target = Math.max(.5, pick.threshold);
        const seasonSupport = pick.direction === 'lte' ? (seasonPerGame <= target ? .75 : .35) : Math.min(1, seasonPerGame / target);
        const score = Math.round(Math.max(28, Math.min(88, 35 + recentRate * 42 + seasonSupport * 18)));
        const chance = chanceForScore(score);
        const factors = [`Recent line: ${hits}/${recent.length}`, `Season context: ${seasonPerGame.toFixed(2)} per game`];
        if (pick.scope === 'batter') {
          const opponentPitcher = pick.teamId === selectedGame.awayTeam.id ? selectedGame.homeProbablePitcher : selectedGame.awayProbablePitcher;
          factors.push(opponentPitcher ? `Opposing starter: ${opponentPitcher.name}` : 'Opposing starter not confirmed');
        } else {
          const opponent = pick.teamId === selectedGame.awayTeam.id ? selectedGame.homeTeam.name : selectedGame.awayTeam.name;
          factors.push(`Opponent: ${opponent}`);
        }
        nextAnalysis[pick.id] = {
          chance,
          score,
          summary: `${pick.subjectName} met this exact line in ${hits} of the last ${recent.length} completed games. ScoutCore combines that recent result with season context; this is a support rating, not a guaranteed probability.`,
          factors,
        };
        return;
      }

      const form = pick.teamId ? forms[pick.teamId] : null;
      if (form?.games) {
        let support = .5;
        if (pick.type === 'team_runs') support = Math.min(1, form.runsPerGame / Math.max(1, pick.threshold));
        else if (pick.type === 'team_hits') support = Math.min(1, form.hitsPerGame / Math.max(1, pick.threshold));
        else if (pick.type === 'team_winner') support = form.wins / form.games;
        const score = Math.round(35 + support * 45);
        nextAnalysis[pick.id] = { chance: chanceForScore(score), score, summary: `${pick.subjectName} is ${form.wins}-${form.games - form.wins} across its last ${form.games} completed games, averaging ${form.runsPerGame.toFixed(1)} runs and ${form.hitsPerGame.toFixed(1)} hits.`, factors: [`Last ${form.games}: ${form.wins}-${form.games - form.wins}`, `${form.runsPerGame.toFixed(1)} runs/game`, `${form.hitsPerGame.toFixed(1)} hits/game`] };
      } else {
        nextAnalysis[pick.id] = { chance: 'LIMITED DATA', score: null, summary: 'This game-level pick has limited verified recent context available.', factors: ['Game context only'] };
      }
    });

    setAnalysis(nextAnalysis);
    setStep(6);
    setLoading(false);
  };

  const lockPicks = () => {
    if (!selectedGame) return;
    if (!signedIn) {
      onOpenAuth();
      return;
    }
    const card = {
      id: `challenge-${selectedGame.gamePk}-${Date.now()}`,
      gamePk: selectedGame.gamePk,
      gameDate: selectedGame.gameDate,
      awayTeam: selectedGame.awayTeam,
      homeTeam: selectedGame.homeTeam,
      picks,
      analysis,
      lockedAt: new Date().toISOString(),
      status: 'upcoming',
      analysisSnapshot: analysis,
    };
    try {
      const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      const cards = Array.isArray(existing) ? existing : [];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([card, ...cards].slice(0, 100)));
    } catch {}
    setStep(9);
  };

  const stepMeta: Record<Step, { title: string; subtitle: string }> = {
    1: { title: 'WELCOME', subtitle: 'Learn how ScoutCore Challenge works.' },
    2: { title: "TODAY’S & TOMORROW’S GAMES", subtitle: 'Choose a matchup.' },
    3: { title: 'BUILD PICKS – BATTERS', subtitle: 'Use recent game logs to set batter targets.' },
    4: { title: 'BUILD PICKS – PITCHERS', subtitle: 'Only confirmed probable starters are shown.' },
    5: { title: 'BUILD PICKS – GAME PICKS', subtitle: 'Add game-level predictions.' },
    6: { title: 'ANALYZE', subtitle: 'ScoutCore rates every selection.' },
    7: { title: 'REVIEW STATS', subtitle: 'Explore the evidence behind each pick.' },
    8: { title: 'ALMOST DONE', subtitle: 'Review one last time before locking.' },
    9: { title: 'PICKS ARE LOCKED', subtitle: 'Your Challenge Card is final.' },
  };

  const Header = () => (
    <header className="sc-challenge-header">
      <div className="sc-challenge-step-number">{step}</div>
      <div className="min-w-0">
        <p className="sc-challenge-kicker">{stepMeta[step].title}</p>
        <p className="sc-challenge-subtitle">{stepMeta[step].subtitle}</p>
      </div>
      <div className="sc-challenge-progress-wrap">
        <span>Step {step} of 9{step === 9 ? ' (Final)' : ''}</span>
        <div className="sc-challenge-dots">{Array.from({ length: 9 }, (_, index) => <i key={index} className={index + 1 <= step ? 'active' : ''} />)}</div>
      </div>
    </header>
  );

  const Matchup = ({ game, compact = false }: { game: MlbScheduleGame; compact?: boolean }) => (
    <div className={`sc-matchup ${compact ? 'compact' : ''}`}>
      <div className="sc-team-side">
        <img src={mlbTeamLogoUrl(game.awayTeam.id)} alt="" />
        <div><strong>{game.awayTeam.name}</strong><span>{game.awayTeam.abbreviation ?? 'AWAY'}</span></div>
      </div>
      <div className="sc-matchup-center"><b>@</b><span>{formatTime(game.gameDate)}</span></div>
      <div className="sc-team-side home">
        <img src={mlbTeamLogoUrl(game.homeTeam.id)} alt="" />
        <div><strong>{game.homeTeam.name}</strong><span>{game.homeTeam.abbreviation ?? 'HOME'}</span></div>
      </div>
    </div>
  );

  const PlayerPickGrid = ({ player, defs, scope }: { player: RosterPlayer; defs: PickDef[]; scope: 'batter' | 'pitcher' }) => (
    <div className="sc-pick-grid">
      {defs.map(def => {
        const current = picks.find(p => p.id === pickKey(scope, player.id, def.type));
        const selectedIndex = current ? def.options.findIndex(option => option.threshold === current.threshold && (option.direction ?? 'gte') === current.direction) : -1;
        return <label key={def.type} className="sc-pick-select"><span>{def.label}</span><select value={selectedIndex >= 0 ? String(selectedIndex) : ''} onChange={event => setPlayerPick(scope, player, def, event.target.value)}><option value="">—</option>{def.options.map((option, index) => <option key={`${def.type}-${index}`} value={index}>{option.label}</option>)}</select></label>;
      })}
    </div>
  );

  const PlayerRows = ({ players, scope }: { players: RosterPlayer[]; scope: 'batter' | 'pitcher' }) => (
    <div className="sc-player-list">
      {players.map(player => {
        const expanded = scope === 'batter' ? expandedBatter === player.id : expandedPitcher === player.id;
        const playerLogs = logs[player.id] ?? [];
        return <div key={player.id} className={`sc-player-card ${expanded ? 'expanded' : ''}`}>
          <button type="button" className="sc-player-row" onClick={() => scope === 'batter' ? setExpandedBatter(expanded ? null : player.id) : setExpandedPitcher(expanded ? null : player.id)}>
            <div className="sc-player-name"><img src={mlbPlayerHeadshotUrl(player.id, 96)} alt="" /><div><strong>{player.name}</strong><span>{player.position} · {player.teamName}</span></div></div>
            <div className="sc-recent-grid">
              {[0, 1, 2].map(index => { const log = playerLogs[index]; return <div key={index} className="sc-recent-cell"><span>{log ? formatDate(log.date) : '—'}</span><b>{log ? lineSummary(log, scope) : 'No log'}</b><small>{log?.opponent ?? ''}</small></div>; })}
            </div>
            <span className="material-symbols-outlined">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
          {expanded && <div className="sc-player-picks"><p>Select any categories you want for {player.name}. Choosing a new line replaces only that same category.</p><PlayerPickGrid player={player} defs={scope === 'batter' ? BATTER_DEFS : PITCHER_DEFS} scope={scope} /></div>}
        </div>;
      })}
    </div>
  );

  const PageActions = ({ back, next, nextLabel, disabled = false }: { back?: () => void; next?: () => void; nextLabel?: string; disabled?: boolean }) => (
    <div className="sc-actions">{back ? <button type="button" className="sc-btn secondary" onClick={back}><span className="material-symbols-outlined">arrow_back</span>BACK</button> : <span />}{next ? <button type="button" className="sc-btn primary" onClick={next} disabled={disabled}>{nextLabel ?? 'CONTINUE'}<span className="material-symbols-outlined">arrow_forward</span></button> : null}</div>
  );

  const renderWelcome = () => <>
    <div className="sc-welcome-grid">
      <section className="sc-welcome-art"><div className="sc-baseball-orbit"><span className="material-symbols-outlined">sports_baseball</span></div></section>
      <section className="sc-panel sc-welcome-copy">
        <p className="sc-mini-label">HOW THE CHALLENGE WORKS</p>
        <h1>Welcome to <em>ScoutCore Challenge!</em></h1>
        <p className="sc-lead">Build MLB predictions, let ScoutCore analyze them with verified data, review the evidence, then lock your Challenge Card before the game.</p>
        <div className="sc-how-list">
          {[['1','Choose a game','Pick from today’s or tomorrow’s MLB slate.'],['2','Build your picks','Choose batter, confirmed pitcher, and game selections.'],['3','Analyze','ScoutCore gives each selection a support score and explanation.'],['4','Review stats','Inspect recent logs, season/career numbers, team form, and matchup context.'],['5','Lock your picks','Once locked, your card is final. Results later affect accuracy and ScoutCore Points.']].map(item => <div key={item[0]}><b>{item[0]}</b><p><strong>{item[1]}</strong><span>{item[2]}</span></p></div>)}
        </div>
        <div className="sc-note">ScoutCore Points are profile-performance points only. They have no cash value and cannot be bought, exchanged, or withdrawn.</div>
      </section>
    </div>
    <div className="sc-feature-row"><div><span className="material-symbols-outlined">calendar_today</span><b>Daily Challenge</b><small>New MLB slate every day</small></div><div><span className="material-symbols-outlined">verified</span><b>Verified MLB Data</b><small>Recent logs and official stats</small></div><div><span className="material-symbols-outlined">trophy</span><b>Earn ScoutCore Points</b><small>Build accuracy and scout level</small></div></div>
    <PageActions next={() => setStep(2)} nextLabel="CONTINUE TO TODAY’S GAMES" />
  </>;

  const renderGames = () => <>
    <section className="sc-panel"><div className="sc-section-head"><div><p className="sc-mini-label">TODAY’S GAMES</p><h2>Select a matchup</h2></div></div>
      <div className="sc-game-grid">{todayGames.map(game => <button key={game.gamePk} type="button" className="sc-game-card" onClick={() => void loadGamePlayers(game)}><Matchup game={game} compact /><div className="sc-starters"><span>Starting pitchers</span><b>{game.awayProbablePitcher?.name ?? 'TBD'} · {game.homeProbablePitcher?.name ?? 'TBD'}</b></div></button>)}</div>
    </section>
    <section className="sc-panel"><div className="sc-section-head"><div><p className="sc-mini-label">TOMORROW’S GAMES</p><h2>Tomorrow’s slate</h2></div></div>
      <div className="sc-warning"><span className="material-symbols-outlined">warning</span><div><b>Some starting pitchers may not be decided yet.</b><p>You can still build picks if one or both starters are unconfirmed, but ScoutCore does not recommend it because the matchup context is incomplete.</p></div></div>
      <div className="sc-game-grid">{tomorrowGames.map(game => { const missing = !game.awayProbablePitcher?.id || !game.homeProbablePitcher?.id; return <button key={game.gamePk} type="button" className="sc-game-card" onClick={() => void loadGamePlayers(game)}><Matchup game={game} compact /><div className={`sc-starters ${missing ? 'missing' : ''}`}><span>{missing ? 'Pitcher status' : 'Starting pitchers'}</span><b>{game.awayProbablePitcher?.name ?? 'TBD'} · {game.homeProbablePitcher?.name ?? 'TBD'}</b></div></button>; })}</div>
    </section>
    <PageActions back={() => setStep(1)} />
  </>;

  const renderBatters = () => selectedGame && <>
    <section className="sc-panel"><Matchup game={selectedGame} compact /><div className="sc-section-head"><div><p className="sc-mini-label">RECENT 3 GAME LOGS</p><h2>Batters from both teams</h2><p>Open any player to set as many batter categories as you want.</p></div><span className="sc-count-chip">{selectedBatterPicks} batter picks</span></div><PlayerRows players={batters} scope="batter" /></section>
    <PageActions back={() => setStep(2)} next={() => setStep(4)} nextLabel="NEXT: PITCHERS" />
  </>;

  const renderPitchers = () => selectedGame && <>
    <section className="sc-panel"><Matchup game={selectedGame} compact /><div className="sc-section-head"><div><p className="sc-mini-label">CONFIRMED STARTING PITCHERS</p><h2>Pitcher picks</h2><p>Only probable starters already listed for this game are shown. ScoutCore will not fill in an undecided pitcher.</p></div><span className="sc-count-chip">{selectedPitcherPicks} pitcher picks</span></div>
      {confirmedPitchers.length ? <PlayerRows players={confirmedPitchers} scope="pitcher" /> : <div className="sc-empty"><span className="material-symbols-outlined">schedule</span><b>No starting pitcher is confirmed yet.</b><p>You can continue with batter and game picks, but pitcher analysis will be unavailable.</p></div>}
    </section>
    <PageActions back={() => setStep(3)} next={() => setStep(5)} nextLabel="NEXT: GAME PICKS" />
  </>;

  const renderGamePicks = () => selectedGame && <>
    <section className="sc-panel sc-game-picks-panel"><Matchup game={selectedGame} /><div className="sc-section-head"><div><p className="sc-mini-label">GAME PICKS</p><h2>Predict game outcomes</h2></div><span className="sc-count-chip">{selectedGamePicks} game picks</span></div>
      <div className="sc-game-pick-grid">
        <label className="sc-pick-select"><span>FIRST INNING</span><select onChange={e => setGamePick('game_first_inning','FIRST INNING',e.target.value)} defaultValue=""><option value="">—</option><option value={`0|1|eq|Run scored`}>Run scored</option><option value={`0|0|eq|No run scored`}>No run scored</option></select></label>
        <label className="sc-pick-select"><span>FIRST TEAM TO SCORE</span><select onChange={e => setGamePick('game_first_team_score','FIRST TEAM TO SCORE',e.target.value)} defaultValue=""><option value="">—</option><option value={`${selectedGame.awayTeam.id}|1|eq|${selectedGame.awayTeam.name}`}>{selectedGame.awayTeam.name}</option><option value={`${selectedGame.homeTeam.id}|1|eq|${selectedGame.homeTeam.name}`}>{selectedGame.homeTeam.name}</option></select></label>
        <label className="sc-pick-select"><span>TEAM RUNS</span><select onChange={e => setGamePick('team_runs','TEAM RUNS',e.target.value)} defaultValue=""><option value="">—</option>{[selectedGame.awayTeam, selectedGame.homeTeam].flatMap(team => [3,4,5].map(v => <option key={`${team.id}-${v}`} value={`${team.id}|${v}|gte|${team.name} ${v}+ runs`}>{team.abbreviation ?? team.name} · {v}+</option>))}</select></label>
        <label className="sc-pick-select"><span>TEAM HITS</span><select onChange={e => setGamePick('team_hits','TEAM HITS',e.target.value)} defaultValue=""><option value="">—</option>{[selectedGame.awayTeam, selectedGame.homeTeam].flatMap(team => [7,9,11].map(v => <option key={`${team.id}-${v}`} value={`${team.id}|${v}|gte|${team.name} ${v}+ hits`}>{team.abbreviation ?? team.name} · {v}+</option>))}</select></label>
        <label className="sc-pick-select"><span>EXTRA INNINGS</span><select onChange={e => setGamePick('game_extra_innings','EXTRA INNINGS',e.target.value)} defaultValue=""><option value="">—</option><option value={`0|1|eq|Yes`}>Yes</option><option value={`0|0|eq|No`}>No</option></select></label>
        <label className="sc-pick-select full"><span>WHO WINS? <em>OPTIONAL</em></span><select onChange={e => setGamePick('team_winner','WHO WINS?',e.target.value)} defaultValue=""><option value="">No winner pick</option><option value={`${selectedGame.awayTeam.id}|1|eq|${selectedGame.awayTeam.name}`}>{selectedGame.awayTeam.name}</option><option value={`${selectedGame.homeTeam.id}|1|eq|${selectedGame.homeTeam.name}`}>{selectedGame.homeTeam.name}</option></select></label>
      </div>
    </section>
    <PageActions back={() => setStep(4)} next={() => void buildAnalysis()} nextLabel={loading ? 'ANALYZING…' : 'CONTINUE TO ANALYZE'} disabled={!picks.length || loading} />
  </>;

  const analysisCounts = useMemo(() => {
    const values = Object.values(analysis);
    return { strong: values.filter(a => a.chance === 'STRONG').length, moderate: values.filter(a => a.chance === 'MODERATE').length, difficult: values.filter(a => a.chance === 'DIFFICULT').length, limited: values.filter(a => a.chance === 'LIMITED DATA').length };
  }, [analysis]);

  const renderAnalyze = () => <>
    <section className="sc-panel"><div className="sc-analysis-head"><div><p className="sc-mini-label">SCOUTCORE ANALYSIS</p><h2>How strongly does the data support each pick?</h2><p>These are support ratings, not guaranteed probabilities.</p></div><div className="sc-analysis-counts"><div><b>{picks.length}</b><span>Picks</span></div><div className="good"><b>{analysisCounts.strong}</b><span>Strong</span></div><div className="mid"><b>{analysisCounts.moderate}</b><span>Moderate</span></div><div className="hard"><b>{analysisCounts.difficult}</b><span>Difficult</span></div></div></div>
      <div className="sc-analysis-grid">{picks.map(pick => { const item = analysis[pick.id]; return <article key={pick.id} className="sc-analysis-card"><div className="sc-analysis-title"><div><strong>{pick.subjectName}</strong><span>{pick.label} · {pick.display}</span></div><div className={`sc-score ${item?.chance?.toLowerCase().replace(' ','-') ?? 'limited-data'}`}><b>{item?.score ?? '—'}</b><span>{item?.chance ?? 'LIMITED DATA'}</span></div></div><p>{item?.summary ?? 'Analysis unavailable.'}</p><ul>{(item?.factors ?? []).map(factor => <li key={factor}>{factor}</li>)}</ul></article>; })}</div>
    </section>
    <PageActions back={() => setStep(5)} next={() => setStep(7)} nextLabel="REVIEW STATS" />
  </>;

  const selectedPlayerIds = Array.from(new Set(picks.filter(p => p.scope !== 'game').map(p => p.subjectId)));

  const renderReview = () => selectedGame && <>
    <section className="sc-panel"><div className="sc-section-head"><div><p className="sc-mini-label">REVIEW STATS & INSIGHTS</p><h2>Evidence behind your selections</h2><p>Unlike Analyze, this page shows the underlying logs and context so you can inspect the inputs yourself.</p></div></div>
      <div className="sc-review-tabs"><button className={reviewTab === 'players' ? 'active' : ''} onClick={() => setReviewTab('players')}>PLAYER / PITCHER STATS</button><button className={reviewTab === 'teams' ? 'active' : ''} onClick={() => setReviewTab('teams')}>TEAM STATS</button><button className={reviewTab === 'matchup' ? 'active' : ''} onClick={() => setReviewTab('matchup')}>MATCHUP & CONTEXT</button></div>
      {reviewTab === 'players' && <div className="sc-evidence-list">{selectedPlayerIds.map(playerId => { const playerPicks = picks.filter(p => p.subjectId === playerId); const first = playerPicks[0]; const data = evidence[playerId]; const season = data?.season ?? {}; const career = data?.career ?? {}; return <article key={playerId} className="sc-evidence-card"><div className="sc-evidence-player"><img src={mlbPlayerHeadshotUrl(playerId, 100)} alt=""/><div><strong>{first?.subjectName}</strong><span>{first?.teamName}</span><small>{playerPicks.map(p => `${p.label} ${p.display}`).join(' · ')}</small></div></div><div className="sc-stat-strip"><div><span>Season AVG</span><b>{season.avg ?? '—'}</b></div><div><span>Season OPS</span><b>{season.ops ?? '—'}</b></div><div><span>Career AVG</span><b>{career.avg ?? '—'}</b></div><div><span>Career OPS</span><b>{career.ops ?? '—'}</b></div><div><span>ERA</span><b>{season.era ?? career.era ?? '—'}</b></div><div><span>WHIP</span><b>{season.whip ?? career.whip ?? '—'}</b></div></div><div className="sc-log-table"><div className="head"><span>Date</span><span>Opponent</span><span>Verified game log</span></div>{(data?.recent ?? []).map((log, index) => <div key={index}><span>{formatDate(log.date)}</span><span>{log.opponent}</span><b>{lineSummary(log, first?.scope ?? 'batter')}</b></div>)}</div></article>; })}</div>}
      {reviewTab === 'teams' && <div className="sc-team-review-grid">{[selectedGame.awayTeam, selectedGame.homeTeam].map(team => { const form = teamForms[team.id]; return <article key={team.id}><div className="sc-team-review-title"><img src={mlbTeamLogoUrl(team.id)} alt=""/><div><strong>{team.name}</strong><span>Last 10 completed games</span></div></div><div className="sc-big-stats"><div><span>Record</span><b>{form?.games ? `${form.wins}-${form.games-form.wins}` : '—'}</b></div><div><span>Runs / Game</span><b>{form?.games ? form.runsPerGame.toFixed(1) : '—'}</b></div><div><span>Hits / Game</span><b>{form?.games ? form.hitsPerGame.toFixed(1) : '—'}</b></div></div></article>; })}</div>}
      {reviewTab === 'matchup' && <div className="sc-matchup-review"><article><h3>Confirmed starters</h3>{confirmedPitchers.length ? confirmedPitchers.map(p => <div key={p.id}><img src={mlbPlayerHeadshotUrl(p.id,80)} alt=""/><span><b>{p.name}</b><small>{p.teamName}</small></span></div>) : <p>No starter is confirmed yet.</p>}</article><article><h3>What ScoutCore is checking</h3><ul><li>Exact line performance in the latest three verified game logs</li><li>Season and career production for selected hitters and pitchers</li><li>Opponent identity and whether the opposing starter is confirmed</li><li>Each team’s last-ten record, runs per game, and hits per game</li><li>Game-pick context is separated from player-pick evidence</li></ul></article><article><h3>Data note</h3><p>If a stat is shown as “—”, ScoutCore leaves it unavailable rather than inventing a value. Tomorrow’s games can be selected before both starters are announced, but matchup analysis is weaker until they are confirmed.</p></article></div>}
    </section>
    <PageActions back={() => setStep(6)} next={() => setStep(8)} nextLabel="NEXT: ALMOST DONE" />
  </>;

  const renderAlmostDone = () => selectedGame && <>
    <section className="sc-almost"><div className="sc-lock-orb"><span className="material-symbols-outlined">lock</span></div><div><p className="sc-mini-label">ALMOST DONE</p><h1>Lock Your Picks</h1><p>You can still go back and change anything. Once you press <b>LOCK MY PICKS</b>, your Challenge Card is final.</p></div></section>
    <section className="sc-panel sc-final-review"><div className="sc-final-grid"><div><span>BATTER PICKS</span><b>{selectedBatterPicks}</b></div><div><span>PITCHER PICKS</span><b>{selectedPitcherPicks}</b></div><div><span>GAME PICKS</span><b>{selectedGamePicks}</b></div><div><span>TOTAL PICKS</span><b>{picks.length}</b></div></div><Matchup game={selectedGame} compact /><button type="button" className="sc-btn primary lock" onClick={lockPicks}><span className="material-symbols-outlined">lock</span>LOCK MY PICKS</button></section>
    <PageActions back={() => setStep(7)} />
  </>;

  const renderLocked = () => <div className="sc-locked-page"><div className="sc-lock-success"><div className="sc-lock-orb success"><span className="material-symbols-outlined">check</span></div><h1>Picks are locked</h1><p>All your picks have been locked in. No changes can be made.</p></div><div className="sc-locked-counts"><div><span>BATTER PICKS</span><b>{selectedBatterPicks}</b></div><div><span>PITCHER PICKS</span><b>{selectedPitcherPicks}</b></div><div><span>GAME PICKS</span><b>{selectedGamePicks}</b></div></div><button type="button" className="sc-btn primary dashboard" onClick={onExit}><span className="material-symbols-outlined">home</span>GO BACK TO DASHBOARD</button></div>;

  return <div className="sc-challenge-fullscreen"><div className="sc-challenge-inner"><Header />{message && <div className="sc-message">{message}</div>}{loading && step !== 5 && <div className="sc-loading">Loading verified MLB data…</div>}{step === 1 && renderWelcome()}{step === 2 && renderGames()}{step === 3 && renderBatters()}{step === 4 && renderPitchers()}{step === 5 && renderGamePicks()}{step === 6 && renderAnalyze()}{step === 7 && renderReview()}{step === 8 && renderAlmostDone()}{step === 9 && renderLocked()}</div></div>;
};
