import React, { useEffect, useMemo, useState } from 'react';

const dateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function fetchJson(url: string) { const response = await fetch(url); if (!response.ok) throw new Error(`MLB request failed (${response.status})`); return response.json(); }

function buildRows(feed: any) {
  const rows: any[] = [];
  const gamePk = feed?.gameData?.game?.pk ?? feed?.gamePk;
  const venue = feed?.gameData?.venue?.name ?? '—';
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  (['away','home'] as const).forEach((side) => {
    const block = teams?.[side] ?? {};
    const team = block?.team?.name ?? feed?.gameData?.teams?.[side]?.name ?? 'Unknown Team';
    const players = Object.values(block?.players ?? {}) as any[];
    for (const p of players) {
      const batting = p?.stats?.batting;
      if (batting && Number(batting.plateAppearances ?? 0) > 0) {
        const hits = Number(batting.hits ?? 0), hr = Number(batting.homeRuns ?? 0), rbi = Number(batting.rbi ?? 0), bb = Number(batting.baseOnBalls ?? 0), tb = Number(batting.totalBases ?? 0), so = Number(batting.strikeOuts ?? 0), ab = Number(batting.atBats ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(45 + hits*9 + hr*16 + rbi*5 + bb*3 + tb*1.5 - so*2)));
        rows.push({ id:`${gamePk}-h-${p.person?.id}`, gamePk, player:p.person?.fullName ?? 'Unknown', team, type:'HITTER', index, venue, summary:`${hits} H · ${hr} HR · ${rbi} RBI`, detail:`${ab} AB · ${bb} BB · ${so} SO · ${tb} TB` });
      }
      const pitching = p?.stats?.pitching;
      if (pitching && Number.parseFloat(String(pitching.inningsPitched ?? '0')) > 0) {
        const ip = Number.parseFloat(String(pitching.inningsPitched ?? '0')) || 0, k = Number(pitching.strikeOuts ?? 0), er = Number(pitching.earnedRuns ?? 0), h = Number(pitching.hits ?? 0), bb = Number(pitching.baseOnBalls ?? 0);
        const index = Math.max(0, Math.min(100, Math.round(50 + ip*5 + k*4 - er*9 - h*2 - bb*2)));
        rows.push({ id:`${gamePk}-p-${p.person?.id}`, gamePk, player:p.person?.fullName ?? 'Unknown', team, type:'PITCHER', index, venue, summary:`${pitching.inningsPitched} IP · ${k} K · ${er} ER`, detail:`${h} H · ${bb} BB · ${pitching.numberOfPitches ?? '—'} P` });
      }
    }
  });
  return rows;
}

export const AnalyticsView: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const date = dateKey();
      const schedule = await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`);
      const gameList = (schedule?.dates ?? []).flatMap((d:any) => d.games ?? []);
      setGames(gameList);
      const feeds = await Promise.all(gameList.slice(0,15).map((g:any) => fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`).catch(() => null)));
      setRows(feeds.filter(Boolean).flatMap(buildRows).sort((a:any,b:any)=>b.index-a.index));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load analytics.'); setRows([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const timer = window.setInterval(load, 10 * 60 * 1000); return () => window.clearInterval(timer); }, []);

  const avgIndex = useMemo(() => rows.length ? rows.reduce((s,r)=>s+r.index,0)/rows.length : null, [rows]);
  const hitterCount = rows.filter(r=>r.type==='HITTER').length;
  const pitcherCount = rows.filter(r=>r.type==='PITCHER').length;
  const standoutCount = rows.filter(r=>r.index>=75).length;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div><span className="font-label-caps text-xs text-[#65f2b5]">LIVE MLB DATA</span><h1 className="font-display-lg text-4xl">Advanced Analytics</h1><p className="text-sm text-[#849495] mt-1">Live and completed-game performance signals generated directly from verified MLB box-score data.</p></div>
    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]">{error}</div>}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4"><Metric label="GAMES" value={games.length}/><Metric label="HITTERS" value={hitterCount}/><Metric label="PITCHERS" value={pitcherCount}/><Metric label="STANDOUTS" value={standoutCount}/><Metric label="AVG INDEX" value={avgIndex===null?'—':avgIndex.toFixed(1)}/></div>
    <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5">
      <div className="flex justify-between items-center mb-4"><div><span className="text-[10px] text-[#849495]">TOP PERFORMANCE SIGNALS</span><h2 className="font-headline-lg text-xl">Best verified performances today</h2></div><button onClick={load} className="text-xs text-[#00f0ff]">REFRESH</button></div>
      {loading ? <p className="text-sm text-[#849495]">Loading MLB analytics…</p> : <div className="space-y-3">{rows.slice(0,20).map((row:any,index:number)=><div key={row.id} className="bg-[#131b2e] p-4 rounded-lg border border-[#3b494b]/15"><div className="grid grid-cols-[34px_1fr_auto] items-center gap-3"><span className="text-xs text-[#849495]">#{index+1}</span><div><p className="text-sm font-bold">{row.player} <span className="text-[10px] text-[#00f0ff] ml-2">{row.type}</span></p><p className="text-xs text-[#849495]">{row.team} · {row.venue}</p><p className="text-sm text-[#d5ddec] mt-1 font-data-numeric">{row.summary}</p><p className="text-xs text-[#849495] mt-1">{row.detail}</p></div><div className="text-right"><p className="text-[9px] text-[#849495]">INDEX</p><p className="font-data-numeric text-2xl text-[#00f0ff]">{row.index}</p></div></div></div>)}{!rows.length&&<p className="text-sm text-[#849495]">No player performance data is available yet. If games have not started, this page will populate once MLB box-score data appears.</p>}</div>}
    </div>
  </div>;
};

const Metric=({label,value}:{label:string;value:React.ReactNode})=><div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5"><span className="text-[10px] text-[#849495]">{label}</span><p className="font-data-numeric text-3xl font-bold text-[#dbfcff] mt-1">{value}</p></div>;
