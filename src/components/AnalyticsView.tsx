import React, { useEffect, useMemo, useState } from 'react';
import { mlbPlayerHeadshotUrl } from '../services/mlbMedia';

type Range = 'TODAY' | 'YESTERDAY' | 'LAST 3 DAYS' | 'LAST 7 DAYS';

const ALL_TEAMS = 'ALL TEAMS';
const dateKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};
async function fetchJson(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(`MLB request failed (${r.status})`); return r.json(); }
const cleanAvg = (v: any) => String(v ?? '—').replace(/^0(?=\.)/, '');

function buildRows(feed: any, date: string) {
  const rows: any[] = [];
  const gamePk = feed?.gameData?.game?.pk ?? feed?.gamePk;
  const venue = feed?.gameData?.venue?.name ?? '—';
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  (['away', 'home'] as const).forEach(side => {
    const block = teams?.[side] ?? {};
    const other = side === 'away' ? 'home' : 'away';
    const team = block?.team?.name ?? feed?.gameData?.teams?.[side]?.name ?? 'Unknown Team';
    const opponent = teams?.[other]?.team?.name ?? feed?.gameData?.teams?.[other]?.name ?? 'Unknown opponent';
    const players = Object.values(block?.players ?? {}) as any[];
    for (const p of players) {
      const playerId = p.person?.id;
      const batting = p?.stats?.batting;
      if (batting && Number(batting.plateAppearances ?? 0) > 0) {
        const hits = Number(batting.hits ?? 0), hr = Number(batting.homeRuns ?? 0), rbi = Number(batting.rbi ?? 0), runs = Number(batting.runs ?? 0), bb = Number(batting.baseOnBalls ?? 0), tb = Number(batting.totalBases ?? 0), so = Number(batting.strikeOuts ?? 0), ab = Number(batting.atBats ?? 0), pa = Number(batting.plateAppearances ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(45 + hits * 9 + hr * 16 + rbi * 5 + bb * 3 + tb * 1.5 - so * 2)));
        rows.push({ id: `${date}-${gamePk}-h-${playerId}`, gamePk, playerId, date, player: p.person?.fullName ?? 'Unknown', team, opponent, side, type: 'HITTER', index, venue, summary: `${hits} H · ${hr} HR · ${rbi} RBI${runs ? ` · ${runs} R` : ''}`, detail: `${ab} AB · ${bb} BB · ${so} SO · ${tb} TB`, gameStats: { pa, ab, hits, hr, rbi, runs, bb, so, tb }, fullDetail: `${pa} PA · ${ab} AB · ${hits} H · ${hr} HR · ${rbi} RBI · ${runs} R · ${bb} BB · ${so} SO · ${tb} TB` });
      }
      const pitching = p?.stats?.pitching;
      if (pitching && Number.parseFloat(String(pitching.inningsPitched ?? '0')) > 0) {
        const ip = Number.parseFloat(String(pitching.inningsPitched ?? '0')) || 0, k = Number(pitching.strikeOuts ?? 0), er = Number(pitching.earnedRuns ?? 0), h = Number(pitching.hits ?? 0), bb = Number(pitching.baseOnBalls ?? 0), pitches = Number(pitching.numberOfPitches ?? 0), strikes = Number(pitching.strikes ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(50 + ip * 5 + k * 4 - er * 9 - h * 2 - bb * 2)));
        rows.push({ id: `${date}-${gamePk}-p-${playerId}`, gamePk, playerId, date, player: p.person?.fullName ?? 'Unknown', team, opponent, side, type: 'PITCHER', index, venue, summary: `${pitching.inningsPitched} IP · ${k} K · ${er} ER`, detail: `${h} H · ${bb} BB · ${pitches || '—'} P`, gameStats: { ip: pitching.inningsPitched, k, er, h, bb, pitches, strikes }, fullDetail: `${pitching.inningsPitched} IP · ${h} H · ${er} ER · ${bb} BB · ${k} K · ${pitches || '—'} P · ${strikes || '—'} strikes` });
      }
    }
  });
  return rows;
}

function extractStats(payload: any) {
  const all = payload?.stats ?? [];
  const season = all.find((s: any) => String(s?.type?.displayName ?? '').toLowerCase().includes('season'))?.splits?.[0]?.stat ?? null;
  const gameLog = all.find((s: any) => String(s?.type?.displayName ?? '').toLowerCase().includes('game'))?.splits ?? [];
  return { season, recent: gameLog.slice(-5).reverse() };
}
function performanceSummary(row: any, detail: any) {
  if (!detail?.season) return 'Season context is still loading from MLB data.';
  const s = detail.season;
  if (row.type === 'HITTER') return `${row.player} produced ${row.summary.replace(/ · /g, ', ')} against ${row.opponent}. Season line: ${cleanAvg(s.avg)} AVG / ${cleanAvg(s.obp)} OBP / ${cleanAvg(s.slg)} SLG, ${s.homeRuns ?? '—'} HR, ${s.rbi ?? '—'} RBI.`;
  return `${row.player} finished with ${row.summary.replace(/ · /g, ', ')} against ${row.opponent}. Season profile: ${s.era ?? '—'} ERA, ${s.whip ?? '—'} WHIP, ${s.strikeoutsPer9Inn ?? '—'} K/9 across ${s.inningsPitched ?? '—'} IP.`;
}

export const AnalyticsView: React.FC = () => {
  const [range, setRange] = useState<Range>('YESTERDAY');
  const [selectedTeam, setSelectedTeam] = useState(ALL_TEAMS);
  const [games, setGames] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const dates = useMemo(() => range === 'TODAY' ? [dateKey(0)] : range === 'YESTERDAY' ? [dateKey(-1)] : range === 'LAST 3 DAYS' ? [dateKey(-1), dateKey(-2), dateKey(-3)] : Array.from({ length: 7 }, (_, index) => dateKey(-(index + 1))), [range]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const schedules = await Promise.all(dates.map(async date => ({ date, data: await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`) })));
      const gameList = schedules.flatMap(({ date, data }) => (data?.dates ?? []).flatMap((d: any) => (d.games ?? []).map((g: any) => ({ ...g, _date: date }))));
      setGames(gameList);
      const feeds = await Promise.all(gameList.map((g: any) => fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`).then(feed => ({ feed, date: g._date })).catch(() => null)));
      setRows(feeds.filter(Boolean).flatMap((x: any) => buildRows(x.feed, x.date)).sort((a: any, b: any) => b.index - a.index));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelected(null);
    setSelectedTeam(ALL_TEAMS);
    load();
    const timer = window.setInterval(load, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [range]);

  useEffect(() => {
    if (!selected) { setReport(null); return; }
    setReportLoading(true);
    setReport(null);
    const group = selected.type === 'HITTER' ? 'hitting' : 'pitching';
    fetchJson(`https://statsapi.mlb.com/api/v1/people/${selected.playerId}/stats?stats=season,gameLog&group=${group}&season=2026`).then(data => setReport(extractStats(data))).catch(() => setReport({ season: null, recent: [] })).finally(() => setReportLoading(false));
  }, [selected]);

  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    games.forEach(game => {
      const away = game?.teams?.away?.team?.name;
      const home = game?.teams?.home?.team?.name;
      if (away) names.add(away);
      if (home) names.add(home);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [games]);

  const filteredRows = useMemo(() => selectedTeam === ALL_TEAMS ? rows : rows.filter(row => row.team === selectedTeam), [rows, selectedTeam]);
  const filteredGames = useMemo(() => selectedTeam === ALL_TEAMS ? games : games.filter(game => game?.teams?.away?.team?.name === selectedTeam || game?.teams?.home?.team?.name === selectedTeam), [games, selectedTeam]);
  const avgIndex = useMemo(() => filteredRows.length ? filteredRows.reduce((sum, row) => sum + row.index, 0) / filteredRows.length : null, [filteredRows]);
  const hitterCount = filteredRows.filter(row => row.type === 'HITTER').length;
  const pitcherCount = filteredRows.filter(row => row.type === 'PITCHER').length;
  const standoutCount = filteredRows.filter(row => row.index >= 75).length;
  const headingBase = range === 'TODAY' ? 'Best verified performances today' : range === 'YESTERDAY' ? "Yesterday's best verified performances" : range === 'LAST 3 DAYS' ? 'Best verified performances from the last 3 days' : 'Best verified performances from the last 7 days';
  const heading = selectedTeam === ALL_TEAMS ? headingBase : `${headingBase} · ${selectedTeam}`;
  const showDate = range === 'LAST 3 DAYS' || range === 'LAST 7 DAYS';

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap justify-between gap-4">
      <div><span className="font-label-caps text-xs text-[#65f2b5]">VERIFIED MLB DATA</span><h1 className="font-display-lg text-4xl">Analytics</h1><p className="text-sm text-[#849495] mt-1">Verified MLB performance analytics from live and completed games.</p></div>
      <div className="flex flex-col items-stretch sm:items-end gap-2 self-start">
        <div className="flex gap-1 bg-[#131b2e] p-1.5 rounded-xl">{(['TODAY', 'YESTERDAY', 'LAST 3 DAYS', 'LAST 7 DAYS'] as Range[]).map(item => <button key={item} onClick={() => setRange(item)} className={`px-4 py-2 rounded-lg text-xs font-bold ${range === item ? 'bg-[#00f0ff] text-[#00363a]' : 'text-[#aeb9c2] hover:text-white'}`}>{item}</button>)}</div>
        <label className="flex items-center gap-2 rounded-xl border border-[#2b405b] bg-[#10192b] px-3 py-2 text-xs text-[#b9c5d3]"><span className="font-bold tracking-wide text-[#8fa0b7]">TEAM</span><select value={selectedTeam} onChange={event => setSelectedTeam(event.target.value)} className="min-w-[220px] bg-transparent text-white outline-none"><option>{ALL_TEAMS}</option>{teamOptions.map(team => <option key={team} value={team}>{team}</option>)}</select></label>
      </div>
    </div>
    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]">{error}</div>}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4"><Metric label="GAMES" value={filteredGames.length} /><Metric label="HITTERS" value={hitterCount} /><Metric label="PITCHERS" value={pitcherCount} /><Metric label="STANDOUTS" value={standoutCount} /><Metric label="AVG INDEX" value={avgIndex === null ? '—' : avgIndex.toFixed(1)} /></div>
    <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5"><div className="flex justify-between items-center mb-5"><div><span className="text-xs text-[#9ba9b7]">TOP PERFORMANCE SIGNALS</span><h2 className="font-headline-lg text-2xl mt-1">{heading}</h2></div><button onClick={load} className="text-xs text-[#00f0ff]">REFRESH</button></div>{loading ? <p className="text-sm text-[#849495]">Loading MLB analytics…</p> : <div className="space-y-4">{filteredRows.slice(0, 20).map((row: any, index: number) => <PerformanceCard key={row.id} row={row} rank={index + 1} featured={index === 0} onClick={() => setSelected(row)} showDate={showDate} />)}{!filteredRows.length && <p className="text-sm text-[#849495]">No player performance data is available for this team and period yet.</p>}</div>}</div>
    {selected && <FullReport row={selected} report={report} loading={reportLoading} onClose={() => setSelected(null)} />}
  </div>;
};

const FullReport = ({ row, report, loading, onClose }: { row: any; report: any; loading: boolean; onClose: () => void }) => <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3" onClick={onClose}><div className="w-full max-w-5xl bg-[#171f33] border border-[#00f0ff]/30 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}><div className="relative grid grid-cols-[190px_1fr] border-b border-[#31405a] min-h-[190px]"><div className="h-[190px] flex items-end justify-center overflow-hidden"><img src={mlbPlayerHeadshotUrl(row.playerId, 420)} alt={row.player} className="h-full w-full object-contain" /></div><div className="px-6 py-5 flex items-center justify-between gap-6"><button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#0b1326]/90 text-lg">×</button><div><span className={`text-[11px] font-bold ${row.type === 'HITTER' ? 'text-[#00f0ff]' : 'text-[#65f2b5]'}`}>{row.type} PERFORMANCE REPORT</span><h2 className="font-display-lg text-3xl mt-1">{row.player}</h2><p className="text-sm text-[#b4bfce] mt-1">{row.team} vs {row.opponent}</p><p className="text-xs text-[#8f9dac] mt-1">{row.venue} · {row.date}</p></div><div className="text-right pr-4"><p className="text-[10px] text-[#8f9dac]">INDEX</p><p className="font-data-numeric text-5xl text-[#00f0ff] leading-none">{row.index}</p></div></div></div><div className="p-5 grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-4"><div className="space-y-4"><section><p className="font-label-caps text-[10px] text-[#8f9dac]">GAME PERFORMANCE</p><div className="mt-1.5 bg-[#101a30] rounded-xl px-4 py-3"><p className="font-data-numeric text-lg text-[#65f2b5]">{row.summary}</p><p className="text-xs text-[#d5ddec] mt-2">{row.fullDetail}</p></div></section>{loading ? <div className="text-sm text-[#9ba9b7]">Loading season context…</div> : <><section><p className="font-label-caps text-[10px] text-[#8f9dac]">2026 REGULAR SEASON</p><SeasonGrid row={row} season={report?.season} /></section><section><p className="font-label-caps text-[10px] text-[#8f9dac]">SCOUTING CONTEXT</p><p className="mt-1.5 bg-[#101a30] rounded-xl px-4 py-3 text-xs leading-5 text-[#d5ddec]">{performanceSummary(row, report)}</p></section></>}</div><div><p className="font-label-caps text-[10px] text-[#8f9dac]">LAST 5 GAMES</p>{loading ? <div className="mt-1.5 text-sm text-[#9ba9b7]">Loading recent games…</div> : <RecentGames row={row} games={report?.recent ?? []} />}</div></div></div></div>;

const SeasonGrid = ({ row, season }: { row: any; season: any }) => { if (!season) return <div className="mt-1.5 bg-[#101a30] rounded-xl p-3 text-xs text-[#9ba9b7]">Season statistics are not available yet.</div>; const items = row.type === 'HITTER' ? [['AVG', cleanAvg(season.avg)], ['OBP', cleanAvg(season.obp)], ['SLG', cleanAvg(season.slg)], ['OPS', cleanAvg(season.ops)], ['HR', season.homeRuns ?? '—'], ['RBI', season.rbi ?? '—'], ['H', season.hits ?? '—'], ['SO', season.strikeOuts ?? '—']] : [['ERA', season.era ?? '—'], ['WHIP', season.whip ?? '—'], ['IP', season.inningsPitched ?? '—'], ['K', season.strikeOuts ?? '—'], ['K/9', season.strikeoutsPer9Inn ?? '—'], ['BB/9', season.walksPer9Inn ?? '—'], ['H', season.hits ?? '—'], ['ER', season.earnedRuns ?? '—']]; return <div className="grid grid-cols-4 gap-2 mt-1.5">{items.map(([label, value]) => <div key={label} className="bg-[#101a30] rounded-lg px-3 py-2"><p className="text-[9px] text-[#8f9dac]">{label}</p><p className="font-data-numeric text-lg text-[#eef3ff] mt-0.5">{String(value)}</p></div>)}</div>; };
const RecentGames = ({ row, games }: { row: any; games: any[] }) => { if (!games.length) return <div className="mt-1.5 bg-[#101a30] rounded-xl p-3 text-xs text-[#9ba9b7]">Recent game logs are not available yet.</div>; return <div className="mt-1.5 space-y-1.5">{games.map((g: any, i: number) => { const s = g.stat ?? {}; const opponent = g.opponent?.name ?? 'Opponent'; const line = row.type === 'HITTER' ? `${s.atBats ?? 0} AB · ${s.hits ?? 0} H · ${s.homeRuns ?? 0} HR · ${s.rbi ?? 0} RBI` : `${s.inningsPitched ?? '—'} IP · ${s.strikeOuts ?? 0} K · ${s.earnedRuns ?? 0} ER · ${s.baseOnBalls ?? 0} BB`; return <div key={`${g.date}-${i}`} className="bg-[#101a30] rounded-lg px-3 py-2"><div className="flex justify-between gap-3"><p className="text-[10px] text-[#8f9dac]">{g.date ?? '—'} · vs {opponent}</p></div><p className="font-data-numeric text-xs text-[#eef3ff] mt-1">{line}</p></div>; })}</div>; };
const PerformanceCard = ({ row, rank, featured, onClick, showDate }: { row: any; rank: number; featured: boolean; onClick: () => void; showDate: boolean }) => <button onClick={onClick} className={`w-full text-left bg-[#131b2e] border border-[#3b494b]/20 rounded-xl overflow-hidden hover:border-[#00f0ff]/60 transition ${featured ? 'min-h-[170px]' : 'min-h-[126px]'}`}><div className={`grid ${featured ? 'grid-cols-[56px_150px_1fr_100px]' : 'grid-cols-[44px_96px_1fr_84px]'} items-center gap-4 p-4`}><div className="font-data-numeric text-sm text-[#8f9dac]">#{rank}</div><div className={`${featured ? 'w-[150px] h-[138px]' : 'w-24 h-24'} overflow-hidden flex items-end justify-center`}><img src={mlbPlayerHeadshotUrl(row.playerId, featured ? 320 : 220)} alt={row.player} className="w-full h-full object-contain" /></div><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className={`${featured ? 'text-2xl' : 'text-lg'} font-bold`}>{row.player}</h3><span className={`text-[11px] font-bold ${row.type === 'HITTER' ? 'text-[#00f0ff]' : 'text-[#65f2b5]'}`}>{row.type}</span></div><p className="text-sm text-[#aeb9c2] mt-1">{row.team} · vs {row.opponent} · {row.venue}{showDate ? ` · ${row.date}` : ''}</p><p className={`${featured ? 'text-xl' : 'text-base'} text-[#eef3ff] mt-3 font-data-numeric`}>{row.summary}</p><p className="text-sm text-[#9ba9b7] mt-1">{row.detail}</p><div className="w-full max-w-md h-1.5 bg-[#28334a] rounded-full overflow-hidden mt-3"><div className={`h-full ${row.type === 'HITTER' ? 'bg-[#00f0ff]' : 'bg-[#65f2b5]'}`} style={{ width: `${row.index}%` }} /></div><span className="inline-block text-xs text-[#00f0ff] mt-3">VIEW FULL REPORT →</span></div><div className="text-right self-center"><p className="text-xs text-[#9ba9b7]">INDEX</p><p className={`font-data-numeric ${featured ? 'text-5xl' : 'text-3xl'} text-[#00f0ff] mt-1`}>{row.index}</p></div></div></button>;
const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5"><span className="text-xs text-[#9ba9b7]">{label}</span><p className="font-data-numeric text-3xl font-bold text-[#dbfcff] mt-1">{value}</p></div>;
