import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTeams } from '../services/mlbClient';
import { searchMlbPlayers } from '../services/profileClient';
import { mlbPlayerHeadshotUrl } from '../services/mlbMedia';

type PlayerChoice = {
  id: number;
  name: string;
  position?: string;
  group: 'hitting' | 'pitching';
  batSide?: string | null;
  pitchHand?: string | null;
  currentTeam?: { id: number; name: string } | null;
};

type WindowKey = 'L5' | 'L10' | 'L20' | 'L30' | 'SEASON' | 'H2H';
type Direction = 'gte' | 'lte';
type GameLog = {
  date: string;
  opponent: string;
  opponentId?: number | null;
  gamePk?: number | null;
  isHome?: boolean | null;
  stat: any;
};

type Context = {
  opponentStarterId?: number | null;
  opponentStarterName?: string | null;
  opponentStarterHand?: string | null;
  withPlayerActive?: boolean;
  withoutPlayerActive?: boolean;
  facedSelectedPitcher?: boolean;
  h2hStat?: Record<string, number> | null;
};

type TrendRow = GameLog & Context & {
  value: number;
  displayValue: string;
  success: boolean;
};

type Target = { label: string; value: number; direction: Direction };
type StatDef = {
  id: string;
  label: string;
  group: 'hitting' | 'pitching';
  targets: Target[];
  value: (stat: any) => number;
  display?: (value: number, stat?: any) => string;
};

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const feedCache = new Map<number, Promise<any>>();

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const rate = (wins: number, total: number) => total ? wins / total : 0;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const inningsToOuts = (value: unknown) => {
  const text = String(value ?? '0');
  const [wholeRaw, fracRaw = '0'] = text.split('.');
  const whole = Number(wholeRaw) || 0;
  const frac = Math.max(0, Math.min(2, Number(fracRaw) || 0));
  return whole * 3 + frac;
};
const outsToInnings = (outs: number) => `${Math.floor(outs / 3)}.${Math.max(0, outs % 3)}`;
const singles = (s: any) => Math.max(0, number(s?.hits) - number(s?.doubles) - number(s?.triples) - number(s?.homeRuns));
const reachedBase = (s: any) => number(s?.hits) + number(s?.baseOnBalls) + number(s?.hitByPitch);

const HITTER_STATS: StatDef[] = [
  { id: 'hits', label: 'Hits', group: 'hitting', targets: [1, 2, 3].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.hits) },
  { id: 'totalBases', label: 'Total Bases', group: 'hitting', targets: [1, 2, 3, 4].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.totalBases) },
  { id: 'reachBase', label: 'Reach Base', group: 'hitting', targets: [1, 2, 3].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: reachedBase },
  { id: 'homeRuns', label: 'Home Runs', group: 'hitting', targets: [1, 2].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.homeRuns) },
  { id: 'rbi', label: 'RBI', group: 'hitting', targets: [1, 2, 3].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.rbi) },
  { id: 'runs', label: 'Runs', group: 'hitting', targets: [1, 2, 3].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.runs) },
  { id: 'walks', label: 'Walks', group: 'hitting', targets: [1, 2].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.baseOnBalls) },
  { id: 'strikeouts', label: 'Batter Strikeouts', group: 'hitting', targets: [1, 2, 3].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.strikeOuts) },
  { id: 'singles', label: 'Singles', group: 'hitting', targets: [1, 2].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: singles },
  { id: 'doubles', label: 'Doubles', group: 'hitting', targets: [1, 2].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.doubles) },
  { id: 'extraBaseHits', label: 'Extra-Base Hits', group: 'hitting', targets: [1, 2].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.doubles) + number(s?.triples) + number(s?.homeRuns) },
  { id: 'stolenBases', label: 'Stolen Bases', group: 'hitting', targets: [1, 2].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.stolenBases) },
  { id: 'hrr', label: 'Hits + Runs + RBI', group: 'hitting', targets: [1, 2, 3, 4].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.hits) + number(s?.runs) + number(s?.rbi) },
];

const PITCHER_STATS: StatDef[] = [
  { id: 'pitcherStrikeouts', label: 'Pitcher Strikeouts', group: 'pitching', targets: [4, 5, 6, 7, 8, 9].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.strikeOuts) },
  { id: 'innings', label: 'Innings Pitched', group: 'pitching', targets: [{ label: '5.0+', value: 15, direction: 'gte' }, { label: '6.0+', value: 18, direction: 'gte' }, { label: '7.0+', value: 21, direction: 'gte' }], value: s => inningsToOuts(s?.inningsPitched), display: value => outsToInnings(value) },
  { id: 'outs', label: 'Outs Recorded', group: 'pitching', targets: [15, 18, 21].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => inningsToOuts(s?.inningsPitched) },
  { id: 'hitsAllowed', label: 'Hits Allowed', group: 'pitching', targets: [4, 5, 6].map(value => ({ label: `${value} or fewer`, value, direction: 'lte' as Direction })), value: s => number(s?.hits) },
  { id: 'earnedRuns', label: 'Earned Runs Allowed', group: 'pitching', targets: [1, 2, 3].map(value => ({ label: `${value} or fewer`, value, direction: 'lte' as Direction })), value: s => number(s?.earnedRuns) },
  { id: 'walksAllowed', label: 'Walks Allowed', group: 'pitching', targets: [1, 2, 3].map(value => ({ label: `${value} or fewer`, value, direction: 'lte' as Direction })), value: s => number(s?.baseOnBalls) },
  { id: 'pitchCount', label: 'Pitch Count', group: 'pitching', targets: [80, 90, 100].map(value => ({ label: `${value}+`, value, direction: 'gte' as Direction })), value: s => number(s?.numberOfPitches) },
  { id: 'qualityStart', label: 'Quality Start', group: 'pitching', targets: [{ label: 'Yes', value: 1, direction: 'gte' }], value: s => inningsToOuts(s?.inningsPitched) >= 18 && number(s?.earnedRuns) <= 3 ? 1 : 0, display: value => value >= 1 ? 'YES' : 'NO' },
];

const ALL_STATS = [...HITTER_STATS, ...PITCHER_STATS];
const succeeds = (value: number, target: Target) => target.direction === 'gte' ? value >= target.value : value <= target.value;

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
}

async function fetchPlayerLogs(player: PlayerChoice) {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${player.id}/stats?stats=gameLog&season=${season}&group=${player.group}`);
  return (data.stats?.[0]?.splits ?? []).map((split: any): GameLog => ({
    date: split.date,
    opponent: split.opponent?.name ?? '—',
    opponentId: split.opponent?.id ? Number(split.opponent.id) : null,
    gamePk: split.game?.gamePk ? Number(split.game.gamePk) : null,
    isHome: typeof split.isHome === 'boolean' ? split.isHome : null,
    stat: split.stat ?? {},
  })).sort((a: GameLog, b: GameLog) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

async function fetchGameFeed(gamePk: number) {
  if (!feedCache.has(gamePk)) {
    feedCache.set(gamePk, json(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`).catch(() => null));
  }
  return feedCache.get(gamePk)!;
}

function activeInGame(feed: any, playerId: number) {
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  const player = teams.away?.players?.[`ID${playerId}`] ?? teams.home?.players?.[`ID${playerId}`];
  if (!player) return false;
  return number(player?.stats?.batting?.plateAppearances) > 0 || inningsToOuts(player?.stats?.pitching?.inningsPitched) > 0;
}

function opponentStarter(feed: any, player: PlayerChoice) {
  const awayTeam = feed?.gameData?.teams?.away;
  const homeTeam = feed?.gameData?.teams?.home;
  const playerTeamId = player.currentTeam?.id;
  let opponentSide: 'away' | 'home' = 'away';
  if (playerTeamId && Number(awayTeam?.id) === playerTeamId) opponentSide = 'home';
  else if (playerTeamId && Number(homeTeam?.id) === playerTeamId) opponentSide = 'away';
  else {
    const playerInAway = Boolean(feed?.liveData?.boxscore?.teams?.away?.players?.[`ID${player.id}`]);
    opponentSide = playerInAway ? 'home' : 'away';
  }
  const box = feed?.liveData?.boxscore?.teams?.[opponentSide] ?? {};
  const starterId = Number(box?.pitchers?.[0]) || null;
  const person = starterId ? feed?.gameData?.players?.[`ID${starterId}`] : null;
  return { id: starterId, name: person?.fullName ?? null, hand: person?.pitchHand?.code ?? null };
}

function h2hStatFromFeed(feed: any, batterId: number, pitcherId: number) {
  const result = { hits: 0, totalBases: 0, reachBase: 0, homeRuns: 0, rbi: 0, walks: 0, strikeouts: 0, plateAppearances: 0 };
  let faced = false;
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    if (Number(play?.matchup?.batter?.id) !== batterId || Number(play?.matchup?.pitcher?.id) !== pitcherId) continue;
    faced = true;
    result.plateAppearances += 1;
    const event = String(play?.result?.eventType ?? '').toLowerCase();
    const rbi = number(play?.result?.rbi);
    result.rbi += rbi;
    if (event === 'single') { result.hits += 1; result.totalBases += 1; result.reachBase += 1; }
    if (event === 'double') { result.hits += 1; result.totalBases += 2; result.reachBase += 1; }
    if (event === 'triple') { result.hits += 1; result.totalBases += 3; result.reachBase += 1; }
    if (event === 'home_run') { result.hits += 1; result.totalBases += 4; result.reachBase += 1; result.homeRuns += 1; }
    if (event === 'walk' || event === 'intent_walk') { result.walks += 1; result.reachBase += 1; }
    if (event === 'hit_by_pitch') result.reachBase += 1;
    if (event === 'strikeout' || event === 'strikeout_double_play') result.strikeouts += 1;
  }
  return faced ? result : null;
}

async function contextForGame(log: GameLog, player: PlayerChoice, selectedPitcher: PlayerChoice | null, withPlayer: PlayerChoice | null, withoutPlayer: PlayerChoice | null) {
  if (!log.gamePk) return {} as Context;
  const feed = await fetchGameFeed(log.gamePk);
  if (!feed) return {} as Context;
  const starter = opponentStarter(feed, player);
  const h2hStat = player.group === 'hitting' && selectedPitcher ? h2hStatFromFeed(feed, player.id, selectedPitcher.id) : null;
  return {
    opponentStarterId: starter.id,
    opponentStarterName: starter.name,
    opponentStarterHand: starter.hand,
    withPlayerActive: withPlayer ? activeInGame(feed, withPlayer.id) : undefined,
    withoutPlayerActive: withoutPlayer ? activeInGame(feed, withoutPlayer.id) : undefined,
    facedSelectedPitcher: selectedPitcher ? Boolean(h2hStat) : undefined,
    h2hStat,
  } as Context;
}

async function fetchPitcherSeasonStats(playerId: number) {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${playerId}/stats?stats=season&season=${season}&group=pitching`);
  return data.stats?.[0]?.splits?.[0]?.stat ?? {};
}

const labelDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function SearchPicker({ label, value, onPick, group, placeholder }: { label: string; value: PlayerChoice | null; onPick: (player: PlayerChoice | null) => void; group?: 'hitting' | 'pitching'; placeholder: string }) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<PlayerChoice[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { setQuery(value?.name ?? ''); }, [value?.id]);
  useEffect(() => {
    const text = query.trim();
    if (!open || text.length < 2 || text === value?.name) { setResults([]); return; }
    const timer = window.setTimeout(() => {
      searchMlbPlayers(text).then((rows: any[]) => setResults(rows.filter(row => !group || row.group === group) as PlayerChoice[])).catch(() => setResults([]));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, open, group, value?.name]);
  return <div className="relative min-w-0">
    <label className="block text-[10px] text-[#94a4b7] mb-1.5">{label}</label>
    <div className="relative"><input value={query} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value.trim()) onPick(null); }} placeholder={placeholder} className="h-10 w-full rounded-lg border border-[#30415c] bg-[#0a1426] px-3 pr-8 text-xs text-[#e9f2ff] outline-none focus:border-[#00e6f4]"/><span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-2.5 text-[17px] text-[#6f8095]">search</span></div>
    {open && results.length > 0 && <div className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#30415c] bg-[#111b2f] shadow-2xl">{results.slice(0, 10).map(row => <button key={row.id} onMouseDown={e => e.preventDefault()} onClick={() => { onPick(row); setQuery(row.name); setOpen(false); }} className="flex w-full items-center gap-2 border-b border-[#26354d] px-3 py-2 text-left last:border-b-0 hover:bg-[#18263d]"><img src={mlbPlayerHeadshotUrl(row.id,80)} alt="" className="h-8 w-8 rounded bg-[#f0f4f8] object-contain"/><span className="min-w-0"><span className="block truncate text-xs font-bold text-white">{row.name}</span><span className="block text-[10px] text-[#849495]">{row.position ?? '—'}{row.currentTeam?.name ? ` · ${row.currentTeam.name}` : ''}</span></span></button>)}</div>}
  </div>;
}

export const PlayerPredictionsView: React.FC = () => {
  const [player, setPlayer] = useState<PlayerChoice | null>(null);
  const [playerQuery, setPlayerQuery] = useState('Ben Rice');
  const [playerResults, setPlayerResults] = useState<PlayerChoice[]>([]);
  const [playerSearchOpen, setPlayerSearchOpen] = useState(false);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [statId, setStatId] = useState('hits');
  const [targetIndex, setTargetIndex] = useState(0);
  const [windowKey, setWindowKey] = useState<WindowKey>('L10');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [pitcher, setPitcher] = useState<PlayerChoice | null>(null);
  const [pitcherHand, setPitcherHand] = useState<'ANY' | 'R' | 'L'>('ANY');
  const [homeAway, setHomeAway] = useState<'ANY' | 'HOME' | 'AWAY'>('ANY');
  const [withPlayer, setWithPlayer] = useState<PlayerChoice | null>(null);
  const [withoutPlayer, setWithoutPlayer] = useState<PlayerChoice | null>(null);
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pitcherStats, setPitcherStats] = useState<any>(null);
  const requestId = useRef(0);

  useEffect(() => { fetchTeams().then(setTeams).catch(() => setTeams([])); }, []);
  useEffect(() => {
    searchMlbPlayers('Ben Rice').then((results: any[]) => {
      const choice = results.find(row => row.name === 'Ben Rice') ?? results[0];
      if (choice) { setPlayer(choice as PlayerChoice); setPlayerQuery(choice.name); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const text = playerQuery.trim();
    if (!playerSearchOpen || text.length < 2 || text === player?.name) { setPlayerResults([]); return; }
    const timer = window.setTimeout(() => searchMlbPlayers(text).then((results: any[]) => setPlayerResults(results as PlayerChoice[])).catch(() => setPlayerResults([])), 220);
    return () => window.clearTimeout(timer);
  }, [playerQuery, playerSearchOpen, player?.name]);

  useEffect(() => {
    if (!player) { setLogs([]); return; }
    setError(null); setLoading(true);
    const stats = player.group === 'pitching' ? PITCHER_STATS : HITTER_STATS;
    if (!stats.some(s => s.id === statId)) { setStatId(stats[0].id); setTargetIndex(0); }
    fetchPlayerLogs(player).then(setLogs).catch(err => setError(err instanceof Error ? err.message : 'Unable to load player game logs.')).finally(() => setLoading(false));
  }, [player?.id]);

  useEffect(() => {
    if (!pitcher) { setPitcherStats(null); return; }
    fetchPitcherSeasonStats(pitcher.id).then(setPitcherStats).catch(() => setPitcherStats(null));
  }, [pitcher?.id]);

  const statDefs = player?.group === 'pitching' ? PITCHER_STATS : HITTER_STATS;
  const stat = statDefs.find(s => s.id === statId) ?? statDefs[0];
  const target = stat?.targets[targetIndex] ?? stat?.targets[0];

  useEffect(() => { setTargetIndex(0); }, [statId]);
  useEffect(() => { if (player?.group === 'pitching') { setPitcher(null); setPitcherHand('ANY'); } }, [player?.group]);

  useEffect(() => {
    if (!player || !stat || !target || !logs.length) { setRows([]); return; }
    const id = ++requestId.current;
    const run = async () => {
      setLoading(true); setError(null);
      try {
        let candidates = [...logs];
        if (opponentId) candidates = candidates.filter(log => Number(log.opponentId) === opponentId);
        if (homeAway !== 'ANY') candidates = candidates.filter(log => log.isHome == null || (homeAway === 'HOME' ? log.isHome === true : log.isHome === false));
        if (windowKey === 'H2H' && !opponentId) candidates = [];

        const advanced = Boolean(pitcher || pitcherHand !== 'ANY' || withPlayer || withoutPlayer);
        const scanLimit = windowKey === 'SEASON' || windowKey === 'H2H' ? 80 : 50;
        const scanned = advanced ? candidates.slice(0, scanLimit) : candidates;
        let contextual: Array<GameLog & Context> = scanned;
        if (advanced) {
          contextual = await Promise.all(scanned.map(async log => ({ ...log, ...(await contextForGame(log, player, pitcher, withPlayer, withoutPlayer)) })));
          if (pitcher) contextual = contextual.filter(row => row.facedSelectedPitcher);
          if (pitcherHand !== 'ANY') contextual = contextual.filter(row => row.opponentStarterHand === pitcherHand);
          if (withPlayer) contextual = contextual.filter(row => row.withPlayerActive === true);
          if (withoutPlayer) contextual = contextual.filter(row => row.withoutPlayerActive === false);
        }

        const limit = windowKey === 'L5' ? 5 : windowKey === 'L10' ? 10 : windowKey === 'L20' ? 20 : windowKey === 'L30' ? 30 : contextual.length;
        const qualified = contextual.slice(0, limit).map(row => {
          let sourceStat: any = row.stat;
          if (pitcher && row.h2hStat && ['hits','totalBases','reachBase','homeRuns','rbi','walks','strikeouts'].includes(stat.id)) sourceStat = row.h2hStat;
          const value = stat.value(sourceStat);
          return { ...row, value, displayValue: stat.display ? stat.display(value, sourceStat) : String(value), success: succeeds(value, target) } as TrendRow;
        });
        if (id === requestId.current) setRows(qualified);
      } catch (err) {
        if (id === requestId.current) { setRows([]); setError(err instanceof Error ? err.message : 'Unable to build this trend.'); }
      } finally { if (id === requestId.current) setLoading(false); }
    };
    void run();
  }, [player?.id, logs, statId, targetIndex, windowKey, opponentId, pitcher?.id, pitcherHand, homeAway, withPlayer?.id, withoutPlayer?.id]);

  const successCount = rows.filter(row => row.success).length;
  const hitRate = rate(successCount, rows.length);
  const values = rows.map(row => row.value);
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const med = median(values);
  let streak = 0; for (const row of rows) { if (row.success) streak += 1; else break; }

  const allBaseRows = useMemo(() => logs.map(log => { const value = stat?.value(log.stat) ?? 0; return { value, success: target ? succeeds(value, target) : false }; }), [logs, statId, targetIndex]);
  const seasonRate = rate(allBaseRows.filter(row => row.success).length, allBaseRows.length);
  const recentBase = allBaseRows.slice(0, 10);
  const recentRate = rate(recentBase.filter(row => row.success).length, recentBase.length);
  const filteredWeight = Math.min(0.5, 0.12 + rows.length * 0.038);
  let projection = rows.length ? filteredWeight * hitRate + 0.3 * recentRate + (0.7 - filteredWeight) * seasonRate : 0;
  if (player?.group === 'hitting' && pitcherStats && pitcher) {
    const whip = number(pitcherStats.whip);
    const era = number(pitcherStats.era);
    if (whip) projection += (whip - 1.25) * 0.06;
    if (era) projection += (era - 4.0) * 0.008;
  }
  projection = clamp(projection, 0.05, 0.95);
  const confidence = rows.length >= 12 ? 'HIGH' : rows.length >= 6 ? 'MEDIUM' : 'LOW';
  const chanceLabel = projection >= .67 ? 'Strong Chance' : projection >= .45 ? 'Moderate Chance' : 'Lower Chance';

  const samplePa = rows.reduce((sum, row) => sum + number(row.h2hStat?.plateAppearances ?? row.stat?.plateAppearances ?? row.stat?.battersFaced), 0);
  const selectedOpponent = teams.find(team => Number(team.id) === opponentId) ?? null;
  const reasons = [
    `${successCount} of ${rows.length || 0} qualifying games reached the selected target`,
    `Recent-10 baseline: ${pct(recentRate)} · season baseline: ${pct(seasonRate)}`,
    selectedOpponent ? `Opponent filter: ${selectedOpponent.name}` : 'All opponents included in the historical baseline',
    pitcher ? `${pitcher.name} matchup included${rows.length < 6 ? ' with a small sample' : ''}` : pitcherHand !== 'ANY' ? `Opponent starter hand filtered to ${pitcherHand}HP` : 'No specific opposing pitcher filter applied',
  ];

  const chartMax = Math.max(target?.value ?? 1, ...rows.map(row => row.value), 1);
  const chartCeiling = Math.max(2, Math.ceil(chartMax + (chartMax > 10 ? chartMax * .12 : 1)));
  const targetTop = 100 - Math.min(100, ((target?.value ?? 0) / chartCeiling) * 100);
  const showSmallSample = rows.length > 0 && rows.length < 6;
  const statLabel = stat?.label ?? 'Stat';

  const quickDefs = (player?.group === 'pitching' ? PITCHER_STATS : HITTER_STATS).filter(item => item.id !== statId).slice(0, 5);
  const quickCards = quickDefs.map(def => {
    const firstTargets = def.targets.slice(0, Math.min(def.targets.length, 4));
    return { def, targets: firstTargets.map(t => ({ label: t.label, rate: rate(rows.filter(row => succeeds(def.value(row.stat), t)).length, rows.length) })) };
  });

  return <div className="min-h-screen bg-[#071225] text-[#edf4ff] px-4 py-5 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1380px] space-y-4">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-[#24344e] pb-5">
        <div><p className="font-label-caps text-[11px] text-[#4fe9f4]">SCOUTCORE PERFORMANCE MODEL</p><h1 className="font-display-lg text-3xl sm:text-4xl mt-1">Player Predictions</h1><p className="mt-2 text-sm text-[#aab7c9]">Historical trends + ScoutCore projections for player performance.</p></div>
        <div className="flex items-center gap-2 text-[11px] text-[#95a5b9]"><span className="rounded-full border border-[#2d415e] bg-[#0e192c] px-3 py-1.5">Historical rate ≠ future certainty</span><span className="rounded-full border border-[#2d415e] bg-[#0e192c] px-3 py-1.5">{new Date().getFullYear()} Season</span></div>
      </header>

      <section className="rounded-xl border border-[#2b3f5b] bg-[#0d182b] p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_.8fr_.6fr_2.4fr_auto] lg:items-end">
          <div className="relative"><label className="block text-[10px] text-[#94a4b7] mb-1.5">PLAYER</label><div className="relative"><input value={playerQuery} onFocus={() => setPlayerSearchOpen(true)} onChange={e => { setPlayerQuery(e.target.value); setPlayerSearchOpen(true); }} className="h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] pl-11 pr-3 text-sm font-bold outline-none focus:border-[#00e6f4]"/><span className="absolute left-3 top-2.5 h-6 w-6 overflow-hidden rounded bg-[#f2f4f8]">{player && <img src={mlbPlayerHeadshotUrl(player.id,80)} alt="" className="h-full w-full object-contain"/>}</span></div>{playerSearchOpen && playerResults.length > 0 && <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#30415c] bg-[#111b2f] shadow-2xl">{playerResults.slice(0, 12).map(row => <button key={row.id} onClick={() => { setPlayer(row); setPlayerQuery(row.name); setPlayerSearchOpen(false); setOpponentId(null); setPitcher(null); setWithPlayer(null); setWithoutPlayer(null); }} className="flex w-full items-center gap-2 border-b border-[#26354d] px-3 py-2 text-left last:border-b-0 hover:bg-[#18263d]"><img src={mlbPlayerHeadshotUrl(row.id,80)} alt="" className="h-9 w-9 rounded bg-[#f2f4f8] object-contain"/><span><b className="block text-xs">{row.name}</b><span className="text-[10px] text-[#8999ac]">{row.position ?? '—'}{row.currentTeam?.name ? ` · ${row.currentTeam.name}` : ''}</span></span></button>)}</div>}</div>
          <label className="text-[10px] text-[#94a4b7]">STAT<select value={statId} onChange={e => setStatId(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold outline-none">{statDefs.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="text-[10px] text-[#94a4b7]">TARGET<select value={targetIndex} onChange={e => setTargetIndex(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-sm font-bold outline-none">{stat?.targets.map((item, index) => <option key={`${item.label}-${index}`} value={index}>{item.label}</option>)}</select></label>
          <div><span className="block text-[10px] text-[#94a4b7] mb-1.5">WINDOW</span><div className="grid h-11 grid-cols-6 rounded-lg border border-[#30415c] bg-[#091427] p-1">{(['L5','L10','L20','L30','SEASON','H2H'] as WindowKey[]).map(item => <button key={item} onClick={() => setWindowKey(item)} className={`rounded-md text-[10px] sm:text-xs font-bold ${windowKey === item ? 'bg-[#59e8f3] text-[#042f36]' : 'text-[#a8b5c6] hover:text-white'}`}>{item === 'SEASON' ? 'Season' : item}</button>)}</div></div>
          <button onClick={() => setFiltersOpen(value => !value)} className={`h-11 rounded-lg border px-4 text-xs font-bold ${filtersOpen ? 'border-[#00e6f4] text-[#00e6f4] bg-[#00e6f4]/8' : 'border-[#30415c] text-[#aebaca]'}`}><span className="material-symbols-outlined align-middle text-[17px] mr-1">tune</span>FILTERS</button>
        </div>

        {filtersOpen && <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#26364e] pt-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-[10px] text-[#94a4b7]">OPPONENT<select value={opponentId ?? ''} onChange={e => setOpponentId(e.target.value ? Number(e.target.value) : null)} className="mt-1.5 h-10 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-xs outline-none"><option value="">Any</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          {player?.group === 'hitting' ? <SearchPicker label="PITCHER" value={pitcher} onPick={setPitcher} group="pitching" placeholder="Any pitcher"/> : <div className="rounded-lg border border-[#27384f] bg-[#0a1426] p-3"><span className="text-[10px] text-[#718399]">PITCHER FILTER</span><p className="text-xs text-[#b8c3d1] mt-1">Not needed for pitcher trends.</p></div>}
          <label className="text-[10px] text-[#94a4b7]">PITCHER HAND<select disabled={player?.group === 'pitching'} value={pitcherHand} onChange={e => setPitcherHand(e.target.value as any)} className="mt-1.5 h-10 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-xs outline-none disabled:opacity-40"><option value="ANY">Any</option><option value="R">RHP</option><option value="L">LHP</option></select></label>
          <label className="text-[10px] text-[#94a4b7]">HOME / AWAY<select value={homeAway} onChange={e => setHomeAway(e.target.value as any)} className="mt-1.5 h-10 w-full rounded-lg border border-[#30415c] bg-[#091427] px-3 text-xs outline-none"><option value="ANY">Any</option><option value="HOME">Home</option><option value="AWAY">Away</option></select></label>
          <SearchPicker label="WITH PLAYER" value={withPlayer} onPick={setWithPlayer} placeholder="Any player"/>
          <SearchPicker label="WITHOUT PLAYER" value={withoutPlayer} onPick={setWithoutPlayer} placeholder="Any player"/>
        </div>}
        {windowKey === 'H2H' && !opponentId && <p className="mt-3 rounded-lg border border-[#ffd166]/25 bg-[#ffd166]/8 px-3 py-2 text-xs text-[#ffd166]">Choose an opponent to use H2H.</p>}
      </section>

      {error && <div className="rounded-xl border border-[#ff7d85]/30 bg-[#ff7d85]/10 p-3 text-sm text-[#ff9aa0]">{error}</div>}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-xl border border-[#30415c] bg-[#0d182b] p-4 sm:p-5 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#56e9f4]">HISTORICAL TREND</p><h2 className="text-xl font-bold mt-1">{player?.name ?? 'Select a player'} — {target?.label} {statLabel}</h2><p className="text-xs text-[#93a3b7] mt-1">{rows.length} qualifying game{rows.length === 1 ? '' : 's'}{pitcher ? ` · vs ${pitcher.name}` : ''}</p></div><div className="flex items-center gap-3 text-[10px]"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#42e2eb]"/>TARGET HIT</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#ff515a]"/>MISS</span></div></div>

          <div className="relative mt-5 h-[270px] border-b border-l border-[#41506a] pl-3">
            <div className="absolute left-0 right-0 border-t border-dashed border-[#d8e4f3]/55" style={{ top: `${targetTop}%` }}><span className="absolute right-0 -translate-y-full bg-[#0d182b] pl-2 text-[10px] text-[#d8e4f3]">{target?.label} target</span></div>
            {[0, .25, .5, .75, 1].map(step => <div key={step} className="absolute left-0 right-0 border-t border-dashed border-[#31405a]/55" style={{ top: `${100 - step * 100}%` }}><span className="absolute -left-7 -top-2 text-[9px] text-[#78899e]">{Math.round(chartCeiling * step)}</span></div>)}
            <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2 px-2 pb-0 pt-3 overflow-x-auto">{rows.map((row, index) => { const height = row.value <= 0 ? 2 : Math.max(5, (row.value / chartCeiling) * 100); return <div key={`${row.gamePk}-${row.date}-${index}`} className="flex h-full min-w-[42px] flex-1 flex-col justify-end group"><div className="relative flex h-full items-end justify-center"><div title={`${row.opponent} ${row.date}: ${row.displayValue} ${statLabel}`} className={`relative w-[70%] max-w-9 rounded-t-sm transition-all group-hover:brightness-125 ${row.success ? 'bg-[#42e2eb]' : 'bg-[#ff515a]'}`} style={{ height: `${height}%` }}><span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold ${row.success ? 'text-[#5cf1f7]' : 'text-[#ff6068]'}`}>{row.displayValue}</span></div></div><div className="h-11 pt-1 text-center"><p className="truncate text-[9px] font-bold text-[#cbd5e2]">{row.opponent.replace(/^Los Angeles /,'LA ').replace(/^New York /,'NY ')}</p><p className="text-[9px] text-[#73859a]">{labelDate(row.date)}</p></div></div>; })}{!loading && rows.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#7f90a4]">No qualifying games for these filters.</div>}</div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 divide-x divide-[#2b3b53] rounded-xl border border-[#2b3b53] bg-[#091427] p-3 text-center">
            <Metric label="HIT RATE" value={`${successCount}/${rows.length || 0} (${pct(hitRate)})`} accent />
            <Metric label="AVERAGE" value={stat?.display ? stat.display(average) : average.toFixed(1)} />
            <Metric label="MEDIAN" value={stat?.display ? stat.display(Math.round(med)) : Number.isInteger(med) ? String(med) : med.toFixed(1)} />
            <Metric label="CURRENT STREAK" value={String(streak)} accent />
            <Metric label="SAMPLE" value={player?.group === 'hitting' ? `${rows.length} games · ${samplePa} PA` : `${rows.length} games`} />
          </div>
          <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${showSmallSample ? 'border-[#ffd166]/30 bg-[#ffd166]/8 text-[#ffd166]' : 'border-[#45e6c0]/20 bg-[#45e6c0]/7 text-[#8bead3]'}`}><span className="material-symbols-outlined text-[17px]">{showSmallSample ? 'warning' : 'verified'}</span>{showSmallSample ? 'Small sample. Treat this historical rate cautiously.' : rows.length ? 'Sample is large enough to display a trend, but it is still historical—not a guarantee.' : 'Choose broader filters to build a sample.'}</div>
        </div>

        <div className="rounded-xl border border-[#30415c] bg-[#0d182b] p-4 sm:p-5">
          <p className="text-xs font-bold text-[#56e9f4]">SCOUTCORE PROJECTION</p>
          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr] xl:grid-cols-1 2xl:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center justify-center"><div className="relative h-44 w-44"><svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r="49" fill="none" stroke="#24344d" strokeWidth="13"/><circle cx="60" cy="60" r="49" fill="none" stroke="#48dfea" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${projection * 308} 308`}/></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] text-[#93a3b7]">PROJECTED CHANCE</span><strong className="font-data-numeric text-5xl text-[#59e8f3]">{pct(projection)}</strong></div></div><p className="mt-1 text-xl font-bold text-[#5ae9f2]">{chanceLabel}</p><p className={`mt-2 rounded-full px-3 py-1 text-[10px] font-bold ${confidence === 'HIGH' ? 'bg-[#55e2b0]/10 text-[#55e2b0]' : confidence === 'MEDIUM' ? 'bg-[#ffd166]/10 text-[#ffd166]' : 'bg-[#ff7d85]/10 text-[#ff8f96]'}`}>MODEL CONFIDENCE: {confidence}</p></div>
            <div><h3 className="font-bold">Why we think this</h3><div className="mt-3 space-y-3">{reasons.map(reason => <div key={reason} className="flex items-start gap-2 text-sm leading-5 text-[#c8d2df]"><span className="material-symbols-outlined mt-0.5 text-[17px] text-[#48dfea]">check_circle</span><span>{reason}</span></div>)}</div></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><TinyMetric label="FILTERED RATE" value={pct(hitRate)}/><TinyMetric label="RECENT-10" value={pct(recentRate)}/><TinyMetric label="SEASON" value={pct(seasonRate)}/><TinyMetric label="SAMPLE" value={String(rows.length)}/>{pitcher && <><TinyMetric label="OPP WHIP" value={pitcherStats?.whip ?? '—'}/><TinyMetric label="OPP ERA" value={pitcherStats?.era ?? '—'}/></>}</div>
          <p className="mt-4 text-[11px] leading-5 text-[#7f90a4]">ScoutCore Projection is a model estimate built from verified historical performance and the filters above. It is not an official MLB statistic and does not guarantee a future result.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">{quickCards.map(({ def, targets }) => <div key={def.id} className="rounded-xl border border-[#2c3e58] bg-[#0d182b] p-4"><h3 className="font-bold">{def.label}</h3><div className="mt-3 flex items-end gap-2 h-20">{targets.map(item => <div key={item.label} className="flex-1 text-center"><div className="mx-auto w-full max-w-12 rounded-t-sm bg-[#42e2eb]" style={{height:`${Math.max(4,item.rate*55)}px`}}/><p className="mt-1 text-xs font-bold">{pct(item.rate)}</p><p className="text-[9px] text-[#8293a8]">{item.label}</p></div>)}</div><p className="mt-2 text-center text-[9px] text-[#77899f]">Historical rate in current qualifying games</p></div>)}</section>

      <section className="rounded-xl border border-[#2c3e58] bg-[#0d182b] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2c3e58] px-4 py-3"><div><p className="text-[10px] font-label-caps text-[#55e5ef]">QUALIFYING GAME LOG</p><h2 className="font-bold">What the graph is using</h2></div><span className="text-xs text-[#8192a6]">Verified MLB game-log data</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#091427] text-[#8495aa]"><tr><th className="px-4 py-3">DATE</th><th>OPPONENT</th><th>HOME/AWAY</th><th>{statLabel.toUpperCase()}</th><th>AB / PA / IP</th><th>OPP STARTER</th><th>RESULT</th></tr></thead><tbody>{rows.map(row => <tr key={`log-${row.gamePk}-${row.date}`} className="border-t border-[#26364e]"><td className="px-4 py-3">{row.date}</td><td>{row.opponent}</td><td>{row.isHome == null ? '—' : row.isHome ? 'HOME' : 'AWAY'}</td><td className="font-data-numeric font-bold">{row.displayValue}</td><td>{player?.group === 'hitting' ? `${row.stat?.atBats ?? '—'} AB · ${row.h2hStat?.plateAppearances ?? row.stat?.plateAppearances ?? '—'} PA` : `${row.stat?.inningsPitched ?? '—'} IP`}</td><td>{row.opponentStarterName ? `${row.opponentStarterName}${row.opponentStarterHand ? ` (${row.opponentStarterHand}HP)` : ''}` : '—'}</td><td><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.success ? 'bg-[#42e2eb]/10 text-[#55eaf2]' : 'bg-[#ff515a]/10 text-[#ff7279]'}`}>{row.success ? 'TARGET HIT' : 'MISS'}</span></td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#7f90a4]">No qualifying games to show.</td></tr>}</tbody></table></div>
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-[#2c3e58] bg-[#0b1628] p-4"><span className="material-symbols-outlined text-[#55e5ef]">menu_book</span><div><h3 className="font-bold">How to read this</h3><p className="mt-1 text-xs leading-5 text-[#8fa0b4]"><b className="text-[#cbd8e7]">Historical Trend</b> shows what actually happened in qualifying games. <b className="text-[#cbd8e7]">ScoutCore Projection</b> estimates the selected outcome next using historical rates and matchup context. Cyan means the selected target was reached; red means it was missed.</p></div></section>
    </div>
  </div>;
};

const Metric = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => <div className="px-2 py-1"><p className="text-[9px] text-[#8394a8]">{label}</p><p className={`mt-1 font-data-numeric text-sm sm:text-base font-bold ${accent ? 'text-[#52e7f0]' : 'text-[#f0f5ff]'}`}>{value}</p></div>;
const TinyMetric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="rounded-lg border border-[#293b54] bg-[#091427] px-3 py-2 text-center"><p className="text-[9px] text-[#8293a8]">{label}</p><p className="mt-1 font-data-numeric text-lg font-bold text-white">{value}</p></div>;
