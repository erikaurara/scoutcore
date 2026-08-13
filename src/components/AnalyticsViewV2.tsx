import React, { useEffect, useMemo, useState } from 'react';
import { mlbPlayerHeadshotUrl } from '../services/mlbMedia';
import { AnalyticsTeamPicker, type AnalyticsTeamOption } from './AnalyticsTeamPicker';

type Range = 'TODAY' | 'YESTERDAY' | 'LAST 3 DAYS' | 'LAST 7 DAYS';
const ALL_TEAMS = 'ALL TEAMS';
const day = (offset = 0) => { const date = new Date(); date.setDate(date.getDate() + offset); return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); };
const json = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error(`MLB request failed (${response.status})`); return response.json(); };

const rowsFromFeed = (feed: any, date: string) => {
  const rows: any[] = [];
  const gamePk = feed?.gameData?.game?.pk;
  const venue = feed?.gameData?.venue?.name ?? '—';
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  (['away', 'home'] as const).forEach((side) => {
    const block = teams?.[side] ?? {};
    const other = side === 'away' ? 'home' : 'away';
    const team = block?.team?.name ?? feed?.gameData?.teams?.[side]?.name ?? 'Unknown Team';
    const opponent = teams?.[other]?.team?.name ?? feed?.gameData?.teams?.[other]?.name ?? 'Unknown opponent';
    for (const player of Object.values(block?.players ?? {}) as any[]) {
      const id = player?.person?.id;
      const name = player?.person?.fullName ?? 'MLB Player';
      const bat = player?.stats?.batting;
      if (bat && Number(bat.plateAppearances ?? 0) > 0) {
        const h = Number(bat.hits ?? 0), hr = Number(bat.homeRuns ?? 0), rbi = Number(bat.rbi ?? 0), bb = Number(bat.baseOnBalls ?? 0), tb = Number(bat.totalBases ?? 0), so = Number(bat.strikeOuts ?? 0), ab = Number(bat.atBats ?? 0), runs = Number(bat.runs ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(45 + h * 9 + hr * 16 + rbi * 5 + bb * 3 + tb * 1.5 - so * 2)));
        rows.push({ key: `${gamePk}-h-${id}`, playerId: id, player: name, team, opponent, venue, date, type: 'HITTER', index, summary: `${h} H · ${hr} HR · ${rbi} RBI${runs ? ` · ${runs} R` : ''}`, detail: `${ab} AB · ${bb} BB · ${so} SO · ${tb} TB` });
      }
      const pitch = player?.stats?.pitching;
      if (pitch && Number.parseFloat(String(pitch.inningsPitched ?? '0')) > 0) {
        const ip = Number.parseFloat(String(pitch.inningsPitched ?? '0')) || 0, k = Number(pitch.strikeOuts ?? 0), er = Number(pitch.earnedRuns ?? 0), h = Number(pitch.hits ?? 0), bb = Number(pitch.baseOnBalls ?? 0), pitches = Number(pitch.numberOfPitches ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(50 + ip * 5 + k * 4 - er * 9 - h * 2 - bb * 2)));
        rows.push({ key: `${gamePk}-p-${id}`, playerId: id, player: name, team, opponent, venue, date, type: 'PITCHER', index, summary: `${pitch.inningsPitched} IP · ${k} K · ${er} ER`, detail: `${h} H · ${bb} BB · ${pitches || '—'} P` });
      }
    }
  });
  return rows;
};

export const AnalyticsViewV2: React.FC = () => {
  const [range, setRange] = useState<Range>('YESTERDAY');
  const [team, setTeam] = useState(ALL_TEAMS);
  const [teamOptions, setTeamOptions] = useState<AnalyticsTeamOption[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dates = useMemo(() => range === 'TODAY' ? [day()] : range === 'YESTERDAY' ? [day(-1)] : range === 'LAST 3 DAYS' ? [day(-1), day(-2), day(-3)] : Array.from({ length: 7 }, (_, index) => day(-(index + 1))), [range]);

  useEffect(() => { json('https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026').then((data) => setTeamOptions((data?.teams ?? []).map((item: any) => ({ id: Number(item.id), name: String(item.name) })).sort((a: AnalyticsTeamOption, b: AnalyticsTeamOption) => a.name.localeCompare(b.name)))).catch(() => setTeamOptions([])); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const schedules = await Promise.all(dates.map(async (date) => ({ date, data: await json(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`) })));
      const gameList = schedules.flatMap(({ date, data }) => (data?.dates ?? []).flatMap((item: any) => (item.games ?? []).map((game: any) => ({ ...game, _date: date }))));
      setGames(gameList);
      const feeds = await Promise.all(gameList.map((game: any) => json(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`).then((feed) => ({ feed, date: game._date })).catch(() => null)));
      setRows(feeds.filter(Boolean).flatMap((item: any) => rowsFromFeed(item.feed, item.date)).sort((a: any, b: any) => b.index - a.index));
    } catch (err) { setRows([]); setError(err instanceof Error ? err.message : 'Unable to load analytics.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setTeam(ALL_TEAMS); setSelected(null); void load(); const timer = window.setInterval(() => void load(), 10 * 60 * 1000); return () => window.clearInterval(timer); }, [range]);

  const visible = useMemo(() => team === ALL_TEAMS ? rows : rows.filter((row) => row.team === team), [rows, team]);
  const visibleGames = useMemo(() => team === ALL_TEAMS ? games : games.filter((game) => game?.teams?.away?.team?.name === team || game?.teams?.home?.team?.name === team), [games, team]);
  const hitters = visible.filter((row) => row.type === 'HITTER').length;
  const pitchers = visible.filter((row) => row.type === 'PITCHER').length;
  const standouts = visible.filter((row) => row.index >= 75).length;
  const average = visible.length ? (visible.reduce((sum, row) => sum + row.index, 0) / visible.length).toFixed(1) : '—';

  return <div className="min-h-screen space-y-6 bg-[#0b1326] p-5 text-[#dae2fd] sm:p-8">
    <header className="flex flex-wrap justify-between gap-5"><div><p className="text-xs font-extrabold tracking-[.14em] text-[#65f2b5]">VERIFIED MLB DATA</p><h1 className="mt-1 text-4xl font-extrabold text-white">Analytics</h1><p className="mt-2 text-sm text-[#aab8ca]">Verified MLB performance analytics from live and completed games.</p></div><div className="flex flex-col items-stretch gap-3 sm:items-end"><div className="flex flex-wrap gap-1 rounded-xl bg-[#131b2e] p-1.5">{(['TODAY','YESTERDAY','LAST 3 DAYS','LAST 7 DAYS'] as Range[]).map((item) => <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-lg px-4 py-2 text-xs font-extrabold ${range === item ? 'bg-[#63e9ef] text-[#042d33]' : 'text-[#bcc8d5] hover:text-white'}`}>{item}</button>)}</div><AnalyticsTeamPicker options={teamOptions} value={team} allLabel={ALL_TEAMS} onChange={setTeam} /></div></header>
    {error && <div className="rounded-xl border border-[#ff9c9c]/30 bg-[#ff9c9c]/10 p-4 text-sm text-[#ffc1c1]">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="GAMES" value={visibleGames.length} /><Metric label="HITTERS" value={hitters} /><Metric label="PITCHERS" value={pitchers} /><Metric label="STANDOUTS" value={standouts} /><Metric label="AVG INDEX" value={average} /></section>
    <section className="rounded-2xl border border-[#2c3e57] bg-[#121c2f] p-5"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold text-[#aab8ca]">TOP PERFORMANCE SIGNALS</p><h2 className="mt-1 text-2xl font-extrabold text-white">{team === ALL_TEAMS ? 'Best verified performances' : `${team} performances`}</h2></div><button type="button" onClick={() => void load()} className="text-xs font-extrabold text-[#63e9ef]">REFRESH</button></div>{loading ? <p className="py-8 text-center text-sm text-[#aab8ca]">Loading MLB analytics…</p> : <div className="space-y-3">{visible.slice(0, 20).map((row, index) => <button key={row.key} type="button" onClick={() => setSelected(row)} className="grid w-full grid-cols-[44px_82px_minmax(0,1fr)_72px] items-center gap-3 rounded-xl border border-[#2c3e57] bg-[#0d1729] p-3 text-left hover:border-[#63e9ef]/60"><span className="font-mono text-sm text-[#aab8ca]">#{index + 1}</span><img src={mlbPlayerHeadshotUrl(row.playerId, 180)} alt="" className="h-20 w-20 object-contain"/><span className="min-w-0"><strong className="block truncate text-lg text-white">{row.player}</strong><span className="mt-1 block truncate text-sm text-[#b8c5d3]">{row.team} · vs {row.opponent}</span><span className="mt-2 block text-base font-bold text-[#eef4fa]">{row.summary}</span><span className="mt-1 block text-sm text-[#aab8ca]">{row.detail}</span></span><span className="text-right"><small className="block text-[#aab8ca]">INDEX</small><strong className="font-mono text-3xl text-[#63e9ef]">{row.index}</strong></span></button>)}{!visible.length && <p className="py-8 text-center text-sm text-[#aab8ca]">No player performance data is available for this team and period yet.</p>}</div>}</section>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><article className="w-full max-w-xl rounded-2xl border border-[#63e9ef]/35 bg-[#101a2d] p-5 shadow-2xl"><div className="flex items-start gap-4"><img src={mlbPlayerHeadshotUrl(selected.playerId, 220)} alt="" className="h-28 w-28 object-contain"/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#63e9ef]">{selected.type} PERFORMANCE</p><h2 className="mt-1 text-2xl font-extrabold text-white">{selected.player}</h2><p className="mt-1 text-sm text-[#b8c5d3]">{selected.team} vs {selected.opponent}</p><p className="mt-3 text-lg font-bold text-white">{selected.summary}</p><p className="mt-1 text-sm text-[#aab8ca]">{selected.detail}</p><p className="mt-3 text-sm text-[#aab8ca]">{selected.venue} · {selected.date}</p></div><button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#3a4d68]"><span className="material-symbols-outlined">close</span></button></div></article></div>}
  </div>;
};

const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="rounded-xl border border-[#2c3e57] bg-[#121c2f] p-5"><p className="text-xs font-bold text-[#aab8ca]">{label}</p><p className="mt-1 text-3xl font-extrabold text-white">{value}</p></div>;
